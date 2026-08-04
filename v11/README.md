# Beaufort Learning Harbor v11

The `v11/` application is the consolidated TypeScript/React platform being developed beside the stable v10.43 single-file application.

## Current release

`v11.0.0-rc.1 — Migration Rehearsal and Production Readiness`

RC.1 preserves:

- parent-managed learners and supervised learner handoff;
- Today assignment and explicit adult review workflows;
- deterministic objective knowledge checks;
- revision-preserving subjective proof and adult accept/return decisions;
- bounded seven-day household planning;
- application-owned local persistence;
- ordered retryable hosted operations with stable operation and record IDs;
- Supabase repositories for household learning and learning-studio records;
- conflict-aware reconciliation that preserves divergent local records;
- encrypted backup and restore preview;
- a secret-safe pilot doctor, authenticated schema verifier, and sanitized operational diagnostics.

RC.1 adds:

- one strict repository-owned synthetic v10.43 migration fixture;
- exact-schema, credential-aware, synthetic-only parsing;
- deterministic migration plans and explicit operation classifications;
- adult re-review for legacy completion and accepted proof;
- zero-write dry-run;
- isolated, idempotent, reversible browser apply;
- exact-checksum rollback;
- encrypted vendor-exit export/restore and local synthetic RTO/RPO evidence;
- migration `009` with synthetic-only receipts and cutover-denial constraints;
- an owner-blocked production-readiness report.

It does not create or configure the owner’s Supabase or Cloudflare account, apply remote migrations automatically, deploy automatically, migrate real v10.43 data, approve production, or replace v10.43.

## Local development

```bash
cd v11
npm install --no-package-lock
npm run dev
```

Add `?sync-sim=1` to exercise the persistent synchronization queue without transmitting data.

Open `?migration-rehearsal=1` to use the synthetic rc.1 migration and recovery workspace. That workspace is restricted to the rc.1 rehearsal storage namespace and cannot write the normal v11 application stores or Supabase.

## Validation

```bash
npm run verify
npm run pilot:doctor   # expected exit code 2 until provider settings exist
npm run db:start
npm run db:reset
npm run db:test
npm run db:stop
npx playwright install chromium
npm run test:e2e
```

`npm run verify` performs TypeScript, consolidated architecture/privacy/secret/authority checks, synthetic migration evidence, owner-blocked readiness evidence, vendor-exit integrity, and the production build.

## Synthetic migration rehearsal

The authoritative source fixture is:

`public/fixtures/v10.43-synthetic-export.json`

The rehearsal must:

1. validate the strict synthetic source;
2. create a zero-write deterministic plan;
3. show create, match, adult-review-required, conflict, and unsupported outcomes;
4. apply only to isolated rehearsal storage;
5. remain idempotent on repeat apply;
6. restore the exact pre-apply checksum;
7. complete an encrypted vendor-exit round trip;
8. report zero record loss;
9. keep production readiness false.

Do not add a second fixture, parser, migration script, store, or competing migration path.

## Optional hosted activation

Hosted activation remains explicit and owner-controlled:

1. The owner creates a dedicated non-production Supabase project.
2. Review a dry run, then apply migrations `001–009` in non-production only.
3. Create synthetic adult pilot accounts.
4. Configure the protected `v11-preview` GitHub environment.
5. Run `npm run pilot:doctor` and `npm run pilot:verify-schema` from the protected environment.
6. Manually dispatch **Deploy v11 Preview** with `DEPLOY_V11_PREVIEW`.

The deployment workflow refuses to continue when the browser key is privileged, migration `009` is absent, the authenticated readiness RPC is unavailable, live migration/cutover is enabled, or the Worker target is not the isolated v11 preview.

No hosted activation has occurred merely because these scripts and workflows exist.

## Learning authority

- Objective checks are scored only from explicit answer keys.
- Scores are informational and do not create grades, mastery, attendance, XP, completion, or portfolio approval.
- Subjective proof requires an adult Accept or Return decision.
- Returned proof keeps its revision and feedback.
- Weekly planning never completes learner work.
- Legacy completion and accepted proof require explicit adult re-review during migration.
- Hosted and migration reconciliation never silently overwrite divergent records.

## Documentation

See:

- `docs/v11/release-v11.0.0-rc.1.md`
- `docs/v11/migration-rehearsal-runbook.md`
- `docs/v11/production-readiness-checklist.md`
- `docs/v11/hosted-preview-runbook.md`
- `docs/v11/evidence-and-planning.md`
- `docs/v11/roadmap-v11-beta.md`
- `docs/v11/new-chat-handoff-after-rc1.md`
