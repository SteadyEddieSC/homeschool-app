# SCHED-PORT-001 — schedule forecast adaptation

Status: implementation candidate for issue #65

## Objective

Add a small pure TypeScript forecast layer on top of the accepted typed planner parity foundation. Parents continue recording actual completion history; the forecast derives future dates from current reality and never mutates authoritative completion records.

## Authority and data model

Learning Harbor terminology remains authoritative:

- `AcademicYear` — inclusive start/end boundary plus normal learning weekdays;
- `ForecastCourse` — one household learner, active state, meeting weekdays, ordered work items, and source authority;
- `CompletionLog` — authoritative actual completion date for one work item;
- `ForecastBreak` — inclusive household/global or learner-specific unavailable range;
- `SourceAuthority` — household or explicitly shared co-op source metadata preserved on projections;
- `CourseForecast` — derived state only.

The engine has no React, D1, Supabase, network, storage, or provider dependency.

## Scheduling rules

1. Work items remain in deterministic course order.
2. Completed items keep their actual completion dates regardless of planned order.
3. Remaining work begins at the later of `today` or academic-year start.
4. If an actual completion is today or later, the next remaining course item starts after that completion day; a completed course slot is not silently double-booked.
5. A planned date must be both an academic learning day and a course meeting day.
6. Household breaks apply to every learner; learner breaks apply only to the named learner.
7. One remaining work item is projected per valid course day.
8. Inactive courses and courses with no meeting days receive no manufactured dates.
9. Work that cannot fit before academic-year end remains explicitly unplanned; projected finish is unknown rather than fabricated.
10. No-work courses have no finish date. Fully completed courses finish on the latest actual completion date. Otherwise finish is the last derived planned date only when every remaining item fits.
11. Re-running with the same inputs produces the same result; weekend/future-week views therefore do not consume or double-count work.
12. `buildTodayReview` is a read-only household Today/review projection and preserves each item's household/co-op source authority.

## School Desk behavior comparison

Frozen donor: `mblayman/homeschool@3becaa83887b94b116ea2be2bb784a65783a3095` (MIT; notice in `docs/v11/THIRD_PARTY_NOTICES.md`).

| Upstream behavior | Decision | Learning Harbor adaptation |
| --- | --- | --- |
| ordered incomplete course tasks | **PORT** | ordered immutable `ForecastWorkItem[]`; completed IDs are removed only from derived remaining work |
| course/school days determine available schedule slots | **PORT** | intersection of academic learning days and per-course meeting days |
| school-year start/end bounds | **PORT** | explicit inclusive `AcademicYear` boundary |
| global and student-specific breaks | **PORT** | household and learner `ForecastBreak` ranges |
| actual coursework dates take precedence | **PORT** | immutable `CompletionLog`; actual dates are never overwritten by forecast |
| current-week unfinished work rolls forward | **ADAPT** | derive from `today` each run instead of persisting/advancing a task index |
| weekend/future-week task indexing | **ADAPT** | stateless whole-course projection makes repeated future views idempotent |
| future school year starts at actual year start | **PORT** | forecast cursor is `max(today, academicYear.startDate)` |
| Django ORM enrollment/task queries | **REJECT** | repositories supply plain input data; domain engine has no persistence dependency |
| school-owned learner authority | **REJECT** | household owns learner/work state; co-op authority is explicit per shared source only |
| server-rendered daily/week views | **REJECT** | pure `CourseForecast` plus `buildTodayReview`; UI is a later consumer |

## Required-case coverage

`src/domain/schedule-forecast.test.ts` proves:

- no work -> no projected finish;
- successive valid learning/course days;
- all-completed -> latest actual completion;
- future academic year starts at year start;
- inactive/unscheduled -> no fake dates;
- household break skip;
- learner-specific break isolation;
- current-week unfinished roll-forward;
- weekend/next-week idempotency;
- completing today deterministically moves future work;
- back-dated actual completion remains historical truth;
- household + co-op items coexist in Today while retaining source authority;
- identical inputs yield identical projections;
- academic-year exhaustion fails closed;
- malformed dates/completion references fail closed.

## Synthetic Today/review integration

This slice includes the required synthetic household Today/review path at the domain boundary. The test `preserves household and co-op source authority in the same Today projection` feeds two independently forecast courses into `buildTodayReview` and proves that household and explicitly shared co-op work can coexist on the same date without changing either item's source authority.

This is intentionally not a React or persistence integration. A later UI/repository binding may consume the same projection, but it must not duplicate scheduling rules outside this domain module.

## Explicit non-goals

- no automatic completion, attendance, grade, mastery, or planner mutation;
- no database schema or provider change;
- no curriculum/SIS expansion;
- no AI scheduling;
- no requirement that a co-op control unrelated household work;
- no production deployment or resource creation.
