# SCHED-PORT-001 planner parity slice

Status: implementation candidate for issue #65

## Purpose

This first slice promotes the existing Learning Harbor `family-planner-v2` domain behavior into the v11 TypeScript domain without adding new scheduling/forecast behavior yet.

The source baseline is the Learning Harbor-owned v10.42 implementation in `modules/family-planner-v2.mjs` and its existing Node regression tests. This slice intentionally does **not** copy or derive implementation source from School Desk.

## Scope

Promoted behavior:

| Existing planner behavior | TypeScript parity proof |
| --- | --- |
| active-only reusable templates | `creates a normalized reusable template from active items only` |
| additive/idempotent template application | `applies templates additively, deterministically, and idempotently` |
| source-preserving duplicate with lineage | `duplicates a week without mutating source or duplicating linked copies` |
| roll-forward as explicit carryover, archived exclusion | `rolls active work forward as explicit carryover and skips archived work` |
| same-week copy fails closed | `fails closed on same-week copying` |
| workload/conflict/co-op responsibility diagnostics | `detects overloads, target-aware conflicts, and co-op responsibility gaps` |
| unrelated learners do not conflict | `does not create false conflicts between unrelated learners` |
| learner-safe export redacts private/adult notes | `redacts adult-only and arrival notes from learner-safe print and CSV` |
| dangerous-key and duplicate-ID rejection | `fails closed on dangerous keys and duplicate template IDs` |

## Boundaries

- Pure TypeScript domain code under `v11/src/domain`.
- No React dependency in the planner module.
- No D1 or Supabase calls.
- No provider/resource creation or hosted mutation.
- No real learner/family data; tests use synthetic fixtures only.
- No automatic completion, attendance, grade, mastery, or authoritative schedule mutation.
- Existing v10.43 fallback/release artifacts remain unchanged.
- No School Desk source is copied in this slice.

## External provenance status

The planned forecast donor remains `mblayman/homeschool` commit `3becaa83887b94b116ea2be2bb784a65783a3095`, whose repository license at that commit is MIT (Copyright (c) 2019 Matt Layman).

That donor is **not materially used by this parity-only slice**, so no MIT-derived source notice is introduced here. Before a later forecast slice copies or substantially derives code/test expressions, that slice must record exact source files/tests used and preserve the required MIT notice.

## Next slice after acceptance

Only after this parity layer is green and independently accepted should #65 add the missing pure `schedule-forecast` behavior: academic-year bounds, course meeting days, household/learner breaks, actual-completion anchored projection, unfinished-work roll-forward, unscheduled-course handling, and deterministic projected finish dates.
