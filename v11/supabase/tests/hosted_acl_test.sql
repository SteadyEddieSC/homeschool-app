begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(6);

select ok(
  to_regprocedure('public.hosted_acl_status()') is not null,
  'Hosted ACL status RPC exists'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  0,
  'Anonymous security-definer RPC execution is disabled'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'set_updated_at',
        'handle_new_user',
        'bootstrap_organization_admin',
        'bootstrap_household_guardian',
        'enforce_support_ticket_update_boundary',
        'touch_support_ticket_from_message',
        'validate_weekly_plan_item_date'
      )
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  0,
  'Trigger-only functions are not browser-callable'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.submit_knowledge_attempt(uuid,jsonb,uuid)',
    'EXECUTE'
  ),
  'Superseded scoring RPC is disabled'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.submit_knowledge_attempt_v2(uuid,jsonb,uuid,uuid)',
    'EXECUTE'
  ),
  'Client-ID-preserving scoring RPC remains enabled'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '51000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'acl.verifier@example.invalid',
  crypt('SyntheticPassword123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Synthetic ACL Verifier"}'::jsonb,
  now(),
  now()
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);

select is(
  public.hosted_acl_status() ->> 'migration',
  '202608050010',
  'Authenticated ACL status reports migration 010'
);

select * from finish();
rollback;
