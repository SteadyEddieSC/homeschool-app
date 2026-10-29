# Learning Harbor local Cloudflare data-plane proof

This is an isolated architecture spike. It is not wired into the v11 application runtime and has no D1/R2 provisioning step. The proof Worker refuses API requests unless `APP_ENV=local-proof`. The deterministic proof scripts run the Worker and D1 through **Miniflare in-process without opening a network port**; they do not require a Cloudflare account, token, remote database, R2 bucket, student identity, email provider, or real family data.

The repository has a pre-existing Cloudflare GitHub integration that may publish a PR preview when this branch changes. That preview side effect is separate from the proof commands below and is not evidence of a hosted D1 pilot. #60 still does not authorize remote D1/R2 creation, production DNS/domain changes, paid capacity, or account-access changes.

The synthetic `AdultIdentity` contract is a placeholder for a future authentication adapter. It deliberately does not claim production authentication, under-13 access, legal compliance, or co-op readiness.

## Run

From `v11/`:

```sh
npm install --no-package-lock
npm run d1:proof
```

`d1:proof` currently runs five bounded checks:

1. strict TypeScript validation of the isolated Worker/repository/domain adapter;
2. the core household → evidence review → explicit co-op share → class assignment/submission flow, including replay suppression, household isolation and visible stale-write conflict;
3. a share-revocation proof showing that a revoked class share stops future class projection without deleting household-authoritative work or already-submitted class history;
4. an offline-queue proof that reuses the existing v11 `SyncQueueManager` behavior: local state remains usable while offline, duplicate active fingerprints collapse, queued household/learner operations flush to D1 when connectivity returns, and D1 readback preserves identity without duplicate rows;
5. a deterministic 25/50/100-family scale proof that seeds fresh local D1 databases, measures the persisted local footprint, captures representative D1-compatible `rows_read` metadata, and asserts indexed Today/weekly-review/class-roster/annual-attendance query plans.

Each proof uses fresh temporary local state and removes it after the run.

## Architecture records

- `architecture-decision.md` records the provisional household-first authority model and the personal-Cloudflare ownership direction.
- `service-disposition.md` records `KEEP / ADAPT / RETIRE AFTER PARITY` decisions for the existing local, resilient and Supabase services.
- `backup-migration-plan.md` defines provider-neutral backup/restore, Supabase→D1 migration, rollback, archive, and idempotency-receipt retention gates before any provider retirement.
- `migrations/0001_household_first.sql` is the checked-in normalized D1 schema.
- `capacity-model.md` separates the conservative planning model from the measured local scale evidence.
- `npm run d1:capacity-model` regenerates the planning estimate; `npm run d1:capacity-proof` reruns the scale fixture independently.

Exact-head CI measured the 100-family / 300-learner / 380,082-row local fixture at about **70.7 MiB** persisted after disposal. Representative 100-family queries read 7 rows for a household Today view, 22 for a seven-day household work-log review, 21 for a class roster, and 541 for a 540-row annual household attendance result. All four query plans used the intended indexes. These are local Miniflare/D1 measurements, not production Cloudflare usage or billing telemetry.

## South Carolina record-pack boundary

The schema includes an optional `SC-home-study` configuration proof: a 180 instructional-day target plus fields indicating subject/activity diary, portfolio/evidence references, attendance and individualized progress tracking. This is a product configuration/schema proof only. It is not legal advice, legal compliance, certification, or a claim that the application replaces a family's responsibility to maintain required records.

## Product boundary

Learning Harbor is currently treated as a personal passion project intended to remain free to families and the co-op community. Future hosted resources should prefer the owner's personal Cloudflare account unless a later explicit decision changes ownership. LDW operational access, if needed later, should use a named/scoped identity rather than shared credentials.

The spike remains `$0` and synthetic-only. A hosted pilot, production authentication choice, child cloud identity, custom domain, migration, or production rollout requires a separate accepted decision.
