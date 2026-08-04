# Beaufort Learning Harbor v11 Beta Roadmap

v10.43 remains the stable production and downloadable fallback until a separate owner-approved cutover.

## v11.0.0-beta.1 — Parent-Managed Learners and Today Workflow

Status: completed.

- parent-managed learner profiles;
- supervised device handoff;
- bounded Today assignments;
- learner submission and explicit adult complete/return decisions;
- family-scoped authorization.

## v11.0.0-beta.2 — Offline Queue, Recovery, and Preview Readiness

Status: completed.

- application-owned local mirror;
- visible synchronization states;
- ordered retryable mutation queue;
- stable operation IDs and duplicate prevention;
- idempotent Today transition receipts;
- encrypted backup, restore preview, and emergency rollback snapshot.

## v11.0.0-beta.3 — Evidence, Knowledge Checks, and Family Planning

Status: completed.

- deterministic multiple-choice and true/false checks;
- informational per-question tool results;
- subjective proof with preserved revisions;
- explicit adult accept/return decisions;
- accepted proof completes the reviewed Today item;
- seven-day household plans and learner-specific plan items;
- queue and encrypted-backup coverage for beta.3 records;
- controlled beta.2 backup import.

## v11.0.0-beta.4 — Hosted Pilot Readiness and Operational Recovery

Status: current release.

- hosted Supabase repositories for household and learning-studio records;
- stable client operation IDs and preservation of local record IDs;
- local-first queued writes that remain disabled while signed out;
- conflict-aware studio reconciliation with no silent overwrite;
- non-reversible local/hosted conflict digests and explicit acknowledgement;
- migration `008` and authenticated hosted schema-status verification;
- secret-safe pilot doctor and protected manual deployment workflow;
- sanitized operational diagnostic and deployment receipts;
- encrypted backup compatibility with beta.2 and beta.3;
- desktop, touch-tablet, Pixel 7, database, and stable-v10 regression coverage.

Provider activation remains an owner action. The release is complete locally and ready for a bounded non-production pilot once the Supabase project and protected GitHub environment exist.

## v11.0.0-rc.1 — Migration Rehearsal and Production Readiness

Recommended next release.

- synthetic v10.43 import adapter and dry-run reports;
- import reconciliation and rollback rehearsal;
- hosted-pilot findings and defect closure;
- accessibility, mobile, privacy, authorization, audit, backup, and rate-limit review;
- recovery-time and recovery-point validation;
- vendor-exit export and restore rehearsal;
- owner-approved production checklist and explicit cutover decision.

## Recommended next action

Continue local beta.4 validation. When convenient, create the dedicated non-production Supabase project, apply migrations `001–008` after reviewing the dry run, configure the protected `v11-preview` GitHub environment, and perform the bounded hosted pilot. No production cutover is implied.
