begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(12);

select has_function('public', 'submit_knowledge_attempt_v2', array['uuid', 'jsonb', 'uuid', 'uuid'], 'Hosted pilot scoring RPC exists');
select has_function('public', 'hosted_pilot_schema_status', array[]::text[], 'Hosted pilot schema status RPC exists');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '50000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pilot.parent@example.invalid',
  crypt('SyntheticPassword123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Synthetic Pilot Parent"}'::jsonb,
  now(), now()
);

insert into public.organizations (id, name, slug, created_by)
values ('51000000-0000-0000-0000-000000000001', 'Synthetic Pilot Group', 'synthetic-pilot-group', '50000000-0000-0000-0000-000000000001');
update public.organization_memberships set role = 'parent'
where organization_id = '51000000-0000-0000-0000-000000000001' and user_id = '50000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);

insert into public.households(id, organization_id, name, created_by)
values ('52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'Synthetic Pilot Household', auth.uid());
insert into public.household_memberships(household_id, user_id, relationship, can_manage)
values ('52000000-0000-0000-0000-000000000001', auth.uid(), 'parent', true)
on conflict do nothing;
insert into public.learners(id, organization_id, household_id, preferred_name, grade_band, avatar_key, access_mode)
values ('53000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', 'Synthetic Pilot Learner', '4-6', 'heron', 'parent-assisted');
insert into public.learner_today_items(id, organization_id, household_id, learner_id, assigned_by, title, activity_type, due_date, status)
values ('54000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001', auth.uid(), 'Synthetic Hosted Quiz', 'quiz', current_date, 'in-progress');
insert into public.knowledge_checks(id, organization_id, household_id, learner_id, today_item_id, title, questions, created_by, client_operation_id)
values (
  '55000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001',
  '52000000-0000-0000-0000-000000000001',
  '53000000-0000-0000-0000-000000000001',
  '54000000-0000-0000-0000-000000000001',
  'Synthetic Hosted Check',
  '[{"id":"q1","type":"true-false","prompt":"The target ID should survive synchronization.","options":["True","False"],"correctOption":0,"explanation":"Hosted pilot fixture."}]'::jsonb,
  auth.uid(),
  '55100000-0000-0000-0000-000000000001'
);

select lives_ok($$ select public.submit_knowledge_attempt_v2(
  '55000000-0000-0000-0000-000000000001',
  '[0]'::jsonb,
  '56000000-0000-0000-0000-000000000001',
  '56100000-0000-0000-0000-000000000001'
) $$, 'First hosted knowledge attempt succeeds');
select is((select id from public.knowledge_attempts where client_operation_id = '56000000-0000-0000-0000-000000000001'), '56100000-0000-0000-0000-000000000001'::uuid, 'Hosted attempt preserves the local record ID');
select lives_ok($$ select public.submit_knowledge_attempt_v2(
  '55000000-0000-0000-0000-000000000001',
  '[0]'::jsonb,
  '56000000-0000-0000-0000-000000000001',
  '56100000-0000-0000-0000-000000000001'
) $$, 'Retrying the hosted attempt is idempotent');
select is((select count(*)::integer from public.knowledge_attempts where client_operation_id = '56000000-0000-0000-0000-000000000001'), 1, 'Hosted retry creates one attempt');
select is((select count(*)::integer from public.learning_studio_operation_receipts where operation_id = '56000000-0000-0000-0000-000000000001'), 1, 'Hosted retry creates one operation receipt');
select is((select count(*)::integer from public.audit_events where entity_id = '56100000-0000-0000-0000-000000000001'), 1, 'Hosted retry creates one audit event');
select is(public.hosted_pilot_schema_status()->>'release', '11.0.0-beta.4', 'Schema status reports beta.4');
select is((public.hosted_pilot_schema_status()->>'production_data_enabled')::boolean, false, 'Schema status keeps production data disabled');

insert into public.weekly_plans(id, organization_id, household_id, week_start, title, created_by, client_operation_id)
values ('57000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', current_date, 'Synthetic Hosted Week', auth.uid(), '57100000-0000-0000-0000-000000000001');

select lives_ok($$
  insert into public.weekly_plan_items(id, organization_id, household_id, plan_id, learner_id, scheduled_date, title, activity_type, client_operation_id)
  values ('57200000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '57000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001', current_date + 6, 'Valid hosted plan item', 'learn', '57300000-0000-0000-0000-000000000001')
$$, 'Last day of the seven-day plan is accepted');
select throws_ok($$
  insert into public.weekly_plan_items(id, organization_id, household_id, plan_id, learner_id, scheduled_date, title, activity_type, client_operation_id)
  values ('57400000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '57000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001', current_date + 7, 'Invalid hosted plan item', 'learn', '57500000-0000-0000-0000-000000000001')
$$, 'P0001', 'Plan item date must fall within the selected seven-day week', 'Eighth day is rejected by the database');

select * from finish();
rollback;
