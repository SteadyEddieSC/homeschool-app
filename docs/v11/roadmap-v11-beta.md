# Beaufort Learning Harbor v11 Roadmap

v10.43 remains the stable production and downloadable fallback until a separate owner-approved cutover. No v11 milestone in this document authorizes provider activation, real-family migration, DNS changes, or production promotion by itself.

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

Status: completed.

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

## v11.0.0-rc.1 — Migration Rehearsal and Production Readiness

Status: current release candidate.

- strict repository-owned synthetic v10.43 export fixture and exact-schema parser;
- malformed, unknown-field, credential-bearing, oversized, non-synthetic, and unsupported input rejection;
- deterministic source mapping and explicit create/match/adult-review/conflict/unsupported classifications;
- legacy completion and proof acceptance routed to explicit adult re-review;
- zero-write dry-run and isolated, idempotent, reversible browser apply;
- exact-checksum rollback and encrypted vendor-exit restore rehearsal;
- measured local synthetic RTO/RPO evidence;
- migration `009` with synthetic-only receipts, RLS, and authenticated readiness metadata;
- database-enforced live-migration, production-data, and cutover denial;
- owner-blocked production-readiness decision record;
- complete beta.4 regression preservation across family workflows, roles, synchronization, proof, planning, diagnostics, backups, and privacy;
- desktop, touch-tablet, Pixel 7, database, artifact, and stable-v10 regression coverage.

RC.1 is not a real migration utility and is not production approval. Provider activation remains optional and owner-controlled.

## v11.0.0-rc.2 — Bounded Hosted Pilot and Defect Closure

Recommended next release.

- create or link one dedicated non-production Supabase project only after owner authorization;
- apply and verify migrations `001–009` in non-production;
- configure the protected `v11-preview` GitHub environment and isolated Cloudflare preview Worker;
- use synthetic accounts first, then a very small owner-approved pilot only after privacy and security prerequisites are complete;
- validate sign-up, recovery, invitations, parent-managed learners, Today, knowledge checks, proof review, plans, offline queue, conflict handling, diagnostics, and encrypted backup/restore against the hosted environment;
- measure provider-backed RTO/RPO, quotas, rate limits, email delivery, monitoring, alerts, and shutdown/rollback;
- record defects, close release-blocking findings, and produce a go/no-go decision package;
- keep v10.43 active and preserve a tested rollback path;
- do not perform production migration, hostname cutover, or automatic promotion.

## Later production decision

A production release should be considered only after rc.2 evidence is complete, privacy/legal and security reviews are approved, support and incident ownership are assigned, backup/restore and vendor-exit exercises pass, residual risks are accepted, and the owner records an explicit cutover decision. Production should remain a separate release and approval event.
