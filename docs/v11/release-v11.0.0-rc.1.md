# v11.0.0-rc.1 — Migration Rehearsal and Production Readiness

## Release result

RC.1 provides a deterministic, synthetic-only rehearsal of the v10.43-to-v11 migration path and an owner-governed production-readiness record. It does not migrate real records or authorize a cutover.

## Included

- synthetic v10.43 export fixture;
- deterministic source-to-target IDs and rollback receipts;
- blocked-record reporting with no silent coercion;
- migration receipt schema and RLS;
- production readiness decision schema that defaults to `not-approved`;
- vendor-exit checksum and restore rehearsal;
- RTO/RPO evidence for the synthetic package;
- desktop, tablet, mobile, database, and stable-v10 regression gates.

## Required boundaries

- no real family or learner information;
- no production provider resources, migrations, writes, deployments, DNS, or hostname changes;
- no automatic approval or promotion;
- no inferred grades, mastery, attendance, completion, XP, or subjective evidence decisions;
- v10.43 remains the stable fallback.

## Owner decision

RC.1 is not production-approved. A bounded hosted pilot, independent privacy/security review, provider backup/restore test, accessibility review, rate-limit observation, and explicit owner cutover decision remain required.

## Next recommended release

`v11.0.0-rc.2 — Bounded Hosted Pilot Findings and Cutover Decision`.
