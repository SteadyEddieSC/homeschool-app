begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(2);

insert into auth.users (
  id, instance_id, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
(
  '26000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Synthetic Group Administrator"}'::jsonb,
  now(), now()
),
(
  '26000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Synthetic System Administrator"}'::jsonb,
  now(), now()
);

insert into public.organizations (id, name, slug, created_by)
values ('26100000-0000-0000-0000-000000000001', 'Synthetic System Boundary Group', 'synthetic-system-boundary-group', '26000000-0000-0000-0000-000000000001');
insert into public.organization_memberships (organization_id, user_id, role, status)
values ('26100000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000002', 'system-admin', 'active');

insert into public.households (id, organization_id, name, created_by, client_operation_id)
values (
  '26200000-0000-0000-0000-000000000001',
  '26100000-0000-0000-0000-000000000001',
  'Synthetic Protected Household',
  '26000000-0000-0000-0000-000000000001',
  '26300000-0000-0000-0000-000000000001'
);
insert into public.learners (
  id, organization_id, household_id, preferred_name, grade_band, access_mode, client_operation_id
) values (
  '26400000-0000-0000-0000-000000000001',
  '26100000-0000-0000-0000-000000000001',
  '26200000-0000-0000-0000-000000000001',
  'Synthetic Protected Learner',
  '4-6',
  'parent-assisted',
  '26500000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000002', true);

select is((select count(*)::integer from public.households), 0, 'System Administrator does not automatically see household records');
select is((select count(*)::integer from public.learners), 0, 'System Administrator does not automatically see household learners');

select * from finish();
rollback;
