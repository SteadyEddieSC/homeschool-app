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
