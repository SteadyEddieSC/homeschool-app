# Beaufort Learning Harbor v10.39.1

v10.39.1 is a narrowly scoped production-stability hotfix for the merged v10.39 release.

## Fixes

- Restores the missing `VERSION` binding in the retained learning-path title updater.
- Stops the repeated `ReferenceError: VERSION is not defined` console failure.
- Reconciles all portable export product versions to `10.39.1`.
- Preserves the historical v10.39 offline-runtime release-note identity.
- Retires nine obsolete pre-v10.24 MutationObserver loops after their initial render pass.
- Retires fifteen legacy startup polling loops after their initial render pass while preserving event handlers and current observers.
- Adds a browser regression that fails on uncaught page errors, recurring legacy apply warnings, or excessive post-load DOM mutations.

## Preserved boundaries

- Deterministic standalone HTML delivery.
- Browser-local and offline-first behavior.
- Existing Student, Parent, Teacher, Director, and Admin role boundaries.
- Existing learner routes, data schemas, Knowledge Check, Lesson Pack, Family Planner, reward, completion, attendance, mastery, portfolio, and source-record behavior.
- No cloud account, database, API, telemetry, service worker, external calendar integration, redesign, or v10.40 feature work.

## Exact artifact

- File: `beaufort_learning_harbor_v10_39_1.html`
- Bytes: `5,458,813`
- SHA-256: `ccff18b6249b4b9942f1f07bde331d7895ccd4de38238589154a8a54e3a90a85`
