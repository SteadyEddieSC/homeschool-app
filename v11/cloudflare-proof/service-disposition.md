# v11 service disposition for the household-first D1 direction

Status: architecture-spike decision record under #60. This is not deletion authority and does not change the v10.43 fallback.

## Decision rule

The Cloudflare-native direction should reuse the proven local/offline/recovery ideas from v11, but it must not preserve the old assumption that a household or learner exists only inside an organization. Household authority is the root; co-op access is selective federation.

`KEEP` means the responsibility survives substantially as-is. `ADAPT` means the responsibility survives but its contract/data authority must change. `RETIRE AFTER PARITY` means keep the current implementation available until the replacement is independently proven and migration/rollback is accepted.

| Existing surface | Disposition | Reason / required change |
|---|---|---|
| `src/services/local-backup.ts` and `local-backup-beta3.ts` | **KEEP / ADAPT** | Local export/recovery remains a product invariant. Extend the backup contract to household-first IDs and future D1 sync metadata without making cloud state mandatory for restore. |
| `src/services/local-learning.ts` | **ADAPT** | Keep a local learning mirror, but remove mandatory `organizationId` ownership from household/learner records. Household IDs become the primary authority boundary. |
| `src/services/local-organization.ts` | **ADAPT** | Keep co-op/class local state, but organization membership is an adult relationship and learner visibility must come from explicit class enrollment/share grants. |
| `src/services/resilient-learning.ts` | **ADAPT** | Preserve local-first writes, queued synchronization, duplicate-fingerprint protection, and background refresh. Replace organization-rooted refresh/mutation contracts with household-first repositories plus explicit co-op projections. |
| `src/services/resilient-studio.ts` | **ADAPT / DEFER** | Preserve conflict-aware resilient editing where it maps to accepted product workflows; do not carry forward studio complexity merely because it exists. |
| `src/services/studio-conflicts.ts` | **KEEP CONCEPT / ADAPT CONTRACT** | Visible conflict resolution is required. #60 already proves a version conflict instead of silent last-write-wins; converge this helper on the household-first operation model later. |
| `src/services/supabase-learning.ts` | **RETIRE AFTER PARITY** | Do not delete in #60. D1 becomes the preferred remote learning data-plane candidate only after household/co-op workflow parity, offline replay, migration, backup and rollback are accepted. |
| `src/services/supabase-organization.ts` | **RETIRE AFTER PARITY** | Organization/co-op capability survives, but the Supabase implementation should not remain the long-term authority if D1 proves the free Cloudflare path. |
| `src/services/supabase-studio.ts` and other Supabase remote adapters | **RETIRE AFTER PARITY / DEFER** | Preserve until replacement coverage is explicit. Do not port low-value studio/admin features before the family + co-op core is proven. |
| `src/services/local-support.ts` and support/admin surfaces | **DEFER** | Support tooling is not part of the #60 minimum product workflow and should not shape the data-plane architecture. |
| current sync queue / operation model | **KEEP / ADAPT** | Preserve durable operation IDs, fingerprints, replay suppression and retry visibility. Re-key payloads around household authority and class-scoped sharing rather than organization ownership. |
| v10.43 single-file application | **KEEP UNCHANGED** | Remains the stable fallback while v11 architecture changes. No migration may make v10.43 unavailable as the recovery path during this spike. |

## Required convergence before deleting Supabase code

1. Household and learner contracts no longer require organization ownership.
2. Local mirror and D1 adapter expose equivalent family work, attendance, evidence and adult-review behavior.
3. Explicit class sharing, revocation and class-only result return are covered by deterministic tests.
4. Offline operations replay idempotently and surface divergent-edit conflicts.
5. Export/backup/restore covers household-first records and any sync metadata needed for recovery.
6. A migration rehearsal from the accepted pre-D1 v11 model has a tested rollback.
7. Exact-head review confirms no hidden Supabase dependency remains in the selected Cloudflare path.

Until those conditions are met, the existing Supabase implementation is compatibility/reference code, not dead code.

## Product implication

The desired long-term shape is:

`PWA/local mirror + offline queue -> provider-neutral household/co-op repositories -> Worker API -> D1`

R2 remains optional and explicit for uploaded evidence. The normal family workflow must remain useful without R2, a child cloud identity, telemetry, advertising, or a paid service.
