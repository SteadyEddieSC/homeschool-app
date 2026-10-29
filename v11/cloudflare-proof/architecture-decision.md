# ARCH-SPIKE-001 household-first architecture decision

Status: **CANDIDATE CORRECTION pending fresh independence-clean exact-head re-review** under #60. The prior exact-head review returned `CHANGES_REQUIRED` on class-role authorization; the bounded correction preserves the selected household-first Cloudflare/D1 direction while proving that ordinary co-op membership is not equivalent to instructor/admin class authority. Hosted pilot, production authentication, production migration, and provider retirement remain separate decisions.

## Product boundary

Learning Harbor is currently an owner passion project intended to remain free for families and ultimately usable by the broader homeschool co-op community. Hosted resources should prefer the owner's personal Cloudflare account for now; LDW is not the product owner merely because LDW may help build or operate it. Any later LDW account access should use a named, scoped identity rather than shared credentials.

## Accepted data-authority model

1. **Household is the primary authority boundary.** A household exists without a co-op/organization.
2. **Adults are cloud principals; learners are parent-managed profiles by default.** Under-13 learner identity remains a separate product/security/legal gate.
3. **Co-op membership belongs to adults.** An instructor/admin relationship does not grant general household access.
4. **Learner visibility is purpose-scoped.** A learner becomes visible to a class only through an explicit household-controlled enrollment/share grant.
5. **Family records remain private by default.** Household work, attendance, evidence and adult review do not become co-op records merely because the learner is enrolled in a class.
6. **Class results cross the boundary deliberately.** Only class-scoped submissions/results are returned to the co-op path.
7. **Revocation stops future projection without erasing history.** Removing a share stops future class projection/access while preserving household-authoritative records and already-submitted class history.
8. **Conflicts are visible.** Divergent educational-record edits return a conflict/current version; no silent last-write-wins.

## Selected technical shape

```text
React/Vite PWA
  -> local household mirror
  -> durable offline operation queue
  -> provider-neutral repositories
  -> Cloudflare Worker API boundary
  -> D1 household/co-op data plane
```

R2 remains optional future evidence-object storage only. Evidence should remain on-device by default, with D1 holding metadata/references unless a household explicitly uploads an object. No automatic bulk media synchronization is part of this decision.

## Feasibility evidence now demonstrated

The local proof chain demonstrates:

- household A cannot enumerate household B records;
- an instructor can read deliberately shared class results but cannot query the household Today surface;
- an ordinary co-op `member` cannot create classes, create class assignments, or read class submissions/results merely from organization membership;
- a parent cannot share another household's learner;
- class assignments project into a household only through an active explicit enrollment/share;
- revoking a class share removes future class projection while retaining household work and already-submitted class history;
- class records exclude unrelated household work/evidence;
- repeated operation IDs replay idempotently and conflicting reuse is rejected;
- divergent edits return a visible version conflict;
- the existing v11 `SyncQueueManager` can queue household-first operations offline, collapse active duplicate fingerprints, flush through the Worker/D1 adapter when connectivity returns, and preserve identity on readback;
- optional South Carolina record-pack fields exist as configuration/schema evidence without claiming legal compliance;
- backup/export, non-destructive Supabase->D1 migration, rollback, archive, and receipt-retention implications are explicitly reconciled in `backup-migration-plan.md`;
- existing local/resilient/Supabase services have explicit `KEEP / ADAPT / RETIRE AFTER PARITY` dispositions;
- no real family data, remote D1/R2 resource, provider credential, or paid service is required by the proof.

## Measured local capacity evidence

Deterministic Miniflare/D1 fixtures now replace the earlier estimate-only gap:

| Families | Learners | Rows | Persisted local size |
|---:|---:|---:|---:|
| 25 | 75 | 95,035 | ~19.6 MiB |
| 50 | 150 | 190,042 | ~37.8 MiB |
| 100 | 300 | 380,082 | ~70.7 MiB |

At 100 families the representative local D1-compatible `rows_read` values are 7 for Household Today, 22 for a seven-day household work-log review, 21 for a class roster, and 541 for a 540-row annual household attendance result. All four query plans use the intended indexes.

These are local feasibility measurements, not production Cloudflare billing/usage telemetry. The conservative planning model remains useful for production margin.

## Why D1 remains preferred

The proof demonstrates that the required household/co-op authority model fits relational D1 semantics without requiring a conventional school-SIS tenancy model. The measured 100-family fixture is well below the product's `<250 MB` current-learning-database working target, while representative household/class/date queries remain tightly indexed.

The free-tier design constraint is therefore **bounded/indexed access + explicit retention**, not database-per-family. A shared community database with strict household and class scopes remains the preferred first topology.

The scale proof also shows that idempotency receipts are the dominant long-term row class. Receipt compaction must therefore be designed around a proven offline replay horizon rather than an arbitrary age threshold.

## What this spike deliberately does not decide

- production authentication provider;
- child/learner cloud login;
- per-instructor class-assignment administration beyond the demonstrated role/privacy boundary;
- the production share-revocation command/API and its authorization policy; this spike proves revocation data semantics, while the mutation surface and who may invoke it remain a later implementation gate;
- hosted D1/R2 creation;
- custom domain/DNS;
- production rollout;
- paid Cloudflare plan;
- email/SMS provider;
- legal/compliance certification;
- whether every existing v11 Studio/support capability survives;
- final migration date away from Supabase.

Those are implementation/pilot decisions, not reasons to keep the local architecture feasibility question open.

## Gates before replacing the current v11 remote stack

Acceptance of this spike does **not** authorize immediate Supabase deletion or production migration. Before provider replacement:

1. production v11 domain/repository contracts must converge on the accepted household-first model;
2. local mirror/offline queue and D1 adapter must reach the required family + selective-co-op workflow parity;
3. provider-neutral export/restore must pass integrity/readback tests;
4. synthetic provider migration and rollback rehearsals must pass;
5. receipt retention/compaction policy must be tested against the accepted offline replay model;
6. production authentication/privacy controls must be accepted before real under-13 cloud use;
7. a separately authorized hosted pilot must collect production-provider telemetry without real-data scope creep;
8. exact-candidate review must confirm no hidden provider dependency remains before old adapters are removed.

## Review disposition

The corrected architecture candidate should be re-reviewed as a **feasibility decision**, not as a finished production migration. If fresh exact-head CI remains green and independence-clean re-review finds no material gap, #60 can close with D1 selected as the implementation direction and the remaining production-convergence work routed into the next bounded issue.