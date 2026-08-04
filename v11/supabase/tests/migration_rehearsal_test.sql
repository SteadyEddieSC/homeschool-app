begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(8);

select has_table('public', 'migration_import_receipts', 'Migration receipts table exists');
select has_table('public', 'production_readiness_decisions', 'Readiness decisions table exists');
select col_is_unique('public', 'migration_import_receipts', array['organization_id','source_release','source_record_type','source_record_id'], 'Source records have one import receipt');
select col_default_is('public', 'production_readiness_decisions', 'decision', '''not-approved''::text', 'Readiness defaults to not approved');
select col_default_is('public', 'production_readiness_decisions', 'production_cutover_approved', 'false', 'Production cutover defaults false');
select policies_are('public', 'migration_import_receipts', array['migration_receipts_family_admin_insert','migration_receipts_family_admin_read'], 'Migration receipt policies are explicit');
select policies_are('public', 'production_readiness_decisions', array['readiness_group_admin_read'], 'Readiness is read-only for authenticated clients');
select throws_ok($$ insert into public.production_readiness_decisions(organization_id, release, decision, production_cutover_approved) values ('00000000-0000-0000-0000-000000000001','11.0.0-rc.1','not-approved',true) $$, '23514', null, 'Cutover cannot be true while decision is not approved');

select * from finish();
rollback;
