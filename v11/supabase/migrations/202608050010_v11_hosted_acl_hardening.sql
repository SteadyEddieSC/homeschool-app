begin;

-- Supabase grants exposed-schema functions to anon by default. The earlier
-- migrations revoke PUBLIC and then grant authenticated access, but a hosted
-- project can still retain a direct anon EXECUTE grant. Remove that grant from
-- every public function before the hosted pilot begins.
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
    execute format('revoke execute on function %s from anon', target.signature);
  end loop;
end
$$;

-- Trigger-only functions are not browser RPCs. They remain executable by their
-- owning triggers while direct signed-in invocation is removed.
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

comment on schema public is
  'Application schema. Anonymous RPC execution is disabled; browser RPC access requires an authenticated session and remains constrained by function checks and RLS.';

commit;
