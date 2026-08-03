begin;

alter table public.learners
  add column if not exists pronouns text not null default '' check (char_length(pronouns) <= 80),
  add column if not exists avatar_key text not null default 'harbor' check (avatar_key in ('harbor', 'dolphin', 'heron', 'turtle', 'compass', 'lighthouse')),
  add column if not exists access_mode text not null default 'parent-assisted' check (access_mode = 'parent-assisted');

create or replace function public.can_view_family(target_household uuid)
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
        or public.current_org_role(household.organization_id) = 'group-admin'
      )
  )
$$;

create or replace function public.can_manage_family(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.households household
    left join public.household_memberships membership
      on membership.household_id = household.id
      and membership.user_id = auth.uid()
    where household.id = target_household
      and (
        coalesce(membership.can_manage, false)
        or public.current_org_role(household.organization_id) = 'group-admin'
      )
  )
$$;

revoke all on function public.can_view_family(uuid) from public;
revoke all on function public.can_manage_family(uuid) from public;
grant execute on function public.can_view_family(uuid) to authenticated;
grant execute on function public.can_manage_family(uuid) to authenticated;

-- Beta 1 narrows family visibility: Director, Teacher, Student, and System
-- Administrator roles do not receive family records merely from org membership.
drop policy if exists households_select_authorized on public.households;
drop policy if exists households_insert_member on public.households;
drop policy if exists households_update_manager on public.households;
drop policy if exists households_delete_manager on public.households;
create policy households_select_family on public.households for select to authenticated using (public.can_view_family(id));
create policy households_insert_parent_or_group_admin on public.households for insert to authenticated with check (
  created_by = auth.uid()
  and public.current_org_role(organization_id) in ('parent', 'group-admin')
);
create policy households_update_family_manager on public.households for update to authenticated using (public.can_manage_family(id)) with check (public.can_manage_family(id));
create policy households_delete_family_manager on public.households for delete to authenticated using (public.can_manage_family(id));

drop policy if exists household_memberships_select on public.household_memberships;
drop policy if exists household_memberships_insert_manager on public.household_memberships;
drop policy if exists household_memberships_update_manager on public.household_memberships;
drop policy if exists household_memberships_delete_manager on public.household_memberships;
create policy household_memberships_select_family on public.household_memberships for select to authenticated using (user_id = auth.uid() or public.can_manage_family(household_id));
create policy household_memberships_insert_family_manager on public.household_memberships for insert to authenticated with check (public.can_manage_family(household_id));
create policy household_memberships_update_family_manager on public.household_memberships for update to authenticated using (public.can_manage_family(household_id)) with check (public.can_manage_family(household_id));
create policy household_memberships_delete_family_manager on public.household_memberships for delete to authenticated using (public.can_manage_family(household_id));

drop policy if exists learners_select_household on public.learners;
drop policy if exists learners_insert_manager on public.learners;
drop policy if exists learners_update_manager on public.learners;
drop policy if exists learners_delete_manager on public.learners;
create policy learners_select_family on public.learners for select to authenticated using (public.can_view_family(household_id));
create policy learners_insert_family_manager on public.learners for insert to authenticated with check (
  public.can_manage_family(household_id)
  and exists (
    select 1 from public.households household
    where household.id = learners.household_id
      and household.organization_id = learners.organization_id
  )
);
create policy learners_update_family_manager on public.learners for update to authenticated using (public.can_manage_family(household_id)) with check (public.can_manage_family(household_id));
create policy learners_delete_family_manager on public.learners for delete to authenticated using (public.can_manage_family(household_id));

create table public.learner_today_items (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  assigned_by uuid not null references auth.users(id),
  title text not null check (char_length(title) between 2 and 180),
  instructions text not null default '' check (char_length(instructions) <= 3000),
  activity_type text not null check (activity_type in ('learn', 'practice', 'quiz', 'proof')),
  due_date date not null,
  status text not null default 'assigned' check (status in ('assigned', 'in-progress', 'ready-for-review', 'completed', 'returned')),
  learner_note text not null default '' check (char_length(learner_note) <= 2000),
  review_feedback text not null default '' check (char_length(review_feedback) <= 2000),
  reviewed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, organization_id) references public.households(id, organization_id) on delete cascade
);

create index learner_today_items_learner_due_idx on public.learner_today_items(learner_id, due_date, created_at);
create index learner_today_items_household_status_idx on public.learner_today_items(household_id, status, updated_at desc);
create trigger learner_today_items_updated_at before update on public.learner_today_items for each row execute function public.set_updated_at();

alter table public.learner_today_items enable row level security;
create policy learner_today_items_select_family on public.learner_today_items for select to authenticated using (public.can_view_family(household_id));
create policy learner_today_items_insert_family_manager on public.learner_today_items for insert to authenticated with check (
  assigned_by = auth.uid()
  and public.can_manage_family(household_id)
  and exists (
    select 1
    from public.learners learner
    where learner.id = learner_today_items.learner_id
      and learner.household_id = learner_today_items.household_id
      and learner.organization_id = learner_today_items.organization_id
      and learner.status = 'active'
  )
);

create or replace function public.transition_learner_today_item(
  target_item uuid,
  requested_action text,
  submitted_learner_note text default '',
  submitted_review_feedback text default ''
)
returns public.learner_today_items
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  current_item public.learner_today_items%rowtype;
  actor_is_learner boolean;
  actor_can_manage boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select * into current_item
  from public.learner_today_items
  where id = target_item
  for update;

  if not found then
    raise exception 'Today item was not found';
  end if;

  select exists (
    select 1 from public.learners learner
    where learner.id = current_item.learner_id
      and learner.user_id = auth.uid()
  ) into actor_is_learner;
  actor_can_manage := public.can_manage_family(current_item.household_id);

  if requested_action in ('start', 'submit-review') and not (actor_is_learner or actor_can_manage) then
    raise exception 'Learner action is not authorized';
  end if;
  if requested_action in ('complete', 'return') and not actor_can_manage then
    raise exception 'Adult review is not authorized';
  end if;

  if requested_action = 'start' then
    if current_item.status not in ('assigned', 'returned') then
      raise exception 'Only assigned or returned work can be started';
    end if;
    update public.learner_today_items
      set status = 'in-progress'
      where id = current_item.id
      returning * into current_item;
  elsif requested_action = 'submit-review' then
    if current_item.status <> 'in-progress' then
      raise exception 'Start the item before sending it for review';
    end if;
    update public.learner_today_items
      set status = 'ready-for-review',
          learner_note = left(trim(coalesce(submitted_learner_note, '')), 2000),
          review_feedback = '',
          reviewed_by = null,
          completed_at = null
      where id = current_item.id
      returning * into current_item;
  elsif requested_action = 'complete' then
    if current_item.status <> 'ready-for-review' then
      raise exception 'Only work awaiting review can be completed';
    end if;
    update public.learner_today_items
      set status = 'completed',
          review_feedback = left(trim(coalesce(submitted_review_feedback, '')), 2000),
          reviewed_by = auth.uid(),
          completed_at = now()
      where id = current_item.id
      returning * into current_item;
  elsif requested_action = 'return' then
    if current_item.status <> 'ready-for-review' then
      raise exception 'Only work awaiting review can be returned';
    end if;
    if char_length(trim(coalesce(submitted_review_feedback, ''))) = 0 then
      raise exception 'Feedback is required when returning work';
    end if;
    update public.learner_today_items
      set status = 'returned',
          review_feedback = left(trim(submitted_review_feedback), 2000),
          reviewed_by = auth.uid(),
          completed_at = null
      where id = current_item.id
      returning * into current_item;
  else
    raise exception 'Unsupported Today transition';
  end if;

  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    current_item.organization_id,
    auth.uid(),
    'learner_today_item.' || requested_action,
    'learner_today_item',
    current_item.id,
    jsonb_build_object('learner_id', current_item.learner_id, 'status', current_item.status)
  );

  return current_item;
end;
$$;

revoke all on function public.transition_learner_today_item(uuid, text, text, text) from public;
grant execute on function public.transition_learner_today_item(uuid, text, text, text) to authenticated;

grant select, insert on public.learner_today_items to authenticated;
revoke update, delete on public.learner_today_items from authenticated;

commit;
