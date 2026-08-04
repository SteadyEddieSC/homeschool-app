# v11.0.0-rc.1 — Migration Rehearsal and Production Readiness

## Release result

RC.1 adds a strict, synthetic-only rehearsal of the v10.43-to-v11 migration path and a measurable production-readiness decision process. It does not migrate real records, activate a provider, deploy a preview, approve production, or replace v10.43.

## Included

- one repository-owned `v10.43` synthetic export fixture;
- exact-schema parsing with source-size, record-count, relationship, date, answer, and seven-day-plan validation;
- rejection of malformed, unknown-field, credential-bearing, non-synthetic, and unsupported inputs;
- deterministic source-to-target identifiers and non-reversible SHA-256 evidence digests;
- explicit operation classifications: create, match, adult-review-required, conflict, and unsupported;
- legacy completion imported as awaiting explicit adult review;
- legacy accepted proof imported as pending explicit adult re-review;
- objective knowledge-check scores retained as informational evidence only;
- zero-write dry-run before any apply action;
- isolated browser rehearsal storage that cannot write the normal v11 local stores or Supabase;
- idempotent controlled apply with sanitized source-to-target receipts;
- exact-checksum rollback to the pre-apply state;
- encrypted AES-GCM/PBKDF2 vendor-exit export and restore rehearsal;
- local synthetic RTO/RPO measurement with zero-record-loss validation;
- migration `009` with synthetic-only import receipts, RLS, and an authenticated readiness-status RPC;
- database-enforced `rehearsal_only = true` and `production_cutover_approved = false` constraints;
- owner-blocked readiness reports separating automated evidence, provider checks, owner approvals, and residual risk;
- restoration of the complete beta.4 family, role, proof, planning, synchronization, conflict, diagnostic, backup, and privacy regression gates;
- desktop, touch-tablet, Pixel 7, database, preview-artifact, and unchanged v10.43 validation.

## Required boundaries

- synthetic rehearsal records only;
- no real names, family records, learner work, screenshots, exports, or backups in Git or CI;
- no passwords, sessions, provider tokens, service-role keys, OAuth secrets, or database credentials in application code, reports, receipts, logs, or artifacts;
- no remote Supabase migration, Cloudflare deployment, DNS change, hostname cutover, or production write;
- no automatic grades, mastery, attendance, XP, completion, portfolio approval, or subjective proof acceptance;
- Director and System Administrator roles do not automatically receive household learner access;
- conflicts are visible and never silently overwritten;
- v10.43 remains the stable production and downloadable fallback.

## Readiness decision

RC.1 can report that the local synthetic rehearsal gates pass, but it always keeps `productionReady` false and the effective decision `not-ready`. A request for production-ready is downgraded until all provider checks, privacy/legal approvals, security review, hosted backup/restore evidence, bounded pilot findings, incident/support ownership, and an explicit owner cutover decision are complete.

## Provider-dependent work not performed

- no Supabase project was created, linked, migrated, or remotely verified;
- no Cloudflare Worker or Pages project was deployed;
- no production SMTP, monitoring, alert routing, or abuse/rate-limit configuration was verified;
- no BAND, Google, Microsoft, or Apple integration was activated;
- no real-family pilot or v10.43 migration was performed.

## Next recommended release

`v11.0.0-rc.2 — Bounded Hosted Pilot and Defect Closure`.

RC.2 should only begin after the live repository is verified and the owner chooses whether to create the dedicated non-production Supabase and protected Cloudflare preview resources. It must remain a bounded pilot—not a production cutover.
