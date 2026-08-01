# Beaufort Learning Harbor v10.39.1

v10.39.1 is a narrowly scoped production-stability hotfix for the merged v10.39 release.

## Fixes

- Restores the missing `VERSION` binding in the retained learning-path title updater.
- Stops the repeated `ReferenceError: VERSION is not defined` console failure.
- Reconciles all portable export product versions to `10.39.1`, including Family Planner.
- Preserves the historical v10.39 offline-runtime release-note identity.
- Retires nine obsolete pre-v10.24 MutationObserver loops after their initial render pass.
- Retires fifteen legacy startup polling loops after their initial render pass while preserving event handlers and current observers.
- Makes retained v10.29 media-manager class cleanup idempotent so already-tagged images and hidden tools are not rewritten continuously.
- Adds browser regression coverage that fails on uncaught page errors, recurring legacy apply warnings, or excessive post-load DOM mutations and reports the highest-volume mutation targets.

## Preserved boundaries

- Deterministic standalone HTML delivery.
- Browser-local and offline-first behavior.
- Existing Student, Parent, Teacher, Director, and Admin role boundaries.
- Existing learner routes, data schemas, Knowledge Check, Lesson Pack, Family Planner, reward, completion, attendance, mastery, portfolio, and source-record behavior.
- No cloud account, database, API, telemetry, service worker, external calendar integration, redesign, or v10.40 feature work.

## Exact artifact

- File: `beaufort_learning_harbor_v10_39_1.html`
- Bytes: `5,458,940`
- SHA-256: `7c2e4496ac7da0fdb3e5d8a581a5b2693a6f2d95eb72bbd66347fb587ec1b5f4`
