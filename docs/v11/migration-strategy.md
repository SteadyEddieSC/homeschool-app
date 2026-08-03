# v10.43 to v11 Migration Strategy

## Principle

Migration is additive, reviewed, and reversible. The v10.43 application remains usable until the corresponding v11 workflow and data have been validated. No browser-local family file is silently uploaded.

## Phases

### 1. Preserve the source

- Keep the validated v10.43 release artifact and checksum.
- Keep schema-1 v10.43 export/import behavior under regression coverage.
- Do not change the current release pointer while v11 is in alpha.

### 2. Map data contracts

For each v10.43 collection, classify it as:

- identity or membership;
- household or learner profile;
- active learning record;
- planning draft;
- evidence or portfolio record;
- support/operations record;
- obsolete compatibility state;
- local-only UI preference.

Every mapped collection requires a documented destination, transformation, privacy scope, and conflict rule.

### 3. Build a migration preview

An authorized adult selects a v10.43 portable export. The v11 importer must display:

- source app and schema version;
- household and learner counts;
- record counts by category;
- unsupported or legacy fields;
- records that would be created, linked, skipped, or flagged;
- privacy and organization destination;
- expected attachment gaps;
- a deterministic migration identifier.

Nothing is committed during preview.

### 4. Explicit controlled import

After adult confirmation, the server creates a migration transaction and audit record. Imported records retain source references so the operation can be reconciled or reversed without editing the original export.

### 5. Reconcile and verify

The migration report compares source counts with accepted, skipped, rejected, and unresolved records. A household must verify learner assignments and permissions before imported records become active shared data.

### 6. Roll back safely

Rollback deactivates or removes records created by that migration transaction when no later shared work depends on them. It does not delete the original v10.43 export or rewrite unrelated v11 records.

## What alpha 1 does

Alpha 1 creates the new source structure, role model, database foundation, and support workflow. It does not parse, upload, or migrate v10.43 data.

## Cutover criteria

The v11 platform cannot replace v10.43 until:

- primary student and adult workflows are simpler in usability review;
- v10.43 exports can be previewed and imported deterministically;
- role and household privacy policies are tested against real-world scenarios using synthetic accounts;
- backup and restore have been proven;
- production sign-in, invitation, recovery, and administrator MFA work;
- cloud and local draft behavior is clear during outages;
- a rollback plan has been rehearsed.
