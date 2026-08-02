# Beaufort Learning Harbor v10.42

## Family Planner v2

This release extends the existing adult-only Family/Co-op Planner with reusable, browser-local planning operations and clearer weekly risk signals.

### Added

- Reusable week templates saved locally in the planner workspace.
- Additive template application with linked-item duplicate prevention.
- Duplicate active items into another loaded week without overwriting existing work.
- Roll active items forward as explicit carryover while preserving the source week.
- Workload counts by weekday and learner/track target.
- Target-aware time-overlap warnings.
- Co-op responsibility-gap warnings for missing role or follow-up ownership.
- Optional learner-safe print preview and CSV export.
- Explicit exclusion of adult-only notes and arrival/handoff notes from learner-safe output.
- Dedicated Node, static-integrity, privacy, desktop, touch-tablet, and Pixel 7 coverage.

### Preserved boundaries

- Planner operations do not complete assignments or change XP, coins, grades, attendance, mastery, portfolio approval, Lesson Pack state, or source records.
- Source weeks and existing target-week items remain intact.
- No automatic calendar synchronization or network dependency is introduced.
- Print and binder material remains optional support only.
- Student denial and Director read-only behavior remain unchanged.
- Preliminary curriculum records remain planning input only and do not become live pacing.

### Artifact contract

- File: `beaufort_learning_harbor_v10_42.html`
- Bytes: `5,528,816`
- SHA-256: `82a3c5cf3a2eaee855c2e4eb63f1b9def9242480c55a2214fee13c239b95e405`
- Family Planner schema: `1`
- Family Planner v2 operations schema: `1`
