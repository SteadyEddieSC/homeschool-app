begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(24);

select has_table('public', 'learner_today_items', 'Today item table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.learner_today_items'::regclass), 'Today items have Row-Level Security enabled');
select has_function('public', 'transition_learner_today_item', array['uuid', 'text', 'text', 'text', 'uuid'], 'Idempotent Today transition RPC exists');
select has_column('public', 'learners', 'pronouns', 'learner pronouns column exists');
select has_column('public', 'learners', 'avatar_key', 'learner avatar column exists');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
(
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'beta.admin@example.invalid',
  crypt('SyntheticPassword123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Synthetic Group Administrator"}'::jsonb,
  now(), now()
),
(
  '20000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'beta.parent@example.invalid',
  crypt('SyntheticPassword123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Synthetic Parent"}'::jsonb,
  now(), now()
),
(
  '20000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'beta.director@example.invalid',
  crypt('SyntheticPassword123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Synthetic Director"}'::jsonb,
  now(), now()
),
(
  '20000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'beta.other@example.invalid',
  crypt('SyntheticPassword123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Synthetic Other Parent"}'::jsonb,
  now(), now()
);

insert into public.organizations (id, name, slug, created_by)
values ('21000000-0000-0000-0000-000000000001', 'Synthetic Beta Group', 'synthetic-beta-group', '20000000-0000-0000-0000-000000000001');
insert into public.organization_memberships (organization_id, user_id, role, status) values
('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'parent', 'active'),
('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'director', 'active'),
('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'parent', 'active');

create temporary table beta_fixture (
  household_id uuid,
  learner_id uuid,
  item_id uuid
);
insert into beta_fixture default values;
grant select, insert, update, delete on pg_temp.beta_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$ insert into public.households (organization_id, name, created_by) values ('21000000-0000-0000-0000-000000000001', 'Synthetic Harbor Household', auth.uid()) $$,
  'Parent can create a household'
);
update pg_temp.beta_fixture set household_id = (select id from public.households where name = 'Synthetic Harbor Household');

select lives_ok(
  $$
    insert into public.learners (organization_id, household_id, preferred_name, pronouns, grade_band, avatar_key, access_mode)
    values (
      '21000000-0000-0000-0000-000000000001',
      (select household_id from pg_temp.beta_fixture),
      'Synthetic Learner', 'they/them', '4-6', 'heron', 'parent-assisted'
    )
  $$,
  'Parent can create a learner without an auth user or email'
);
update pg_temp.beta_fixture set learner_id = (select id from public.learners where preferred_name = 'Synthetic Learner');

select lives_ok(
  $$
    insert into public.learner_today_items (
      organization_id, household_id, learner_id, assigned_by, title, instructions, activity_type, due_date
    ) values (
      '21000000-0000-0000-0000-000000000001',
      (select household_id from pg_temp.beta_fixture),
      (select learner_id from pg_temp.beta_fixture),
      auth.uid(),
      'Synthetic reading practice',
      'Read the original synthetic passage and leave a note.',
      'practice',
      current_date
    )
  $$,
  'Parent can assign a bounded Today item'
);
update pg_temp.beta_fixture set item_id = (select id from public.learner_today_items where title = 'Synthetic reading practice');

select is((select count(*)::integer from public.learners), 1, 'Parent can see the managed learner');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.learners), 0, 'Director does not automatically see household learners');
select throws_ok(
  $$ insert into public.households (organization_id, name, created_by) values ('21000000-0000-0000-0000-000000000001', 'Director Household', auth.uid()) $$,
  '42501',
  'new row violates row-level security policy for table "households"',
  'Director cannot create a household'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000004', true);
select is((select count(*)::integer from public.learners), 0, 'Unrelated parent cannot read another household learner');
select throws_ok(
  $$ select public.transition_learner_today_item((select item_id from pg_temp.beta_fixture), 'start', '', '', '22000000-0000-0000-0000-000000000001') $$,
  'P0001',
  'Learner action is not authorized',
  'Unrelated parent cannot mutate another learner Today item'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$ select public.transition_learner_today_item((select item_id from pg_temp.beta_fixture), 'start', '', '', '22000000-0000-0000-0000-000000000002') $$,
  'Parent-assisted learner mode can start assigned work'
);
select is((select status from public.learner_today_items where id = (select item_id from pg_temp.beta_fixture)), 'in-progress', 'Start transition records in-progress');
select lives_ok(
  $$ select public.transition_learner_today_item((select item_id from pg_temp.beta_fixture), 'submit-review', 'Synthetic learner note', '', '22000000-0000-0000-0000-000000000003') $$,
  'Parent-assisted learner mode can send work for review'
);
select is((select status from public.learner_today_items where id = (select item_id from pg_temp.beta_fixture)), 'ready-for-review', 'Submission waits for explicit adult review');
select lives_ok(
  $$ select public.transition_learner_today_item((select item_id from pg_temp.beta_fixture), 'complete', '', 'Reviewed synthetic work', '22000000-0000-0000-0000-000000000004') $$,
  'Household manager can complete work after review'
);
select is((select status from public.learner_today_items where id = (select item_id from pg_temp.beta_fixture)), 'completed', 'Adult review records completed status');
select is((select reviewed_by from public.learner_today_items where id = (select item_id from pg_temp.beta_fixture)), '20000000-0000-0000-0000-000000000002'::uuid, 'Adult reviewer identity is recorded');

select hasnt_column('public', 'learner_today_items', 'grade', 'Today items do not award a grade');
select hasnt_column('public', 'learner_today_items', 'xp', 'Today items do not award XP');
select hasnt_column('public', 'learner_today_items', 'attendance', 'Today items do not record attendance');
select hasnt_column('public', 'learner_today_items', 'mastery', 'Today items do not infer mastery');

select * from finish();
rollback;
