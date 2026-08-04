# Beaufort Learning Harbor

Beaufort Learning Harbor is a homeschool and co-op learning application with two deliberately separated tracks.

## Stable production fallback — v10.43

The validated v10.43 application remains the production and downloadable baseline. It is an offline-first single-file application with role boundaries, learner routes, lesson planning, controlled lesson-pack overlays, family/co-op planning, portable data contracts, privacy protections, and desktop/tablet/mobile validation.

## Typed release candidate — v11.0.0-rc.1

The `v11/` directory contains the TypeScript, React, Vite, Cloudflare Worker, and optional-Supabase platform. RC.1 preserves the beta.4 hosted-repository, local-first queue, client-record-ID, proof-review, family-planning, conflict-reconciliation, encrypted-backup, and protected-deployment foundations while adding:

- one strict repository-owned synthetic v10.43 fixture and parser;
- deterministic migration planning with create, match, adult-review-required, conflict, and unsupported classifications;
- zero-write dry-run before an isolated apply;
- idempotent source-to-target receipts;
- exact-checksum rollback;
- encrypted vendor-exit export and restore rehearsal;
- measured local synthetic RTO/RPO evidence;
- migration `009` with synthetic-only RLS receipts and owner-blocked readiness metadata;
- production-readiness reports that always keep production, live migration, automated promotion, and cutover disabled.

RC.1 is fully usable for local synthetic rehearsal without a hosted project. It is not a real-family migration tool, provider activation, production deployment, or production approval. v10.43 remains unchanged and active.

## Repository layout

- stable v10 source, modules, fixtures, and tests at the repository root;
- `v11/src/` for typed identity, household learning, evidence, planning, synchronization, reconciliation, recovery, and migration rehearsal;
- `v11/public/fixtures/` for the single reviewed synthetic migration fixture;
- `v11/supabase/` for reviewed migrations and transaction-scoped policy tests;
- `v11/worker/` for the isolated preview Worker boundary;
- `docs/v11/` for architecture, activation, recovery, migration, readiness, learning authority, roadmap, and release documentation.

## Privacy and authority

Only synthetic data belongs in this public repository. Never commit family exports, student work, screenshots, backups, passwords, service-role keys, provider tokens, OAuth/BAND tokens, sessions, or private keys.

Objective scores are informational only. Subjective proof requires an explicit adult decision. Plans and migration do not silently create completion, grades, mastery, attendance, XP, or portfolio approval. Legacy completion and accepted proof require adult re-review. Divergent hosted or migration records are surfaced as conflicts instead of silently overwriting the local mirror.

## Next release

`v11.0.0-rc.2 — Bounded Hosted Pilot and Defect Closure`.

RC.2 should begin only after live repository verification and owner authorization for dedicated non-production provider resources. It must not automatically deploy or perform production cutover.
