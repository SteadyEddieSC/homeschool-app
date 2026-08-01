# Beaufort Learning Harbor — 10-Release Roadmap

This roadmap covers v10.40 through v10.49. Stability, privacy, mobile behavior, deterministic offline delivery, console quietness, and bounded DOM activity remain release gates rather than cleanup work.

## v10.40 — App Shell and Role Policy Module

- Centralize role metadata, screen catalog membership, static route authorization, role defaults, and navigation-group definitions.
- Add fail-closed validation and full role-policy parity tests.
- Preserve current role behavior and dynamic Student permission checks.

## v10.41 — Learner Route and Assignment Resolver

- Extract learner-track routing and assignment-to-destination resolution.
- Add deterministic fallbacks for incomplete learner mappings, assignments, and destination records.
- Expand upper/lower learner regression matrices without changing public demo identities.

## v10.42 — Family Planner v2

- Add reusable week templates, duplicate-week and roll-forward support, workload balancing, conflict warnings, and clearer responsibility gaps.
- Add optional print/export views while keeping binder materials optional.
- Preserve non-destructive source links and no automatic completion or rewards.

## v10.43 — Lesson Pack Controlled Apply v1

- Add reviewed, reversible draft-to-live overlays with before/after comparison, selective approval, rollback, and audit notes.
- Preserve original source content and prohibit copied proprietary curriculum text.
- Keep media provenance, license review, and no-equipment alternatives visible during approval.

## v10.44 — Knowledge Check Delivery and Evidence Queue

- Turn approved prompt banks into learner-safe scheduled sessions.
- Support oral, written, notebook, project, discussion, and mastery-proof evidence queues.
- Keep subjective work human-reviewed with no automatic mastery approval.

## v10.45 — Portfolio and Records Reconciliation

- Connect approved lesson evidence, Knowledge Checks, projects, presentations, and notebook work.
- Add duplicate detection, missing-evidence warnings, reversible adult approval, and clearer distinctions among finished, reviewed, mastered, and included-in-records states.
- Improve exportable summaries without exposing private data in the public repository.

## v10.46 — Accessibility and Multi-Browser Expansion

- Add Firefox and WebKit regression projects for core learner and adult workflows.
- Tighten keyboard navigation, focus restoration, reduced-motion behavior, contrast, screen-reader labeling, and touch-target gates.
- Document browser-specific exceptions rather than silently weakening validation.

## v10.47 — Curriculum Source and Media Quality System

- Add an adult curriculum-source registry for family-provided booklists, reputable free/OER/public-domain/nonprofit/government sources, original materials, and AI-generated visuals.
- Track preliminary versus confirmed status, exact edition/ISBN, learner assignment, teacher-only versus consumable use, ownership/purchase status, pacing readiness, provenance, license review, alt text, and offline alternatives.
- Add broken-link, missing-edition, missing-media, and image-quality review queues.
- Use the preliminary 4th–6th grade booklist as an intake example without silently creating live pacing or assignments.

## v10.48 — Deployment, Recovery, and Release Hardening

- Add neutral production-domain readiness, optional protected previews, recovery drills, and verified rollback procedures.
- Add main-branch production reconciliation evidence without inferring production health from PR previews.
- Consolidate release manifests, artifact retention, checksum, operator, and recovery documentation.

## v10.49 — School-Year Rollover and Family Operations

- Archive a completed school year without deleting historical records.
- Carry forward selected courses, routines, supports, and unfinished work through explicit adult review.
- Promote learners or tracks without rewriting prior-year evidence.
- Create a reviewed new-year calendar, holidays, co-op days, flex weeks, and breaks.
- Export and restore a complete year archive before rollover.

## Cross-release rules

- Browser-local and offline-first remain the default architecture.
- Printable and binder materials remain optional support only.
- Student dashboards and the mobile dock remain focused.
- No route-only XP, silent completion, automatic attendance, automatic mastery, or destructive source rewrites.
- Real family exports, backups, screenshots, and identifying data never belong in the public repository or fixtures.
- Preliminary curriculum information must remain visibly unconfirmed until exact editions, learner assignments, and pacing are reviewed.
- Every release requires deterministic build, privacy, integrity, console stability, role, route, accessibility, desktop, tablet, and Pixel 7 gates.
