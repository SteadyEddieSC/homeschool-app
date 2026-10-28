# Free-tier capacity model (first estimate)

This is a reproducible **planning model**, not a measurement from a deployed database. Run `npm run d1:capacity-model` to regenerate the row counts and byte estimates. The local D1 workflow proof currently seeds a small two-household example; the 25/50/100-family scale fixture and query-metadata capture remain follow-up work before accepting capacity.

## Workload assumptions

- Two adults and three learners per family.
- One school year, six family courses per learner, and 180 family work items, work logs, and attendance rows per learner.
- Thirty evidence references and adult reviews per learner per year.
- Two co-op class enrollments per learner, with 30 shared sections per 100 families, 12 class assignments per section, and 24 class submissions per learner.
- One compact idempotency receipt per domain write; receipts are a capacity-sensitive retention decision.
- Evidence binaries stay outside D1. This estimate includes metadata only.

## Estimated scale

| Families | Learners | Modeled rows | Logical row bytes | Estimated database bytes* |
|---:|---:|---:|---:|---:|
| 25 | 75 | 95,035 | 20.3 MB | 27.4 MB |
| 50 | 150 | 190,042 | 40.6 MB | 54.7 MB |
| 100 | 300 | 380,082 | 81.1 MB | 109.5 MB |

\* Estimated bytes apply per-table row-width assumptions plus a 35% allowance for SQLite framing and indexes. It is not a measured D1 database size. The current 100-family estimate is below the issue's `<250 MB` working target and the current 500 MB Free per-database maximum, but local scale seeding and D1 query `meta` measurements are still required before that target is treated as demonstrated.

## Representative query and write budgets

These are modeled result/affected-row counts, not Cloudflare's metered `rows_read` or `rows_written`. D1 can scan more rows than it returns when an index is absent; on deployment, use its query `meta` and analytics to measure actual scans.

| Workload at 100 families | Expected result/affected rows | Access path to validate |
|---|---:|---|
| Household Today, one date | ~300 family items plus up to ~600 shared-class items in a busy release window | `work_items_by_household_day`; `class_enrollments_by_household`; class/date index on assignments |
| One household's weekly review | ~36 work-log, attendance, evidence, and review rows; ~3,600 across 100 separate household queries | household/date, learner/date, and household/evidence indexes |
| All co-op class rosters | ~600 enrollments total at 20 learners × 30 sections | `enrollments_by_class` |
| All learner attendance for an annual report | ~54,000 attendance rows across all 100 families | `attendance_by_household_date` |
| Typical school day writes | ~900 domain rows for three learners × attendance, work completion, and status update; receipts/indexes add overhead | batched mutations and bounded receipt retention |

The free-plan published limits currently allow 5 million rows read/day, 100,000 rows written/day, and 500 MB per D1 database; the account-wide free storage allowance is 5 GB. D1 rejects queries once daily read/write limits are exceeded, so this product should retain margin and use observed query metadata instead of treating limits as targets.

## Index and query notes

- Household Today filters on both `household_id` and `due_on`; `work_items_by_household_day` supports that path and avoids scanning other households.
- Co-op Today starts from active enrollments for one household, then uses a class/date access path for assigned items.
- Weekly review and annual reports should always constrain by household, learner, and/or date. Do not expose unbounded family history in a daily view.
- Class roster queries are class-scoped and use the active enrollment index.
- Evidence metadata uses small text/object references. Object bytes, photos, and other files require a later separately authorized storage decision; they are not included in the D1 size model.
- Each index improves filtering but also adds write and storage cost. Validate the actual query plans/metadata before adding more indexes.

## Free-tier operation and retention

The 100-family row model is not the main free-tier risk. The missing proof is actual D1 storage/query telemetry and how long idempotency receipts must remain to cover long-offline clients. Do not delete unacknowledged receipts. A receipt compaction/archive policy needs an explicit replay horizon, backup/export evidence, and a tested recovery rule before it can be implemented.

The Cloudflare Free plan stops D1 queries after daily limits are exceeded. A paid plan would be a separate owner decision; no upgrade or paid usage is part of this spike.
