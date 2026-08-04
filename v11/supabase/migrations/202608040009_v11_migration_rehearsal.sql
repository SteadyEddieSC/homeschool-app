begin;

create table public.migration_import_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_release text not null,
  source_record_type text not null,
  source_record_id text not null,
  target_record_id uuid,
  status text not null check (status in ('candidate', 'imported', 'blocked', 'rolled-back')),
  source_digest text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, source_release, source_record_type, source_record_id)
);

create table public.production_readiness_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  release text not null,
  decision text not null default 'not-approved' check (decision in ('not-approved', 'approved', 'rejected')),
  production_cutover_approved boolean not null default false,
  decided_by uuid references auth.users(id),
  rationale text not null default '',
  created_at timestamptz not null default now(),
  check (production_cutover_approved = (decision = 'approved'))
);

alter table public.migration_import_receipts enable row level security;
alter table public.production_readiness_decisions enable row level security;

create policy migration_receipts_family_admin_read on public.migration_import_receipts
for select to authenticated using (public.current_org_role(organization_id) = 'group-admin');
create policy migration_receipts_family_admin_insert on public.migration_import_receipts
for insert to authenticated with check (public.current_org_role(organization_id) = 'group-admin' and created_by = auth.uid());
create policy readiness_group_admin_read on public.production_readiness_decisions
for select to authenticated using (public.current_org_role(organization_id) = 'group-admin');

revoke all on public.migration_import_receipts from anon;
revoke all on public.production_readiness_decisions from anon;
revoke insert, update, delete on public.production_readiness_decisions from authenticated;
grant select, insert on public.migration_import_receipts to authenticated;
grant select on public.production_readiness_decisions to authenticated;

comment on table public.migration_import_receipts is 'Idempotent source-to-target receipts for owner-controlled migration rehearsal and import.';
comment on table public.production_readiness_decisions is 'Owner-governed cutover decision records; automated clients have read-only access.';

commit;
