begin;

-- Supabase installs pgcrypto in the extensions schema. These security-definer
-- functions intentionally use a restricted search_path, so cryptographic
-- functions must be schema-qualified rather than adding extensions broadly.
create or replace function public.create_organization_invite(
  target_organization uuid,
  target_role text,
  expires_in_hours integer default 168
)
returns table (
  id uuid,
  organization_id uuid,
  role text,
  invited_by uuid,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz,
  invite_token text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  raw_token text;
  created public.organization_invites%rowtype;
begin
  if auth.uid() is null or not public.can_manage_org(target_organization) then
    raise exception 'Group Administrator access is required' using errcode = '42501';
  end if;
  if target_role not in ('student', 'parent', 'teacher', 'director', 'group-admin') then
    raise exception 'Unsupported invitation role';
  end if;
  if expires_in_hours < 1 or expires_in_hours > 720 then
    raise exception 'Invitation expiration must be between 1 and 720 hours';
  end if;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.organization_invites (
    organization_id,
    role,
    token_hash,
    invited_by,
    expires_at
  ) values (
    target_organization,
    target_role,
    extensions.digest(raw_token, 'sha256'),
    auth.uid(),
    now() + make_interval(hours => expires_in_hours)
  ) returning * into created;

  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    target_organization,
    auth.uid(),
    'organization.invite.create',
    'organization_invite',
    created.id,
    jsonb_build_object('role', target_role, 'expires_at', created.expires_at)
  );

  return query select
    created.id,
    created.organization_id,
    created.role,
    created.invited_by,
    created.expires_at,
    created.accepted_at,
    created.revoked_at,
    created.created_at,
    raw_token;
end;
$$;

create or replace function public.redeem_organization_invite(invite_token text)
returns table (
  organization_id uuid,
  organization_name text,
  organization_slug text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invitation public.organization_invites%rowtype;
  organization public.organizations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if char_length(trim(invite_token)) < 32 or char_length(trim(invite_token)) > 160 then
    raise exception 'Invitation code is invalid';
  end if;

  select candidate.* into invitation
  from public.organization_invites candidate
  where candidate.token_hash = extensions.digest(trim(invite_token), 'sha256')
    and candidate.accepted_at is null
    and candidate.revoked_at is null
    and candidate.expires_at > now()
  for update;

  if invitation.id is null then
    raise exception 'Invitation is invalid, expired, revoked, or already used';
  end if;
  if invitation.role = 'system-admin' then
    raise exception 'System Administrator access cannot be granted by invitation' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = invitation.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  ) then
    raise exception 'This account is already an active organization member';
  end if;

  insert into public.organization_memberships (organization_id, user_id, role, status)
  values (invitation.organization_id, auth.uid(), invitation.role, 'active')
  on conflict on constraint organization_memberships_pkey do update
    set role = excluded.role,
        status = 'active',
        updated_at = now()
    where organization_memberships.status in ('invited', 'left');

  if not found then
    raise exception 'Existing membership cannot be reactivated with this invitation' using errcode = '42501';
  end if;

  update public.organization_invites target
  set accepted_by = auth.uid(), accepted_at = now()
  where target.id = invitation.id;

  select target.* into organization
  from public.organizations target
  where target.id = invitation.organization_id;

  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    invitation.organization_id,
    auth.uid(),
    'organization.invite.redeem',
    'organization_invite',
    invitation.id,
    jsonb_build_object('role', invitation.role)
  );

  return query select organization.id, organization.name, organization.slug;
end;
$$;

revoke all on function public.create_organization_invite(uuid, text, integer) from public;
revoke all on function public.redeem_organization_invite(text) from public;
grant execute on function public.create_organization_invite(uuid, text, integer) to authenticated;
grant execute on function public.redeem_organization_invite(text) to authenticated;

commit;
