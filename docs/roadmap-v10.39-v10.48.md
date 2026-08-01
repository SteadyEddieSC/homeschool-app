# Beaufort Learning Harbor — 10-Release Roadmap

This roadmap covers v10.39 through v10.48. Each release is intentionally bounded so stability, privacy, mobile behavior, and deterministic offline delivery remain release gates rather than cleanup work.

## v10.39 — Modularization and Offline Regression Foundation

- Extract reusable offline/runtime contract logic from release-specific builder code.
- Add explicit network-blocked/offline workflow tests.
- Add visual screenshot-comparison baselines for high-risk learner and role routes.
- Preserve the deterministic single-file artifact and all existing behavior.

## v10.40 — App Shell and Role Policy Module

- Extract screen catalog, role visibility, route authorization, and navigation-group policy into a tested module.
- Replace duplicated adult/student deny lists with one authoritative policy source.
- Add policy parity tests across Student, Parent, Teacher, Director, and Admin.

## v10.41 — Learner Route and Assignment Resolver

- Extract learner-track routing and assignment-to-destination resolution.
- Add deterministic fallback behavior when assignments, destinations, or learner mappings are incomplete.
- Expand upper/lower learner regression matrices without changing existing public identities.

## v10.42 — Family Planner v2

- Add reusable week templates, duplicate-week support, workload balancing, conflict warnings, and clearer responsibility gaps.
- Add optional print/export views while keeping binder output optional.
- Preserve non-destructive source links and no automatic completion or rewards.

## v10.43 — Lesson Pack Controlled Apply v1

- Add a reviewed, reversible draft-to-live overlay flow with before/after diff, explicit approval, rollback, and audit notes.
- Preserve original source content and prohibit copyrighted curriculum copying.
- Keep no-equipment paths and media-license review visible during approval.

## v10.44 — Knowledge Check Delivery and Evidence Queue

- Turn approved prompt banks into scheduled learner-safe check sessions.
- Add oral, written, notebook, project, and mastery-proof evidence queues.
- Keep subjective work human-reviewed with no automatic mastery approval.

## v10.45 — Portfolio and Records Reconciliation

- Connect approved lesson evidence, knowledge checks, projects, and presentations into a clearer records workflow.
- Add duplicate detection, missing-evidence warnings, and reversible adult approval states.
- Improve exportable summaries without exposing private data in the public repository.

## v10.46 — Accessibility and Multi-Browser Expansion

- Add Firefox and WebKit regression projects for core routes and adult workflows.
- Tighten keyboard navigation, focus restoration, reduced-motion behavior, contrast, and touch-target checks.
- Establish browser-specific exception documentation rather than silently weakening gates.

## v10.47 — Content and Media Quality System

- Add an adult media/source registry for reputable free, OER, public-domain, nonprofit, and government resources.
- Add license/source metadata, alt-text completeness, image-quality checks, and broken-link review queues.
- Support original or AI-generated visuals with explicit provenance fields and no required external loading.

## v10.48 — Deployment, Recovery, and Release Hardening

- Add neutral production-domain readiness, optional protected preview, recovery drills, and release rollback verification.
- Add main-branch production reconciliation evidence without inferring production health from PR previews.
- Consolidate release manifests, artifact retention guidance, and operator recovery documentation.

## Cross-release rules

- Browser-local and offline-first remain the default architecture.
- Printable or binder materials remain optional support only.
- Student dashboards and the mobile dock remain focused.
- No route-only XP, silent completion, automatic attendance, automatic mastery, or destructive source rewrites.
- Real family data never belongs in the public repository or test fixtures.
- Every release requires deterministic build, privacy, integrity, role, route, accessibility, desktop, tablet, and Pixel 7 gates.
