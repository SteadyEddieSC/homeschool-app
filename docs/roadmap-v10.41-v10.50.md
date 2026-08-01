# Beaufort Learning Harbor — 10-Release Roadmap

This roadmap covers v10.41 through v10.50. Stability, privacy, mobile behavior, deterministic offline delivery, console quietness, bounded DOM activity, and route/role parity remain release gates rather than cleanup work.

## v10.41 — Learner Route and Assignment Resolver

- Centralize learner normalization, assignment applicability, completion-aware next-item selection, direct assignment destinations, and safe route fallbacks.
- Add deterministic handling for incomplete learner, assignment, and destination mappings.
- Preserve current Jordan/Avery route outcomes and all reward/record boundaries.

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

## v10.50 — Reviewed Curriculum Intake to Year Plan

- Turn confirmed curriculum-source records into a proposed year-plan package with explicit adult review.
- Show purchase gaps, shared versus consumable materials, teacher-only resources, learner assignment, semester/full-year placement, and pacing readiness.
- Compare proposed pacing against school-year breaks, co-op days, flex weeks, and workload limits before controlled apply.
- Keep preliminary or missing-edition sources out of live assignments and required student work.
- Preserve reversible planning and require a complete backup before any year-plan apply step.

## Cross-release rules

- Browser-local and offline-first remain the default architecture.
- Printable and binder materials remain optional support only.
- Student dashboards and the mobile dock remain focused.
- No route-only XP, silent completion, automatic attendance, automatic mastery, or destructive source rewrites.
- Real family exports, backups, screenshots, and identifying data never belong in the public repository or fixtures.
- Preliminary curriculum information must remain visibly unconfirmed until exact editions, learner assignments, and pacing are reviewed.
- Every release requires deterministic build, privacy, integrity, console stability, role, route, accessibility, desktop, tablet, and Pixel 7 gates.
