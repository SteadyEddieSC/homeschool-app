# v11 RC.1 Migration Rehearsal Runbook

## Purpose

This runbook validates the reviewed v10.43-to-v11 migration contract using repository-owned synthetic data. It is not a real-family migration procedure and does not authorize remote database writes, provider activation, or production cutover.

## Preconditions

- use the exact rc.1 source and dependency versions;
- confirm `v11/package.json` is `11.0.0-rc.1`;
- confirm v10.43 remains the stable pointer in `source/current-release.json`;
- do not add real exports, names, emails, learner work, credentials, sessions, or provider configuration;
- use only `v11/public/fixtures/v10.43-synthetic-export.json`;
- start with the isolated rehearsal storage cleared.

## Automated command-line evidence

From `v11/`:

```bash
npm install --no-package-lock
npm run typecheck
npm run check:boundaries
npm run migration:rehearse
npm run readiness:report
npm run vendor-exit:verify
npm run build
```

Expected sanitized evidence:

- `test-results/rc1/migration-rehearsal-report.json`
- `test-results/rc1/production-readiness-report.json`
- `test-results/rc1/vendor-exit-rehearsal-report.json`

The migration report must show:

- source release `10.43.0`;
- target release `11.0.0-rc.1`;
- `syntheticOnly: true`;
- `dryRunWrites: 0`;
- strict schema and credential-field rejection;
- isolated apply only;
- rollback checkpoint required;
- silent conflict overwrite false;
- live migration false;
- production cutover false.

The readiness report must remain:

- effective decision `not-ready`;
- `productionReady: false`;
- `automatedPromotionAllowed: false`;
- `productionDataEnabled: false`.

## Browser rehearsal

Start the local preview and open:

`/?migration-rehearsal=1`

Follow the displayed sequence:

1. **Load synthetic fixture** — validates exact schema, source limits, synthetic markers, relationships, dates, answers, and exclusions.
2. **Run dry-run** — generates deterministic operation classifications and must report zero writes.
3. **Review the plan** — confirm create, adult-review-required, unsupported, and conflict handling are explicit.
4. **Apply isolated plan** — writes only the rc.1 rehearsal namespace and creates sanitized receipts.
5. **Repeat apply** — must be idempotent and create no duplicate records.
6. **Rollback** — must restore the exact pre-apply checksum.
7. **Run encrypted vendor-exit round trip** — use a synthetic passphrase of at least 12 characters.
8. **Run full recovery rehearsal** — must report zero record loss and a measured local RTO.
9. **Evaluate readiness** — a production-ready request must be downgraded to not-ready.
10. **Download reports** — confirm they contain counts, IDs, decisions, and non-reversible digests only.

## Authority transformations

The rehearsal must not carry legacy authority forward silently:

- legacy completed items become `ready-for-review`;
- legacy accepted proof becomes `pending` adult re-review;
- objective knowledge-check scores remain informational;
- unsupported XP/gamification records are reported but not migrated;
- conflicts are preserved and never silently overwritten.

## Storage isolation

The rehearsal may use only:

- `beaufortLearningHarbor.v11.rc1.migrationRehearsal`
- `beaufortLearningHarbor.v11.rc1.migrationRollback`
- `beaufortLearningHarbor.v11.rc1.migrationReceipt`
- `beaufortLearningHarbor.v11.rc1.vendorExitRestore`

It must not modify normal v11 learning, studio, organization, session, queue, or Supabase data.

## Database rehearsal

Local Supabase validation must rebuild migrations `001–009` and run all pgTAP suites. Migration `009` must prove:

- synthetic source IDs only;
- source release fixed to `10.43.0`;
- `rehearsal_only = true`;
- authenticated clients cannot update or delete receipts;
- authenticated clients cannot create or modify production-readiness decisions;
- approved/cutover states are rejected;
- readiness RPC reports live migration, production data, and cutover false.

## Stop conditions

Stop immediately and do not apply or merge when:

- an input is not clearly synthetic;
- a source contains credentials, sessions, real names, learner work, or unknown fields;
- the dry-run changes storage;
- a conflict would be overwritten;
- repeat apply creates duplicates;
- rollback checksum differs;
- vendor-exit checksum differs or RPO is not zero;
- any report contains private content or secrets;
- a readiness result claims production-ready;
- v10.43 validation fails.

## Remote/provider boundary

The rc.1 rehearsal is complete without a provider. Remote verification is optional and owner-controlled. Do not apply migration `009`, deploy the preview Worker, or create provider resources unless the owner has created a dedicated non-production environment and explicitly authorized the bounded hosted-pilot step.
