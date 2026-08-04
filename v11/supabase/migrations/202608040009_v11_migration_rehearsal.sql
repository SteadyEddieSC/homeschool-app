begin;

create table public.migration_import_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_release text not null check (source_release = '10.43.0'),
  source_record_type text not null check (length(source_record_type) between 1 and 80),
  source_record_id text not null check (source_record_id ~ '^syn-[a-z0-9-]{3,80}$'),
  target_record_id uuid,
  status text not null check (status in ('candidate', 'imported', 'blocked', 'rolled-back')),
  source_digest text not null check (source_digest ~ '^[a-f0-9]{64}$'),
  rehearsal_only boolean not null default true check (rehearsal_only = true),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, source_release, source_record_type, source_record_id)
);

create table public.production_readiness_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  release text not null check (release = '11.0.0-rc.1'),
  decision text not null default 'not-ready' check (decision in ('not-ready', 'pilot-only', 'rejected')),
  production_cutover_approved boolean not null default false check (production_cutover_approved = false),
  decided_by uuid references auth.users(id),
  rationale text not null default '',
  created_at timestamptz not null default now()
);

alter table public.migration_import_receipts enable row level security;
alter table public.production_readiness_decisions enable row level security;

create policy migration_receipts_group_admin_read on public.migration_import_receipts
for select to authenticated using (public.current_org_role(organization_id) = 'group-admin');
create policy migration_receipts_group_admin_insert on public.migration_import_receipts
for insert to authenticated with check (
  public.current_org_role(organization_id) = 'group-admin'
  and created_by = auth.uid()
  and rehearsal_only = true
  and source_release = '10.43.0'
  and source_record_id ~ '^syn-[a-z0-9-]{3,80}$'
);
create policy readiness_group_admin_read on public.production_readiness_decisions
for select to authenticated using (public.current_org_role(organization_id) = 'group-admin');

revoke all on public.migration_import_receipts from anon;
revoke all on public.production_readiness_decisions from anon;
revoke update, delete on public.migration_import_receipts from authenticated;
revoke insert, update, delete on public.production_readiness_decisions from authenticated;
grant select, insert on public.migration_import_receipts to authenticated;
grant select on public.production_readiness_decisions to authenticated;

create function public.release_candidate_readiness_status()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  return jsonb_build_object(
    'release', '11.0.0-rc.1',
    'migration', '202608040009',
    'synthetic_migration_rehearsal', true,
    'live_migration_enabled', false,
    'production_data_enabled', false,
    'production_cutover_approved', false,
    'owner_approval_required', true,
    'hosted_pilot_schema_release', '11.0.0-beta.4',
    'hosted_pilot_migration', '202608040008'
  );
end;
$$;

revoke all on function public.release_candidate_readiness_status() from public;
grant execute on function public.release_candidate_readiness_status() to authenticated;

comment on table public.migration_import_receipts is 'Synthetic-only idempotent source-to-target receipts for owner-controlled v10.43 migration rehearsal.';
comment on table public.production_readiness_decisions is 'Owner-governed release-candidate decision records. Automated and authenticated browser clients cannot approve production cutover.';
comment on function public.release_candidate_readiness_status() is 'Returns non-sensitive rc.1 readiness metadata while production data, live migration, and cutover remain disabled.';

commit;
