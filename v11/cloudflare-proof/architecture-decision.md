# ARCH-SPIKE-001 household-first architecture decision

Status: **PROVISIONAL ACCEPT for continued local proof** under #60. Hosted pilot and production migration remain separate decisions.

## Product boundary

Learning Harbor is currently an owner passion project intended to remain free for families and ultimately usable by the broader homeschool co-op community. Hosted resources should prefer the owner's personal Cloudflare account for now; LDW is not the product owner merely because LDW may help build or operate it. Any later LDW account access should use a named, scoped identity rather than shared credentials.

## Accepted data-authority model

1. **Household is the primary authority boundary.** A household exists without a co-op/organization.
2. **Adults are cloud principals; learners are parent-managed profiles by default.** Under-13 learner identity remains a separate product/security/legal gate.
3. **Co-op membership belongs to adults.** An instructor/admin relationship does not grant general household access.
4. **Learner visibility is purpose-scoped.** A learner becomes visible to a class only through an explicit household-controlled enrollment/share grant.
5. **Family records remain private by default.** Household work, attendance, evidence and adult review do not become co-op records merely because the learner is enrolled in a class.
6. **Class results cross the boundary deliberately.** Only class-scoped submissions/results are returned to the co-op path.
7. **Revocation stops future projection without erasing history.** Removing a share must stop future class projection/access while preserving household-authoritative records and already-submitted class history needed for audit/review.
8. **Conflicts are visible.** Divergent educational-record edits must return a conflict/current version; no silent last-write-wins.

## Technical shape selected for the next proof

```text
React/Vite PWA
  -> local household mirror
  -> durable offline operation queue
  -> provider-neutral repositories
  -> Cloudflare Worker API boundary
  -> D1 household/co-op data plane
```

R2 is optional future evidence-object storage only. Evidence should remain on-device by default, with D1 holding metadata/references. No automatic bulk media synchronization is part of this decision.

## Why D1 remains preferred

The local schema/proof demonstrates that the required household/co-op authority model fits relational D1 semantics without requiring a conventional school-SIS tenancy model. The current capacity model also leaves substantial room below the product's `<250 MB` working target at 100 families / 300 learners, although local scale seeding and query-metadata evidence must still replace estimates before #60 closes.

The free-tier design constraint is therefore **bounded/indexed access**, not database-per-family. A shared community database with strict household and class scopes is the current preferred topology.

## What is deliberately not decided

- production authentication provider;
- child/learner cloud login;
- hosted D1/R2 creation;
- custom domain/DNS;
- production rollout;
- paid Cloudflare plan;
- email/SMS provider;
- legal/compliance certification;
- whether every existing v11 Studio/support capability survives;
- final migration date away from Supabase.

## Exit criteria for this decision becoming implementation authority

Before replacing the current v11 remote stack, #60 still needs deterministic evidence for:

- scale-seeded local D1 capacity/query behavior;
- full household/co-op authorization matrix, including revocation;
- household-first offline queue/replay integration;
- South Carolina record-pack output/configuration proof;
- backup/export/migration/rollback implications;
- exact `KEEP / ADAPT / RETIRE` service disposition;
- green repository validation and exact-head review.

Until then, D1 is the preferred candidate, not an irreversible migration.
