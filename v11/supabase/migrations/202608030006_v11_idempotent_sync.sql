begin;

alter table public.households
  add column if not exists client_operation_id uuid unique;

alter table public.learners
  add column if not exists client_operation_id uuid unique;

alter table public.learner_today_items
  add column if not exists client_operation_id uuid unique;

create table public.learning_operation_receipts (
  operation_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  item_id uuid not null references public.learner_today_items(id) on delete cascade,
  action text not null check (action in ('start', 'submit-review', 'complete', 'return')),
  resulting_status text not null check (resulting_status in ('assigned', 'in-progress', 'ready-for-review', 'completed', 'returned')),
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index learning_operation_receipts_household_created_idx
  on public.learning_operation_receipts(household_id, created_at desc);

alter table public.learning_operation_receipts enable row level security;

create policy learning_operation_receipts_select_family_manager
on public.learning_operation_receipts
for select to authenticated
using (public.can_manage_family(household_id));

revoke all on public.learning_operation_receipts from anon, authenticated;
grant select on public.learning_operation_receipts to authenticated;

-- Replace the beta.1 transition with a required idempotency receipt. Retrying the
-- same operation returns the already-produced item and never applies the state
-- transition or audit event twice.
drop function if exists public.transition_learner_today_item(uuid, text, text, text);

create function public.transition_learner_today_item(
  target_item uuid,
  requested_action text,
  submitted_learner_note text default '',
  submitted_review_feedback text default '',
  operation_id uuid default null
)
returns public.learner_today_items
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  current_item public.learner_today_items%rowtype;
  prior_receipt public.learning_operation_receipts%rowtype;
  actor_is_learner boolean;
  actor_can_manage boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  if operation_id is null then
    raise exception 'Operation ID is required';
  end if;

  select * into prior_receipt
  from public.learning_operation_receipts
  where learning_operation_receipts.operation_id = transition_learner_today_item.operation_id;

  if found then
    if prior_receipt.item_id <> target_item or prior_receipt.action <> requested_action then
      raise exception 'Operation ID was already used for a different action';
    end if;
    select * into current_item from public.learner_today_items where id = prior_receipt.item_id;
    return current_item;
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

  insert into public.learning_operation_receipts (
    operation_id,
    organization_id,
    household_id,
    item_id,
    action,
    resulting_status,
    actor_id
  ) values (
    operation_id,
    current_item.organization_id,
    current_item.household_id,
    current_item.id,
    requested_action,
    current_item.status,
    auth.uid()
  );

  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    current_item.organization_id,
    auth.uid(),
    'learner_today_item.' || requested_action,
    'learner_today_item',
    current_item.id,
    jsonb_build_object(
      'learner_id', current_item.learner_id,
      'status', current_item.status,
      'operation_id', operation_id
    )
  );

  return current_item;
end;
$$;

revoke all on function public.transition_learner_today_item(uuid, text, text, text, uuid) from public;
grant execute on function public.transition_learner_today_item(uuid, text, text, text, uuid) to authenticated;

commit;
