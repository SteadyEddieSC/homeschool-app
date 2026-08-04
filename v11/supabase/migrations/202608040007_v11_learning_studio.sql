begin;

create table public.knowledge_checks (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  today_item_id uuid not null references public.learner_today_items(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 180),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 20),
  created_by uuid not null references auth.users(id),
  client_operation_id uuid unique,
  created_at timestamptz not null default now(),
  foreign key (household_id, organization_id) references public.households(id, organization_id) on delete cascade,
  unique (today_item_id)
);

create table public.knowledge_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  today_item_id uuid not null references public.learner_today_items(id) on delete cascade,
  check_id uuid not null references public.knowledge_checks(id) on delete cascade,
  answers jsonb not null check (jsonb_typeof(answers) = 'array'),
  correct_count integer not null check (correct_count >= 0),
  total_questions integer not null check (total_questions > 0),
  percentage integer not null check (percentage between 0 and 100),
  results jsonb not null check (jsonb_typeof(results) = 'array'),
  client_operation_id uuid not null unique,
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  unique (check_id, learner_id),
  foreign key (household_id, organization_id) references public.households(id, organization_id) on delete cascade
);

create table public.evidence_submissions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  today_item_id uuid not null references public.learner_today_items(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 180),
  evidence_kind text not null check (evidence_kind in ('text', 'link')),
  content text not null check (char_length(content) between 2 and 4000),
  learner_note text not null default '' check (char_length(learner_note) <= 2000),
  revision integer not null check (revision > 0),
  previous_submission_id uuid references public.evidence_submissions(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'returned')),
  adult_feedback text not null default '' check (char_length(adult_feedback) <= 2000),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  client_operation_id uuid not null unique,
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  unique (today_item_id, revision),
  foreign key (household_id, organization_id) references public.households(id, organization_id) on delete cascade
);

create table public.weekly_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null,
  title text not null check (char_length(title) between 2 and 180),
  created_by uuid not null references auth.users(id),
  client_operation_id uuid unique,
  created_at timestamptz not null default now(),
  unique (household_id, week_start),
  foreign key (household_id, organization_id) references public.households(id, organization_id) on delete cascade
);

create table public.weekly_plan_items (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  plan_id uuid not null references public.weekly_plans(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  scheduled_date date not null,
  title text not null check (char_length(title) between 2 and 180),
  activity_type text not null check (activity_type in ('learn', 'practice', 'quiz', 'proof')),
  today_item_id uuid references public.learner_today_items(id) on delete set null,
  client_operation_id uuid unique,
  created_at timestamptz not null default now(),
  foreign key (household_id, organization_id) references public.households(id, organization_id) on delete cascade
);

create table public.learning_studio_operation_receipts (
  operation_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  operation_kind text not null check (operation_kind in ('submit-knowledge-attempt', 'review-evidence')),
  record_id uuid not null,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create function public.validate_weekly_plan_item_date()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  plan_week date;
begin
  select week_start into plan_week from public.weekly_plans where id = new.plan_id;
  if plan_week is null then raise exception 'Weekly plan was not found'; end if;
  if new.scheduled_date < plan_week or new.scheduled_date > plan_week + 6 then
    raise exception 'Plan item date must fall within the selected seven-day week';
  end if;
  return new;
end;
$$;

create trigger weekly_plan_items_validate_date
before insert or update on public.weekly_plan_items
for each row execute function public.validate_weekly_plan_item_date();

create index knowledge_checks_learner_created_idx on public.knowledge_checks(learner_id, created_at desc);
create index knowledge_attempts_learner_submitted_idx on public.knowledge_attempts(learner_id, submitted_at desc);
create index evidence_submissions_household_status_idx on public.evidence_submissions(household_id, status, submitted_at desc);
create index weekly_plans_household_week_idx on public.weekly_plans(household_id, week_start desc);
create index weekly_plan_items_learner_date_idx on public.weekly_plan_items(learner_id, scheduled_date, created_at);

alter table public.knowledge_checks enable row level security;
alter table public.knowledge_attempts enable row level security;
alter table public.evidence_submissions enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.weekly_plan_items enable row level security;
alter table public.learning_studio_operation_receipts enable row level security;

create policy knowledge_checks_select_family on public.knowledge_checks for select to authenticated using (public.can_view_family(household_id));
create policy knowledge_checks_insert_manager on public.knowledge_checks for insert to authenticated with check (
  created_by = auth.uid() and public.can_manage_family(household_id)
);

create policy knowledge_attempts_select_family on public.knowledge_attempts for select to authenticated using (public.can_view_family(household_id));
create policy evidence_submissions_select_family on public.evidence_submissions for select to authenticated using (public.can_view_family(household_id));
create policy evidence_submissions_insert_family on public.evidence_submissions for insert to authenticated with check (
  submitted_by = auth.uid()
  and public.can_view_family(household_id)
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
);
create policy weekly_plans_select_family on public.weekly_plans for select to authenticated using (public.can_view_family(household_id));
create policy weekly_plans_insert_manager on public.weekly_plans for insert to authenticated with check (
  created_by = auth.uid() and public.can_manage_family(household_id)
);
create policy weekly_plan_items_select_family on public.weekly_plan_items for select to authenticated using (public.can_view_family(household_id));
create policy weekly_plan_items_insert_manager on public.weekly_plan_items for insert to authenticated with check (public.can_manage_family(household_id));
create policy learning_studio_receipts_select_manager on public.learning_studio_operation_receipts for select to authenticated using (public.can_manage_family(household_id));

revoke all on public.knowledge_checks, public.knowledge_attempts, public.evidence_submissions, public.weekly_plans, public.weekly_plan_items, public.learning_studio_operation_receipts from anon, authenticated;
revoke all on public.knowledge_attempts from anon, authenticated;
revoke all on public.learning_studio_operation_receipts from anon, authenticated;
grant select, insert on public.knowledge_checks to authenticated;
grant select on public.knowledge_attempts to authenticated;
grant select, insert on public.evidence_submissions to authenticated;
grant select, insert on public.weekly_plans, public.weekly_plan_items to authenticated;
grant select on public.learning_studio_operation_receipts to authenticated;

create function public.submit_knowledge_attempt(
  target_check uuid,
  submitted_answers jsonb,
  operation_id uuid
)
returns public.knowledge_attempts
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  current_check public.knowledge_checks%rowtype;
  prior_receipt public.learning_studio_operation_receipts%rowtype;
  created_attempt public.knowledge_attempts%rowtype;
  answer_count integer;
  correct_count integer;
  result_rows jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if operation_id is null then raise exception 'Operation ID is required'; end if;

  select * into prior_receipt from public.learning_studio_operation_receipts where learning_studio_operation_receipts.operation_id = submit_knowledge_attempt.operation_id;
  if found then
    if prior_receipt.operation_kind <> 'submit-knowledge-attempt' then raise exception 'Operation ID was already used for a different action'; end if;
    select * into created_attempt from public.knowledge_attempts where id = prior_receipt.record_id;
    return created_attempt;
  end if;

  select * into current_check from public.knowledge_checks where id = target_check for update;
  if not found then raise exception 'Knowledge check was not found'; end if;
  if not public.can_view_family(current_check.household_id) then raise exception 'Knowledge check is not authorized'; end if;
  if jsonb_typeof(submitted_answers) <> 'array' then raise exception 'Answers must be an array'; end if;
  answer_count := jsonb_array_length(submitted_answers);
  if answer_count <> jsonb_array_length(current_check.questions) then raise exception 'Answer every question before submitting the check'; end if;

  select
    count(*) filter (where (submitted_answers ->> ((question.ordinality - 1)::integer))::integer = (question.value ->> 'correctOption')::integer)::integer,
    jsonb_agg(jsonb_build_object(
      'questionId', question.value ->> 'id',
      'selectedOption', (submitted_answers ->> ((question.ordinality - 1)::integer))::integer,
      'correctOption', (question.value ->> 'correctOption')::integer,
      'correct', (submitted_answers ->> ((question.ordinality - 1)::integer))::integer = (question.value ->> 'correctOption')::integer
    ) order by question.ordinality)
  into correct_count, result_rows
  from jsonb_array_elements(current_check.questions) with ordinality as question(value, ordinality);

  insert into public.knowledge_attempts (
    organization_id, household_id, learner_id, today_item_id, check_id,
    answers, correct_count, total_questions, percentage, results,
    client_operation_id, submitted_by
  ) values (
    current_check.organization_id, current_check.household_id, current_check.learner_id, current_check.today_item_id, current_check.id,
    submitted_answers, correct_count, answer_count, round((correct_count::numeric / answer_count::numeric) * 100)::integer, result_rows,
    operation_id, auth.uid()
  ) returning * into created_attempt;

  insert into public.learning_studio_operation_receipts(operation_id, organization_id, household_id, operation_kind, record_id, actor_id)
  values (operation_id, current_check.organization_id, current_check.household_id, 'submit-knowledge-attempt', created_attempt.id, auth.uid());

  insert into public.audit_events(organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (current_check.organization_id, auth.uid(), 'knowledge_attempt.submit', 'knowledge_attempt', created_attempt.id,
    jsonb_build_object('check_id', current_check.id, 'correct_count', correct_count, 'total_questions', answer_count, 'operation_id', operation_id));

  return created_attempt;
end;
$$;

create function public.review_evidence_submission(
  target_submission uuid,
  requested_decision text,
  submitted_feedback text,
  operation_id uuid
)
returns public.evidence_submissions
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  current_submission public.evidence_submissions%rowtype;
  prior_receipt public.learning_studio_operation_receipts%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if operation_id is null then raise exception 'Operation ID is required'; end if;
  if requested_decision not in ('accept', 'return') then raise exception 'Unsupported evidence decision'; end if;
  if requested_decision = 'return' and char_length(trim(coalesce(submitted_feedback, ''))) = 0 then raise exception 'Feedback is required when returning evidence'; end if;

  select * into prior_receipt from public.learning_studio_operation_receipts where learning_studio_operation_receipts.operation_id = review_evidence_submission.operation_id;
  if found then
    if prior_receipt.operation_kind <> 'review-evidence' then raise exception 'Operation ID was already used for a different action'; end if;
    select * into current_submission from public.evidence_submissions where id = prior_receipt.record_id;
    return current_submission;
  end if;

  select * into current_submission from public.evidence_submissions where id = target_submission for update;
  if not found then raise exception 'Evidence submission was not found'; end if;
  if not public.can_manage_family(current_submission.household_id) then raise exception 'Evidence review is not authorized'; end if;
  if current_submission.status <> 'pending' then raise exception 'Only pending evidence can be reviewed'; end if;

  update public.evidence_submissions
  set status = case when requested_decision = 'accept' then 'accepted' else 'returned' end,
      adult_feedback = left(trim(coalesce(submitted_feedback, '')), 2000),
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = current_submission.id
  returning * into current_submission;

  insert into public.learning_studio_operation_receipts(operation_id, organization_id, household_id, operation_kind, record_id, actor_id)
  values (operation_id, current_submission.organization_id, current_submission.household_id, 'review-evidence', current_submission.id, auth.uid());

  insert into public.audit_events(organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (current_submission.organization_id, auth.uid(), 'evidence.' || requested_decision, 'evidence_submission', current_submission.id,
    jsonb_build_object('revision', current_submission.revision, 'operation_id', operation_id));

  return current_submission;
end;
$$;

revoke all on function public.submit_knowledge_attempt(uuid, jsonb, uuid) from public;
revoke all on function public.review_evidence_submission(uuid, text, text, uuid) from public;
grant execute on function public.submit_knowledge_attempt(uuid, jsonb, uuid) to authenticated;
grant execute on function public.review_evidence_submission(uuid, text, text, uuid) to authenticated;

commit;
