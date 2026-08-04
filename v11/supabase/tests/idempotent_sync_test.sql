begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(15);

select has_column('public', 'households', 'client_operation_id', 'Households accept a client operation ID');
select has_column('public', 'learners', 'client_operation_id', 'Learners accept a client operation ID');
select has_column('public', 'learner_today_items', 'client_operation_id', 'Today items accept a client operation ID');
select has_table('public', 'learning_operation_receipts', 'Learning operation receipt table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.learning_operation_receipts'::regclass), 'Operation receipts have Row-Level Security enabled');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'sync.parent@example.invalid',
  crypt('SyntheticPassword123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Synthetic Sync Parent"}'::jsonb,
  now(), now()
);

insert into public.organizations (id, name, slug, created_by)
values (
  '31000000-0000-0000-0000-000000000001',
  'Synthetic Sync Group',
  'synthetic-sync-group',
  '30000000-0000-0000-0000-000000000001'
);
update public.organization_memberships
set role = 'parent'
where organization_id = '31000000-0000-0000-0000-000000000001'
  and user_id = '30000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$
    insert into public.households (
      id, organization_id, name, created_by, client_operation_id
    ) values (
      '32000000-0000-0000-0000-000000000001',
      '31000000-0000-0000-0000-000000000001',
      'Synthetic Sync Household',
      auth.uid(),
      '33000000-0000-0000-0000-000000000001'
    )
  $$,
  'First household operation succeeds'
);

select lives_ok(
  $$
    insert into public.households (
      id, organization_id, name, created_by, client_operation_id
    ) values (
      '32000000-0000-0000-0000-000000000001',
      '31000000-0000-0000-0000-000000000001',
      'Synthetic Sync Household',
      auth.uid(),
      '33000000-0000-0000-0000-000000000001'
    )
    on conflict (client_operation_id) do update set name = excluded.name
  $$,
  'Retrying the same household operation succeeds idempotently'
);
select is((select count(*)::integer from public.households where client_operation_id = '33000000-0000-0000-0000-000000000001'), 1, 'Household retry creates one row');

insert into public.learners (
  id, organization_id, household_id, preferred_name, grade_band, avatar_key, access_mode, client_operation_id
) values (
  '34000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '32000000-0000-0000-0000-000000000001',
  'Synthetic Sync Learner',
  '4-6',
  'compass',
  'parent-assisted',
  '33000000-0000-0000-0000-000000000002'
);

insert into public.learner_today_items (
  id, organization_id, household_id, learner_id, assigned_by,
  title, activity_type, due_date, client_operation_id
) values (
  '35000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '32000000-0000-0000-0000-000000000001',
  '34000000-0000-0000-0000-000000000001',
  auth.uid(),
  'Synthetic queued practice',
  'practice',
  current_date,
  '33000000-0000-0000-0000-000000000003'
);

select lives_ok(
  $$ select public.transition_learner_today_item(
    '35000000-0000-0000-0000-000000000001',
    'start',
    '',
    '',
    '36000000-0000-0000-0000-000000000001'
  ) $$,
  'First Today transition succeeds'
);
select lives_ok(
  $$ select public.transition_learner_today_item(
    '35000000-0000-0000-0000-000000000001',
    'start',
    '',
    '',
    '36000000-0000-0000-0000-000000000001'
  ) $$,
  'Retrying the same transition operation returns the existing result'
);
select is((select status from public.learner_today_items where id = '35000000-0000-0000-0000-000000000001'), 'in-progress', 'Transition retry does not advance status twice');
select is((select count(*)::integer from public.learning_operation_receipts where operation_id = '36000000-0000-0000-0000-000000000001'), 1, 'Transition retry creates one receipt');

reset role;
select is((select count(*)::integer from public.audit_events where metadata ->> 'operation_id' = '36000000-0000-0000-0000-000000000001'), 1, 'Transition retry creates one audit event');
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$ select public.transition_learner_today_item(
    '35000000-0000-0000-0000-000000000001',
    'submit-review',
    '',
    '',
    '36000000-0000-0000-0000-000000000001'
  ) $$,
  'P0001',
  'Operation ID was already used for a different action',
  'An operation ID cannot be reused for a different action'
);
select throws_ok(
  $$
    insert into public.learning_operation_receipts (
      operation_id, organization_id, household_id, item_id, action, resulting_status, actor_id
    ) values (
      '36000000-0000-0000-0000-000000000002',
      '31000000-0000-0000-0000-000000000001',
      '32000000-0000-0000-0000-000000000001',
      '35000000-0000-0000-0000-000000000001',
      'start',
      'in-progress',
      auth.uid()
    )
  $$,
  '42501',
  'permission denied for table learning_operation_receipts',
  'Authenticated clients cannot forge operation receipts'
);

select * from finish();
rollback;
