# Household-first backup, migration, rollback, and receipt-retention plan

Status: **architecture-spike recovery contract** under #60. This is planning/acceptance authority only; it does not authorize a hosted D1 database, Supabase deletion, real-data migration, production cutover, or destructive compaction.

## Recovery principle

The household must be able to recover its learning record without depending on a live provider. D1 is a synchronization/community data plane, not the only copy that makes the household record intelligible.

The long-term recovery order should therefore be:

1. portable household export/backup;
2. local application restore and validation;
3. explicit cloud rehydration/synchronization when a provider is configured;
4. selective re-establishment of co-op shares where those relationships are still valid.

A restore must never require possession of a Supabase or Cloudflare service credential embedded in the backup.

## Provider-neutral export contract

Before D1 can replace the existing Supabase remote path, the backup/export contract must represent the accepted household-first model independently of either provider.

Minimum export groups:

- manifest: schema/version, generated-at time, application release, deterministic integrity hashes;
- adults and household membership references needed to reconstruct authority without exporting authentication secrets;
- households;
- parent-managed learners;
- academic years and courses/subjects;
- family work/activity items and work logs;
- attendance;
- evidence metadata/references and adult review decisions;
- co-op/organization references needed by the household;
- explicit class enrollment/share grants and their active/revoked state;
- intentionally shared class submissions/results returned to the household record;
- pending local sync operations needed to avoid losing offline work;
- enough acknowledgement/replay metadata to prevent a restored client from silently duplicating already-applied operations.

Do not export passwords, OAuth tokens, API keys, provider service credentials, recovery codes, or other authentication secrets.

Binary evidence remains a separate explicit object/export concern. A metadata backup must clearly distinguish a locally retained original, a portable included object, and a remote-only reference so restore cannot imply that missing binary content was preserved.

## Restore contract

Restore is **local first**.

A valid restore must:

1. validate schema/version and integrity before mutation;
2. support dry-run/report mode;
3. reject or quarantine malformed authority relationships rather than silently widening access;
4. reconstruct household-owned records before co-op projections;
5. preserve revoked share state and historical class submissions without recreating future access automatically;
6. restore pending offline operations without changing their operation IDs/fingerprints;
7. surface conflicts instead of overwriting a newer local/cloud record silently;
8. produce a receipt summarizing imported/skipped/conflicted records;
9. leave the pre-restore local state recoverable until the restore is accepted.

Cloud rehydration is a later explicit step. A local restore must remain useful when no D1, R2, Supabase, email provider, or child cloud identity exists.

## Supabase -> household-first D1 migration posture

No in-place destructive provider migration is authorized.

The accepted future migration pattern is **export -> transform/dry-run -> validate -> shadow/new-provider load -> compare -> explicit cutover**, while the old remote implementation remains available for rollback.

The transform must classify every old organization-rooted record rather than assuming `organizationId == householdId` universally.

Safe automatic mappings may be accepted only where the old data proves a single household authority unambiguously. Ambiguous organization/community records must be reported for explicit mapping; they must not be silently converted into a household or granted household visibility.

Required migration evidence before cutover:

- source export hash and schema/version;
- deterministic transform version;
- entity counts before/after by type;
- authority/share mapping report;
- skipped/quarantined/conflicted record report;
- D1 import receipt;
- representative household and class readback comparisons;
- backup/restore rehearsal from the resulting household-first export;
- rollback rehearsal to the pre-cutover application/provider state.

Because the current v11 hosted path is not accepted production authority, migration work should stay synthetic until a separately authorized pilot exists.

## Rollback rule

Supabase adapters and migration tooling remain **RETIRE AFTER PARITY**, not deleted during #60.

A future cutover is reversible only when:

- the pre-cutover provider/data snapshot remains intact and read-only or otherwise recoverable;
- the portable household export has passed restore validation;
- D1 import/readback has passed exact-candidate checks;
- no new writes are allowed to diverge across two claimed authorities without an explicit synchronization rule;
- the rollback procedure states which provider becomes authoritative and how post-cutover writes are handled.

Do not call a rollback safe if it would discard writes created after cutover.

## Idempotency receipt retention

The scale proof shows `sync_operations` is the dominant long-term row class: the 100-family fixture contains 188,891 receipts out of 380,082 total rows. Receipt retention therefore needs a product rule before multi-year operation.

Safety rules:

- never compact a pending, failed, or otherwise unacknowledged operation;
- never change an operation ID/fingerprint merely to reduce storage;
- retain enough accepted replay history to make restored/offline clients safe;
- compact only after the replay horizon is explicitly defined and tested;
- take/validate a portable export before destructive receipt compaction;
- preserve a deterministic summary/archive record sufficient to distinguish an acknowledged historical operation from a never-seen operation if the replay design requires that distinction;
- test restore + replay against the compaction policy before enabling it.

No arbitrary 30/60/90-day retention number is accepted by this spike. The correct horizon depends on the eventual device/offline model and must be proven rather than guessed.

## Archive strategy

The local 100-family one-school-year fixture is ~70.7 MiB, comfortably below the current working target, so #60 does not need a premature database-sharding design.

Prefer, in order:

1. bounded indexed current-school-year queries;
2. safe receipt compaction after replay-horizon proof;
3. portable household/year export;
4. read-only historical archive only when measured multi-year storage/query behavior justifies it.

Do not split one active household across databases merely to optimize a hypothetical future scale problem.

## Exit gates before Supabase retirement

Supabase remote adapters may be removed only after an exact reviewed candidate proves all of the following:

- production domain contracts are household-first and provider-neutral;
- local/offline queue uses those contracts;
- D1 adapter reaches required family + selective co-op parity;
- provider-neutral export includes the household-first authority model;
- local restore and integrity/readback pass;
- synthetic Supabase-to-D1 migration dry-run and rollback pass;
- receipt retention/compaction rule is accepted and tested;
- v10.43 remains available as the immutable legacy fallback until a later explicit release decision changes that posture;
- no hidden Supabase runtime dependency remains in the selected Cloudflare path.

Until those gates pass, D1 is the preferred next data-plane candidate and Supabase remains compatibility/reference code rather than dead code.
