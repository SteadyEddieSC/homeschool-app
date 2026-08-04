# Beaufort Learning Harbor v11 Beta Roadmap

This roadmap keeps v10.43 as the stable production and downloadable fallback until a separate production-cutover decision is approved.

## v11.0.0-beta.1 — Parent-Managed Learners and Today Workflow

Status: completed.

Purpose: prove one complete family workflow without requiring learner email accounts.

- parent-managed household learner profiles;
- supervised parent-assisted device handoff;
- bounded Today assignments;
- learner start and review submission;
- explicit adult complete or return decision;
- family-scoped Row-Level Security;
- no automatic learning outcomes.

## v11.0.0-beta.2 — Offline Queue, Recovery, and Preview Readiness

Status: current release candidate.

Purpose: make the beta.1 household workflow resilient without requiring the hosted Supabase project yet.

- application-owned local mirror;
- visible Local only, Offline, Pending, Failed, and Synced states;
- bounded retryable mutation queue;
- stable operation IDs and semantic duplicate prevention;
- database idempotency receipts for Today transitions;
- explicit Retry, Cancel, and Clear completed controls;
- synchronization disabled while signed out;
- encrypted portable local-preview backup;
- integrity verification and restore preview;
- local emergency pre-restore snapshot;
- hosted-preview deployment and migration readiness without automatic deployment.

Beta 2 does not create a hosted project, migrate v10.43, or replace production.

## v11.0.0-beta.3 — Evidence, Knowledge Checks, and Family Planning

Recommended next release.

Purpose: move validated learning and planning workflows into the typed architecture after the household flow is resilient.

- objective quiz/test delivery and deterministic tool scoring;
- subjective proof/evidence submission and adult review;
- explicit return-for-revision and feedback loops;
- weekly household planning and learner assignment views;
- queue contracts for supported evidence and planning mutations;
- no hidden XP, mastery, grade, attendance, or portfolio outcomes;
- compatibility mapping for future v10.43 import without importing real data yet.

## v11.0.0-beta.4 — Hosted Pilot and Operational Recovery

Purpose: connect the owner-controlled preview when Supabase setup is convenient.

- create and configure the protected hosted Supabase preview;
- manually deploy only the isolated v11 preview Worker;
- apply reviewed migrations after a dry run;
- exercise the beta.2 queue during interruptions;
- verify hosted backup and restore procedures;
- collect sanitized Parent, Learner, and Administrator pilot findings;
- resolve hosted usability and operational defects.

## v11.0.0-rc.1 — Migration Rehearsal and Production Readiness

Purpose: rehearse migration and recovery without committing to production cutover.

- versioned v10.43 import adapter using synthetic exports;
- dry-run, validation, reconciliation, and rollback reports;
- backup and restore exercise;
- accessibility and living-room/mobile usability review;
- privacy, authorization, audit, and rate-limit review;
- owner-approved production checklist.

## Recommended next action

When convenient, create the non-production Supabase project, review `supabase db push --dry-run`, and use beta.2 synchronization and recovery during a bounded hosted household pilot. This action can happen before or after beta.3; it does not block continued local development.

## Production cutover decision

Production replacement is a separate owner decision after:

1. hosted preview validation;
2. household pilot findings are resolved;
3. offline and recovery tests pass;
4. migration rehearsal is reversible;
5. v10.43 remains available as a fallback;
6. the owner explicitly approves the production target and data migration.
