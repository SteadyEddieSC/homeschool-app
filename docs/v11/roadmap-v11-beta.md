# Beaufort Learning Harbor v11 Beta Roadmap

This roadmap keeps v10.43 as the stable production and downloadable fallback until a separate production-cutover decision is approved.

## v11.0.0-beta.1 — Parent-Managed Learners and Today Workflow

Status: current release candidate.

Purpose: prove one complete family workflow without requiring learner email accounts.

- parent-managed household learner profiles;
- supervised parent-assisted device handoff;
- bounded Today assignments;
- learner start and review submission;
- explicit adult complete or return decision;
- family-scoped Row-Level Security;
- no automatic learning outcomes.

## v11.0.0-beta.2 — Hosted Household Pilot, Offline Queue, and Recovery

Recommended next release.

Purpose: prove that beta.1 works safely in the owner-controlled hosted preview and remains understandable when connectivity is unreliable.

- create and configure the protected hosted Supabase preview;
- manually deploy only the isolated v11 preview Worker;
- show last successful synchronization and current connection state;
- add a bounded retryable offline mutation queue for supported household actions;
- prevent duplicate assignment or review transitions during retry;
- add exportable preview backup and documented restore verification;
- add deployment and migration receipts without storing secrets;
- run a small household pilot using synthetic or disposable records;
- capture usability findings by Parent and Learner workflow.

Beta 2 must not migrate v10.43 records or replace production.

## v11.0.0-beta.3 — Evidence, Knowledge Checks, and Family Planning

Purpose: begin moving validated learning functions into the new architecture after the hosted household workflow is stable.

- objective quiz/test delivery and tool scoring;
- subjective proof/evidence submission and adult review;
- weekly household planning and learner assignment views;
- explicit feedback and return-for-revision loops;
- no hidden XP, mastery, grade, attendance, or portfolio outcomes;
- compatibility mapping for future v10.43 import without importing real data yet.

## v11.0.0-rc.1 — Migration Rehearsal and Production Readiness

Purpose: rehearse migration and recovery without committing to production cutover.

- versioned v10.43 import adapter using synthetic exports;
- dry-run, validation, reconciliation, and rollback reports;
- backup and restore exercise;
- accessibility and living-room/mobile usability review;
- privacy, authorization, audit, and rate-limit review;
- owner-approved production checklist.

## Production cutover decision

Production replacement is a separate owner decision after:

1. hosted preview validation;
2. household pilot findings are resolved;
3. offline and recovery tests pass;
4. migration rehearsal is reversible;
5. v10.43 remains available as a fallback;
6. the owner explicitly approves the production target and data migration.
