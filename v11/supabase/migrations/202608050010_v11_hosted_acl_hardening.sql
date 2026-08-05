begin;

-- Hosted Supabase projects can retain direct anon grants and the PostgreSQL
-- default PUBLIC execute privilege on exposed-schema functions. Remove both
-- privileges from every public function after all release-candidate functions
-- have been created.
do $$
declare
  target record;
begin
  for target in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke execute on function %s from public', target.signature);
    execute format('revoke execute on function %s from anon', target.signature);
  end loop;
end
$$;

-- Trigger-only functions remain available to their owning triggers, but are not
-- directly callable through the browser API.
revoke execute on function public.set_updated_at() from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.bootstrap_organization_admin() from authenticated;
revoke execute on function public.bootstrap_household_guardian() from authenticated;
revoke execute on function public.enforce_support_ticket_update_boundary() from authenticated;
revoke execute on function public.touch_support_ticket_from_message() from authenticated;
revoke execute on function public.validate_weekly_plan_item_date() from authenticated;

-- The v2 knowledge-attempt RPC preserves the client record ID and supersedes
-- the earlier hosted function.
revoke execute on function public.submit_knowledge_attempt(uuid, jsonb, uuid) from authenticated;

-- Lock the remaining mutable helper search path reported by the hosted linter.
alter function public.set_updated_at() set search_path = public, pg_temp;

create or replace function public.hosted_acl_status()
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public, pg_temp
as $$
declare
  anonymous_security_definer_count integer;
  authenticated_trigger_function_count integer;
  legacy_scoring_executable boolean;
  current_scoring_executable boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select count(*)::integer
  into anonymous_security_definer_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  select count(*)::integer
  into authenticated_trigger_function_count
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
    and has_function_privilege('authenticated', p.oid, 'EXECUTE');

  select has_function_privilege(
    'authenticated',
    'public.submit_knowledge_attempt(uuid,jsonb,uuid)'::regprocedure,
    'EXECUTE'
  ) into legacy_scoring_executable;

  select has_function_privilege(
    'authenticated',
    'public.submit_knowledge_attempt_v2(uuid,jsonb,uuid,uuid)'::regprocedure,
    'EXECUTE'
  ) into current_scoring_executable;

  return jsonb_build_object(
    'release', '11.0.0-rc.1',
    'migration', '202608050010',
    'anonymous_security_definer_executable', anonymous_security_definer_count,
    'authenticated_trigger_functions_executable', authenticated_trigger_function_count,
    'legacy_scoring_rpc_executable', legacy_scoring_executable,
    'current_scoring_rpc_executable', current_scoring_executable,
    'production_data_enabled', false,
    'production_cutover_approved', false
  );
end;
$$;

revoke all on function public.hosted_acl_status() from public;
revoke execute on function public.hosted_acl_status() from anon;
grant execute on function public.hosted_acl_status() to authenticated;

comment on function public.hosted_acl_status()
is 'Returns sanitized hosted ACL verification for the authenticated non-production pilot. No role, user, token, or record identifiers are returned.';

comment on schema public is
  'Application schema. Anonymous RPC execution is disabled; browser RPC access requires an authenticated session and remains constrained by function checks and RLS.';

commit;
