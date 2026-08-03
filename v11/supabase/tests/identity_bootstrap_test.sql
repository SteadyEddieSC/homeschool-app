begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(19);

select has_table('public', 'organization_invites', 'organization invitation table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.organization_invites'::regclass),
  'organization invitations have row-level security enabled'
);
select has_function('public', 'bootstrap_organization', array['text', 'text'], 'organization bootstrap RPC exists');
select has_function('public', 'create_organization_invite', array['uuid', 'text', 'integer'], 'invitation creation RPC exists');
select has_function('public', 'redeem_organization_invite', array['text'], 'invitation redemption RPC exists');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
(
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'admin.synthetic@example.invalid',
  crypt('SyntheticPassword123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Synthetic Group Administrator"}'::jsonb,
  now(), now()
),
(
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'teacher.synthetic@example.invalid',
  crypt('SyntheticPassword123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Synthetic Teacher"}'::jsonb,
  now(), now()
),
(
  '10000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'candidate.synthetic@example.invalid',
  crypt('SyntheticPassword123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Synthetic Candidate"}'::jsonb,
  now(), now()
);

create temporary table captured_invite (
  id uuid,
  organization_id uuid,
  role text,
  invited_by uuid,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz,
  invite_token text
);
grant select, insert, update, delete on pg_temp.captured_invite to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$ select * from public.bootstrap_organization('Synthetic Learning Group', 'synthetic-learning-group') $$,
  'authenticated account can bootstrap its first organization'
);
select is(
  (
    select membership.role
    from public.organization_memberships membership
    join public.organizations organization on organization.id = membership.organization_id
    where organization.slug = 'synthetic-learning-group'
      and membership.user_id = '10000000-0000-0000-0000-000000000001'
  ),
  'group-admin',
  'bootstrap creates a Group Administrator membership'
);
select is(
  (
    select count(*)::integer
    from public.organization_memberships
    where user_id = '10000000-0000-0000-0000-000000000001'
      and role = 'system-admin'
  ),
  0,
  'bootstrap never creates System Administrator access'
);

select lives_ok(
  $$
    insert into pg_temp.captured_invite
    select * from public.create_organization_invite(
      (select id from public.organizations where slug = 'synthetic-learning-group'),
      'teacher',
      24
    )
  $$,
  'Group Administrator can create a role-limited invitation'
);
select is((select char_length(invite_token) from pg_temp.captured_invite limit 1), 64, 'one-time invitation token has 256 bits encoded as hex');
select is((select role from pg_temp.captured_invite limit 1), 'teacher', 'invitation preserves the requested ordinary role');
select throws_ok(
  $$
    select * from public.create_organization_invite(
      (select id from public.organizations where slug = 'synthetic-learning-group'),
      'system-admin',
      24
    )
  $$,
  'P0001',
  'Unsupported invitation role',
  'System Administrator cannot be invited'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$ select * from public.redeem_organization_invite((select invite_token from pg_temp.captured_invite limit 1)) $$,
  'authenticated account can redeem a valid one-time invitation'
);
select is(
  (
    select role from public.organization_memberships
    where user_id = '10000000-0000-0000-0000-000000000002'
      and organization_id = (select id from public.organizations where slug = 'synthetic-learning-group')
  ),
  'teacher',
  'redemption creates only the invited role'
);
select ok(
  (select accepted_at is not null from public.organization_invites where id = (select id from pg_temp.captured_invite limit 1)),
  'redeemed invitation is marked accepted'
);
select throws_ok(
  $$ select * from public.redeem_organization_invite((select invite_token from pg_temp.captured_invite limit 1)) $$,
  'P0001',
  'Invitation is invalid, expired, revoked, or already used',
  'one-time invitation cannot be reused'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ insert into public.organizations (name, slug, created_by) values ('Direct Insert', 'direct-insert', auth.uid()) $$,
  'direct organization inserts are blocked in favor of the bootstrap RPC'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$
    insert into public.organization_memberships (organization_id, user_id, role, status)
    values (
      (select id from public.organizations where slug = 'synthetic-learning-group'),
      '10000000-0000-0000-0000-000000000003',
      'system-admin',
      'active'
    )
  $$,
  'direct System Administrator assignment is blocked by row-level security'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$ select * from public.bootstrap_organization('Anonymous Group', 'anonymous-group') $$,
  '42501',
  'Authentication is required',
  'anonymous users cannot bootstrap organizations'
);

select * from finish();
rollback;
