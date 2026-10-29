# Free-tier capacity model and local scale evidence

This document separates the planning model from deterministic **local Miniflare/D1 measurements**. It is not production Cloudflare billing/usage telemetry. Run `npm run d1:capacity-model` to regenerate the planning estimates and `npm run d1:capacity-proof` to generate fresh local 25/50/100-family fixture evidence. The full `npm run d1:proof` chain includes the scale proof in CI.

## Workload assumptions

- Two adults and three learners per family.
- One school year, six family courses per learner, and 180 family work items, work logs, and attendance rows per learner.
- Thirty evidence references and adult reviews per learner per year.
- Two co-op class enrollments per learner, with 30 shared sections per 100 families, 12 class assignments per section, and 24 class submissions per learner.
- One compact idempotency receipt per domain write; receipts are a capacity-sensitive retention decision.
- Evidence binaries stay outside D1. The fixture includes metadata only.

## Planning model vs measured local fixture

Exact-head CI on 2026-10-28 generated the same modeled row counts in fresh persisted local D1 databases and measured the resulting Miniflare persistence footprint after disposal.

| Families | Learners | Rows | Planning estimate | Measured local persisted bytes | Measured local MiB |
|---:|---:|---:|---:|---:|---:|
| 25 | 75 | 95,035 | 27.4 MB | 20,600,024 | 19.6 MiB |
| 50 | 150 | 190,042 | 54.7 MB | 39,675,264 | 37.8 MiB |
| 100 | 300 | 380,082 | 109.5 MB | 74,167,944 | 70.7 MiB |

The 100-family / 300-learner one-school-year fixture is therefore well below the issue's `<250 MB` current-learning-database working target and below the currently researched 500 MB Free per-database ceiling. This is strong local feasibility evidence, not a guarantee that production D1 storage will byte-match Miniflare.

The planning estimate intentionally remains more conservative than the measured local fixture. Do not replace it with the lower local number when forecasting production capacity.

## Representative query evidence at 100 families

The scale proof executes representative indexed queries after seeding all 380,082 rows. Miniflare's D1-compatible `rows_read` metadata and SQLite query plans reported:

| Workflow | Returned rows | Local rows read | Query-plan evidence |
|---|---:|---:|---|
| Household Today, one date | 3 | 7 | `work_items_by_household_day` |
| One household, seven-day work-log review | 21 | 22 | covering `work_logs_by_household_time` |
| One co-op class roster | 20 | 21 | covering `enrollments_by_class` |
| One household annual attendance report | 540 | 541 | covering `attendance_by_household_date` |

The measured access paths remain bounded by household/class/date rather than scanning the 100-family dataset. Production D1 query metadata must still be observed during a later separately authorized hosted pilot; local Miniflare evidence is not represented as production metering.

## Row/write shape

At 100 families the deterministic fixture contains, among other rows:

- 54,000 work items;
- 54,000 work logs;
- 54,000 attendance rows;
- 9,000 evidence references;
- 9,000 adult reviews;
- 600 active class enrollments;
- 7,200 class submissions;
- 188,891 idempotency receipts.

The receipt table is deliberately large because the model retains one receipt per domain write. That makes **receipt retention/compaction**, not the core household entities, the clearest long-term storage-pressure decision. Never delete receipts that may still be needed by offline clients merely to save space.

## Index and query notes

- Household Today filters on both `household_id` and `due_on`; `work_items_by_household_day` is proven in the local query plan.
- Weekly review constrains household and time; `work_logs_by_household_time` is used as a covering index.
- Class roster access is class-scoped and uses `enrollments_by_class` as a covering index.
- Annual attendance constrains household/date and uses `attendance_by_household_date` as a covering index.
- Co-op Today should continue to start from active household enrollments and then use bounded class/date assignment access.
- Evidence binaries remain outside D1; photos/files require a later separately authorized storage decision and quota model.
- Each additional index has write/storage cost. Add indexes only against observed product queries.

## Free-tier operation and retention

Current product research records a Free-plan planning envelope of 5 million D1 rows read/day, 100,000 rows written/day, 500 MB per database, and 5 GB account-wide storage. Re-check official Cloudflare limits immediately before any hosted pilot rather than treating those values as permanent product constants.

The local 100-family fixture demonstrates a credible capacity path, but archive/retention policy still needs explicit design. Before Supabase retirement or a real community pilot, define and test:

1. the maximum offline replay horizon;
2. when an idempotency receipt becomes safe to compact/archive;
3. backup/export coverage before compaction;
4. recovery behavior after archive/restore;
5. graceful behavior when daily read/write quotas approach exhaustion.

A paid Cloudflare plan remains a separate owner decision. No paid usage or remote D1/R2 resource is part of this architecture spike.
