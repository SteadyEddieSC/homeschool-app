begin;

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('student', 'parent', 'teacher', 'director', 'group-admin')),
  token_hash bytea not null unique,
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((accepted_at is null and accepted_by is null) or (accepted_at is not null and accepted_by is not null))
);

create index organization_invites_org_created_idx
  on public.organization_invites(organization_id, created_at desc);
create index organization_invites_active_idx
  on public.organization_invites(organization_id, expires_at)
  where accepted_at is null and revoked_at is null;

alter table public.organization_invites enable row level security;

alter table public.organization_memberships
  add constraint organization_memberships_profile_fk
  foreign key (user_id) references public.profiles(id) on delete cascade
  not valid;
alter table public.organization_memberships
  validate constraint organization_memberships_profile_fk;

create or replace function public.shares_managed_organization(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_memberships target
    join public.organization_memberships manager
      on manager.organization_id = target.organization_id
    where target.user_id = target_user
      and target.status = 'active'
      and manager.user_id = auth.uid()
      and manager.status = 'active'
      and manager.role in ('group-admin', 'system-admin')
  )
$$;

create or replace function public.bootstrap_organization(
  requested_name text,
  requested_slug text
)
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
  created public.organizations%rowtype;
  normalized_name text;
  normalized_slug text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.organization_memberships
    where user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'This account already has an active organization membership' using errcode = '42501';
  end if;

  normalized_name := trim(regexp_replace(requested_name, '\s+', ' ', 'g'));
  normalized_slug := lower(trim(requested_slug));

  if char_length(normalized_name) < 2 or char_length(normalized_name) > 160 then
    raise exception 'Organization name must be between 2 and 160 characters';
  end if;
  if normalized_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then
    raise exception 'Organization address must contain letters, numbers, or hyphens';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (normalized_name, normalized_slug, auth.uid())
  returning * into created;

  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (created.id, auth.uid(), 'organization.bootstrap', 'organization', created.id, jsonb_build_object('release', '11.0.0-alpha.2'));

  return query select created.id, created.name, created.slug;
end;
$$;

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

  raw_token := encode(gen_random_bytes(32), 'hex');
  insert into public.organization_invites (
    organization_id,
    role,
    token_hash,
    invited_by,
    expires_at
  ) values (
    target_organization,
    target_role,
    digest(raw_token, 'sha256'),
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

create or replace function public.revoke_organization_invite(
  target_organization uuid,
  target_invitation uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed uuid;
begin
  if auth.uid() is null or not public.can_manage_org(target_organization) then
    raise exception 'Group Administrator access is required' using errcode = '42501';
  end if;

  update public.organization_invites
  set revoked_at = now()
  where id = target_invitation
    and organization_id = target_organization
    and accepted_at is null
    and revoked_at is null
  returning id into changed;

  if changed is null then
    raise exception 'Active invitation not found';
  end if;

  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id)
  values (target_organization, auth.uid(), 'organization.invite.revoke', 'organization_invite', target_invitation);
  return true;
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

  select * into invitation
  from public.organization_invites
  where token_hash = digest(trim(invite_token), 'sha256')
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if invitation.id is null then
    raise exception 'Invitation is invalid, expired, revoked, or already used';
  end if;
  if invitation.role = 'system-admin' then
    raise exception 'System Administrator access cannot be granted by invitation' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.organization_memberships
    where organization_id = invitation.organization_id
      and user_id = auth.uid()
      and status = 'active'
  ) then
    raise exception 'This account is already an active organization member';
  end if;

  insert into public.organization_memberships (organization_id, user_id, role, status)
  values (invitation.organization_id, auth.uid(), invitation.role, 'active')
  on conflict (organization_id, user_id) do update
    set role = excluded.role,
        status = 'active',
        updated_at = now()
    where organization_memberships.status in ('invited', 'left');

  if not found then
    raise exception 'Existing membership cannot be reactivated with this invitation' using errcode = '42501';
  end if;

  update public.organization_invites
  set accepted_by = auth.uid(), accepted_at = now()
  where id = invitation.id;

  select * into organization
  from public.organizations
  where id = invitation.organization_id;

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

revoke all on function public.shares_managed_organization(uuid) from public;
revoke all on function public.bootstrap_organization(text, text) from public;
revoke all on function public.create_organization_invite(uuid, text, integer) from public;
revoke all on function public.revoke_organization_invite(uuid, uuid) from public;
revoke all on function public.redeem_organization_invite(text) from public;

grant execute on function public.shares_managed_organization(uuid) to authenticated;
grant execute on function public.bootstrap_organization(text, text) to authenticated;
grant execute on function public.create_organization_invite(uuid, text, integer) to authenticated;
grant execute on function public.revoke_organization_invite(uuid, uuid) to authenticated;
grant execute on function public.redeem_organization_invite(text) to authenticated;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_authorized on public.profiles
for select to authenticated
using (id = auth.uid() or public.shares_managed_organization(id));

create policy organization_invites_select_admin on public.organization_invites
for select to authenticated
using (public.can_manage_org(organization_id));

drop policy if exists organizations_insert_owner on public.organizations;
revoke insert on public.organizations from authenticated;

drop policy if exists organization_memberships_insert_admin on public.organization_memberships;
create policy organization_memberships_insert_admin on public.organization_memberships
for insert to authenticated
with check (
  public.can_manage_org(organization_id)
  and role in ('student', 'parent', 'teacher', 'director', 'group-admin')
);

drop policy if exists organization_memberships_update_admin on public.organization_memberships;
create policy organization_memberships_update_admin on public.organization_memberships
for update to authenticated
using (public.can_manage_org(organization_id) and role <> 'system-admin')
with check (
  public.can_manage_org(organization_id)
  and role in ('student', 'parent', 'teacher', 'director', 'group-admin')
);

drop policy if exists organization_memberships_delete_admin on public.organization_memberships;
create policy organization_memberships_delete_admin on public.organization_memberships
for delete to authenticated
using (public.can_manage_org(organization_id) and role <> 'system-admin');

grant select on public.organization_invites to authenticated;

commit;
