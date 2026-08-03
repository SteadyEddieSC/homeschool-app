begin;

-- Foundation alpha fails closed for teacher household visibility until explicit
-- teaching assignments and class rosters are introduced in a later migration.
create or replace function public.can_view_household(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.households household
    where household.id = target_household
      and (
        public.is_household_member(household.id)
        or coalesce(public.current_org_role(household.organization_id) in ('director', 'group-admin', 'system-admin'), false)
      )
  )
$$;

-- Client-visible role labels are denormalized for support history, but the
-- database verifies that they match the authenticated membership role.
alter policy support_tickets_insert_member on public.support_tickets
with check (
  created_by = auth.uid()
  and public.is_org_member(organization_id)
  and public.current_org_role(organization_id) = created_by_role
  and (
    household_id is null
    or exists (
      select 1 from public.households household
      where household.id = support_tickets.household_id
        and household.organization_id = support_tickets.organization_id
        and public.can_view_household(household.id)
    )
  )
);

alter policy support_messages_insert_participant on public.support_ticket_messages
with check (
  author_id = auth.uid()
  and public.can_view_ticket(ticket_id)
  and public.current_org_role(public.ticket_organization(ticket_id)) = author_role
  and (not is_internal or public.can_manage_org(public.ticket_organization(ticket_id)))
);

create or replace function public.enforce_support_ticket_update_boundary()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id
    or new.ticket_number is distinct from old.ticket_number
    or new.organization_id is distinct from old.organization_id
    or new.household_id is distinct from old.household_id
    or new.created_by is distinct from old.created_by
    or new.created_by_label is distinct from old.created_by_label
    or new.created_by_role is distinct from old.created_by_role
    or new.category is distinct from old.category
    or new.subject is distinct from old.subject
    or new.description is distinct from old.description
    or new.route is distinct from old.route
    or new.app_version is distinct from old.app_version
    or new.diagnostics_consent is distinct from old.diagnostics_consent
    or new.created_at is distinct from old.created_at then
      raise exception 'Support updates may change status or priority only';
  end if;
  return new;
end;
$$;

create trigger support_ticket_immutable_fields
before update on public.support_tickets
for each row execute function public.enforce_support_ticket_update_boundary();

create or replace function public.touch_support_ticket_from_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.support_tickets
  set updated_at = new.created_at,
      status = case
        when status = 'new' and public.can_support_org(organization_id) then 'acknowledged'
        else status
      end
  where id = new.ticket_id;
  return new;
end;
$$;

create trigger support_ticket_message_touches_parent
after insert on public.support_ticket_messages
for each row execute function public.touch_support_ticket_from_message();

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_memberships to authenticated;
grant select, insert, update, delete on public.households to authenticated;
grant select, insert, update, delete on public.household_memberships to authenticated;
grant select, insert, update, delete on public.learners to authenticated;
grant select, insert, update on public.support_tickets to authenticated;
grant select, insert on public.support_ticket_messages to authenticated;
grant select, insert on public.audit_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;

commit;
