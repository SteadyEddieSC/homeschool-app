begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(25);

select has_table('public', 'knowledge_checks', 'Knowledge checks table exists');
select has_table('public', 'knowledge_attempts', 'Knowledge attempts table exists');
select has_table('public', 'evidence_submissions', 'Evidence submissions table exists');
select has_table('public', 'weekly_plans', 'Weekly plans table exists');
select has_table('public', 'weekly_plan_items', 'Weekly plan items table exists');
select has_table('public', 'learning_studio_operation_receipts', 'Studio receipt table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.knowledge_checks'::regclass), 'Knowledge checks use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.knowledge_attempts'::regclass), 'Knowledge attempts use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.evidence_submissions'::regclass), 'Evidence submissions use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.weekly_plans'::regclass), 'Weekly plans use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.weekly_plan_items'::regclass), 'Weekly plan items use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.learning_studio_operation_receipts'::regclass), 'Studio receipts use RLS');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'studio.parent@example.invalid',
  crypt('SyntheticPassword123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Synthetic Studio Parent"}'::jsonb,
  now(), now()
);

insert into public.organizations (id, name, slug, created_by)
values ('41000000-0000-0000-0000-000000000001', 'Synthetic Studio Group', 'synthetic-studio-group', '40000000-0000-0000-0000-000000000001');
update public.organization_memberships set role = 'parent'
where organization_id = '41000000-0000-0000-0000-000000000001' and user_id = '40000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);

insert into public.households(id, organization_id, name, created_by)
values ('42000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'Synthetic Studio Household', auth.uid());
insert into public.household_memberships(household_id, user_id, relationship, can_manage)
values ('42000000-0000-0000-0000-000000000001', auth.uid(), 'parent', true)
on conflict do nothing;
insert into public.learners(id, organization_id, household_id, preferred_name, grade_band, avatar_key, access_mode)
values ('43000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 'Synthetic Studio Learner', '4-6', 'heron', 'parent-assisted');
insert into public.learner_today_items(id, organization_id, household_id, learner_id, assigned_by, title, activity_type, due_date, status)
values
('44000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', auth.uid(), 'Synthetic Quiz', 'quiz', current_date, 'in-progress'),
('44000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', auth.uid(), 'Synthetic Proof', 'proof', current_date, 'ready-for-review');

select lives_ok($$
  insert into public.knowledge_checks(id, organization_id, household_id, learner_id, today_item_id, title, questions, created_by, client_operation_id)
  values (
    '45000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001',
    '42000000-0000-0000-0000-000000000001',
    '43000000-0000-0000-0000-000000000001',
    '44000000-0000-0000-0000-000000000001',
    'Synthetic Check',
    '[{"id":"q1","type":"true-false","prompt":"The harbor is synthetic.","options":["True","False"],"correctOption":0,"explanation":"Synthetic fixture."}]'::jsonb,
    auth.uid(),
    '45100000-0000-0000-0000-000000000001'
  )
$$, 'Parent can create a knowledge check');

select lives_ok($$ select public.submit_knowledge_attempt_v2(
  '45000000-0000-0000-0000-000000000001',
  '[0]'::jsonb,
  '46000000-0000-0000-0000-000000000001',
  '46100000-0000-0000-0000-000000000001'
) $$, 'First deterministic knowledge attempt succeeds');
select lives_ok($$ select public.submit_knowledge_attempt_v2(
  '45000000-0000-0000-0000-000000000001',
  '[0]'::jsonb,
  '46000000-0000-0000-0000-000000000001',
  '46100000-0000-0000-0000-000000000001'
) $$, 'Retrying the same knowledge operation is idempotent');
select is((select count(*)::integer from public.knowledge_attempts where client_operation_id = '46000000-0000-0000-0000-000000000001'), 1, 'Knowledge retry creates one attempt');
select is((select correct_count from public.knowledge_attempts where client_operation_id = '46000000-0000-0000-0000-000000000001'), 1, 'Knowledge answer key is scored on the server');
select is((select percentage from public.knowledge_attempts where client_operation_id = '46000000-0000-0000-0000-000000000001'), 100, 'Knowledge percentage is deterministic');

insert into public.evidence_submissions(
  id, organization_id, household_id, learner_id, today_item_id, title, evidence_kind, content,
  revision, client_operation_id, submitted_by
) values (
  '47000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000001',
  '42000000-0000-0000-0000-000000000001',
  '43000000-0000-0000-0000-000000000001',
  '44000000-0000-0000-0000-000000000002',
  'Synthetic Proof', 'text', 'Synthetic proof content', 1,
  '47100000-0000-0000-0000-000000000001', auth.uid()
);

select lives_ok($$ select public.review_evidence_submission(
  '47000000-0000-0000-0000-000000000001', 'return', 'Add one more synthetic detail.', '48000000-0000-0000-0000-000000000001'
) $$, 'Adult can return subjective proof');
select lives_ok($$ select public.review_evidence_submission(
  '47000000-0000-0000-0000-000000000001', 'return', 'Add one more synthetic detail.', '48000000-0000-0000-0000-000000000001'
) $$, 'Retrying the same evidence review is idempotent');
select is((select status from public.evidence_submissions where id = '47000000-0000-0000-0000-000000000001'), 'returned', 'Evidence remains returned after retry');
select is((select count(*)::integer from public.learning_studio_operation_receipts where operation_id = '48000000-0000-0000-0000-000000000001'), 1, 'Evidence retry creates one receipt');

select lives_ok($$
  insert into public.weekly_plans(id, organization_id, household_id, week_start, title, created_by, client_operation_id)
  values ('49000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', current_date, 'Synthetic Week', auth.uid(), '49100000-0000-0000-0000-000000000001')
$$, 'Parent can create a weekly plan');
select lives_ok($$
  insert into public.weekly_plan_items(id, organization_id, household_id, plan_id, learner_id, scheduled_date, title, activity_type, client_operation_id)
  values ('49200000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', '49000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', current_date, 'Synthetic plan item', 'learn', '49300000-0000-0000-0000-000000000001')
$$, 'Parent can add a weekly plan item');
select is((select count(*)::integer from public.weekly_plan_items where plan_id = '49000000-0000-0000-0000-000000000001'), 1, 'Weekly plan contains one bounded item');

select * from finish();
rollback;
