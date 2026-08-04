# v11.0.0-beta.4 — Hosted Pilot Readiness and Operational Recovery

## Release objective

Beta 4 turns the beta.3 local household workflow into a hosted-pilot-ready platform without creating provider accounts, applying remote migrations automatically, deploying automatically, migrating v10.43 data, or replacing production.

## Delivered capabilities

### Hosted learning repositories

- Supabase repositories for knowledge checks, attempts, evidence revisions, proof reviews, weekly plans, and plan items.
- Existing hosted repositories for organizations, households, learners, Today items, and support remain in place.
- One ordered queue executor handles household and studio operations.
- Every retry reuses the original operation ID.
- Objective attempts preserve the local record ID in the hosted database.

### Conflict-aware reconciliation

- Hosted studio reads reconcile with the application-owned local mirror.
- Identical semantic records accept the hosted representation.
- Remote-only records enter the local mirror.
- Local-only records remain local.
- Divergent records remain local and create a visible conflict instead of being overwritten.
- Active queued records do not create premature conflicts.
- Conflict reports contain only record identifiers and non-reversible semantic digests, not learner content.

### Operational readiness

- `pilot:doctor` validates configuration presence, browser-key privilege, migration ordering, URL boundaries, and isolated Worker targeting.
- `pilot:verify-schema` authenticates with a synthetic adult account, checks migration `008` through an authenticated status RPC, writes a sanitized report, and signs out.
- The protected deployment workflow remains manual-only and requires the exact `DEPLOY_V11_PREVIEW` selection.
- Deployment verifies the remote schema before Wrangler runs and verifies the deployed health/configuration boundary afterward.
- Sanitized doctor, schema, health, configuration, and deployment receipts are retained as workflow artifacts.

### Recovery

- Beta.4 encrypted backups include application-owned local learning and queue records.
- Valid beta.2 and beta.3 backups remain importable after preview.
- Restore still requires checksum verification, decryption, record-count verification, preview, and explicit confirmation.
- Hosted conflict diagnostics are excluded from learning backups.
- The application can download a separate sanitized pilot-diagnostic report without record content or queue payloads.

## Database changes

Migration `202608040008_v11_hosted_pilot.sql` adds:

- `submit_knowledge_attempt_v2(...)`, which preserves the local attempt UUID and remains idempotent by operation receipt;
- `hosted_pilot_schema_status()`, an authenticated non-sensitive capability/status RPC;
- explicit grants and revocations for both functions;
- audit metadata confirming client record-ID preservation.

No table grants expose direct client writes to knowledge attempts or proof-review decisions.

## Authority boundaries retained

- Objective scores are informational only.
- Subjective proof is never tool-approved.
- Adults explicitly accept or return proof.
- Weekly plans do not complete learner work.
- Director and System Administrator roles do not automatically gain household learner access.
- Independent learner authentication remains disabled.
- No automatic grade, mastery, attendance, XP, completion, or portfolio approval is introduced.

## Provider-dependent work intentionally deferred

The repository does not:

- create the owner’s Supabase or Cloudflare accounts;
- choose or change the Supabase project region;
- accept provider terms;
- create or approve email/OAuth/BAND applications;
- store provider secrets;
- apply migrations to a remote project without an owner-reviewed command;
- deploy the preview without protected manual authorization;
- enable production data or cut over the v10 hostname.

## Validation target

The release must pass:

- strict TypeScript and exact dependency checks;
- architecture, authority, secret, backup, reconciliation, and deployment-boundary checks;
- migrations `001–008` rebuilt from an empty local database;
- identity, household, Today, studio, hosted-pilot, audit, idempotency, and RLS tests;
- desktop, touch-tablet, and Pixel 7 browser workflows;
- safe missing-provider pilot-doctor behavior;
- beta.4 preview artifact generation;
- unchanged v10.43 foundation, browser, and single-file artifact validation.

## Production status

Beta 4 is not a production release. v10.43 remains the stable production and downloadable fallback. A hosted preview may be activated later only through the owner-controlled runbook.

## Next release

`v11.0.0-rc.1 — Migration Rehearsal and Production Readiness`.
