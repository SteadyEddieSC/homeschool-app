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

Status: current release.

- deterministic multiple-choice and true/false checks;
- informational per-question tool results;
- subjective proof with preserved revisions;
- explicit adult accept/return decisions;
- accepted proof completes the reviewed Today item;
- seven-day household plans and learner-specific plan items;
- queue and encrypted-backup coverage for beta.3 records;
- controlled beta.2 backup import;
- hosted beta.3 writes intentionally deferred.

## v11.0.0-beta.4 — Hosted Pilot and Operational Recovery

Recommended next release.

- create and configure the owner-controlled non-production Supabase project;
- add hosted repositories for checks, attempts, evidence, reviews, plans, and plan items;
- apply reviewed migrations `001–007` after a dry run;
- deploy only the isolated v11 preview Worker through the protected manual workflow;
- exercise interruption, retry, duplicate, backup, restore, and audit procedures;
- collect sanitized Parent, Learner, and Administrator pilot findings;
- resolve hosted usability and operational defects.

## v11.0.0-rc.1 — Migration Rehearsal and Production Readiness

- synthetic v10.43 import adapter and dry-run reports;
- reconciliation and rollback rehearsal;
- accessibility, mobile, privacy, authorization, audit, and rate-limit review;
- owner-approved production checklist.

## Recommended next action

Continue beta.3 local validation. Supabase setup remains optional until the hosted beta.4 pilot.
