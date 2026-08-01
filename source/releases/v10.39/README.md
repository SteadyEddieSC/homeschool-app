# Beaufort Learning Harbor v10.39

v10.39 is a foundation release that reduces release-builder coupling and adds explicit offline and visual regression contracts without redesigning the product.

## Included

- Reusable `modules/offline-runtime.mjs` request classification and ledger contract.
- Browser guard for external fetch, XHR, and beacon attempts.
- Browser-local offline readiness status in the existing synthetic-demo notice.
- Post-load offline workflow checks for learner routes and Family/Co-op Planner actions.
- Repeat-render screenshot comparisons for upper learner Home, lower learner Botany, Parent Planner, and Director Planner rollup surfaces.
- A dependency-aware v10.39-v10.48 roadmap.

## Preserved boundaries

- Deterministic single-file output.
- Browser-local and offline-first behavior.
- Existing role, route, reward, completion, attendance, mastery, portfolio, and source-record boundaries.
- No service worker, cloud dependency, telemetry, database, API, or external calendar integration.
- Optional print/binder support remains optional and never required for completion.
