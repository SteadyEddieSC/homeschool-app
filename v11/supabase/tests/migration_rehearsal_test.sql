begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(13);

select has_table('public', 'migration_import_receipts', 'Migration receipts table exists');
select has_table('public', 'production_readiness_decisions', 'Readiness decisions table exists');
select has_function('public', 'release_candidate_readiness_status', array[]::text[], 'Release-candidate status RPC exists');
select col_is_unique('public', 'migration_import_receipts', array['organization_id','source_release','source_record_type','source_record_id'], 'Source records have one import receipt');
select col_default_is('public', 'migration_import_receipts', 'rehearsal_only', 'true', 'Migration receipts default to rehearsal only');
select col_default_is('public', 'production_readiness_decisions', 'decision', '''not-ready''::text', 'Readiness defaults to not ready');
select col_default_is('public', 'production_readiness_decisions', 'production_cutover_approved', 'false', 'Production cutover defaults false');
select policies_are('public', 'migration_import_receipts', array['migration_receipts_group_admin_insert','migration_receipts_group_admin_read'], 'Migration receipt policies are explicit');
select policies_are('public', 'production_readiness_decisions', array['readiness_group_admin_read'], 'Readiness is read-only for authenticated clients');
select throws_ok($$ insert into public.production_readiness_decisions(organization_id, release, decision, production_cutover_approved) values ('00000000-0000-0000-0000-000000000001','11.0.0-rc.1','not-ready',true) $$, '23514', null, 'Cutover cannot be approved in rc.1');
select throws_ok($$ insert into public.production_readiness_decisions(organization_id, release, decision) values ('00000000-0000-0000-0000-000000000001','11.0.0-rc.1','approved') $$, '23514', null, 'Approved is not an rc.1 decision state');
select throws_ok($$ insert into public.migration_import_receipts(organization_id, source_release, source_record_type, source_record_id, status, source_digest, created_by) values ('00000000-0000-0000-0000-000000000001','10.43.0','learner','real-person-001','candidate',repeat('a',64),'00000000-0000-0000-0000-000000000001') $$, '23514', null, 'Non-synthetic source IDs are rejected');
select throws_ok($$ insert into public.migration_import_receipts(organization_id, source_release, source_record_type, source_record_id, status, source_digest, created_by, rehearsal_only) values ('00000000-0000-0000-0000-000000000001','10.43.0','learner','syn-learner-001','candidate',repeat('a',64),'00000000-0000-0000-0000-000000000001',false) $$, '23514', null, 'Live migration receipts are rejected');

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('59000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rc1.synthetic@example.invalid',crypt('SyntheticPassword123!', gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"display_name":"Synthetic RC1"}'::jsonb,now(),now());
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','59000000-0000-0000-0000-000000000001',true);
select is(public.release_candidate_readiness_status(), jsonb_build_object(
  'release','11.0.0-rc.1','migration','202608040009','synthetic_migration_rehearsal',true,'live_migration_enabled',false,
  'production_data_enabled',false,'production_cutover_approved',false,'owner_approval_required',true,
  'hosted_pilot_schema_release','11.0.0-beta.4','hosted_pilot_migration','202608040008'
), 'Status RPC keeps live migration and production cutover disabled');

select * from finish();
rollback;
