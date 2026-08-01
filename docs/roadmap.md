# Beaufort Learning Harbor Roadmap

## Completed release foundation

### v10.32 — Mobile Dock Stabilization

Completed: one authoritative student mobile dock with stable Learn, Practice, Quiz/Test, Proof, and Feedback actions; legacy competing dock creators neutralized; role visibility preserved.

### v10.33 — Repository and Demo Foundation

Completed:

- Sanitized immutable v10.32 baseline and reproducible release builder
- Full Playwright, mobile-dock, visual-capture, and axe-core CI
- Deterministic Load Demo Family and Reset Demo Data behavior
- Persistent public-demo privacy explanation and browser-local scenario status
- Versioned current-release manifest and downloadable CI artifact
- GitHub issue/PR release workflow

### v10.33.1 — Hero and Home Stability Patch

Completed:

- One authoritative hero/title owner
- Idempotent recurring title and hero writes
- Automated multi-second mutation watch
- Stable five-action mobile dock and demo controls
- Cloudflare Workers Static Assets deployment

### v10.34 — Route and Role Regression Coverage

Completed:

- Student navigation coverage for Learn, Practice, Quiz/Test, Proof, and Feedback
- Upper- and lower-learner route targets
- Parent/Teacher/Director/Admin role-boundary checks
- Student denial of adult-only screens
- Direct-screen and return-to-Home tests
- Desktop, tablet, and Pixel 7 viewport matrix

### v10.34.1 — Mobile Destination Stability Patch

Completed:

- Stopped source-media gallery and visual-model self-rebuild loops
- Preserved destination-screen, visual-model, and mobile-dock node identity after routing
- Added Pixel 7 destination width and mutation stability checks

### v10.35 — Versioned Data Adapter

Completed:

- Schema-1 application-data envelope independent from product version
- Deterministic normalization, migration, and round trips
- Sanitized full-state export and fail-closed import
- Legacy raw-state and demo-fixture migration coverage
- Expanded privacy validation

### v10.36 — Knowledge Check Builder v1

Completed:

- Adult-only recitation, discussion, notebook, project, oral tell-back, and mastery-proof authoring
- Student-safe preview without adult notes or approval language
- Deterministic prompt-bank export/import
- Parent/Teacher/Admin editing, Director rollup, and Student denial
- No auto-grading for subjective work

### v10.37 — Lesson Pack Editor v1

Completed:

- Ordered lesson-section editor
- Separate practice and lab/project prompts
- Subject, learner-track, week, and destination targeting
- Media-needs and source/license checklist
- Before/after preview without live apply
- Complete no-equipment path fields
- Deterministic lesson-pack draft export/import
- Non-destructive migration from existing Curriculum Studio draft stores
- Parent/Teacher/Admin editing, Director rollup, and Student denial

### v10.38 — Family/Co-op Planner v1

Completed:

- Monday-Friday weekly planning board
- Learner, learner-track, day, type, and status filters
- Standard, catch-up, flex, co-op-heavy, and break/light modes
- Optional co-op event, location, responsibility, materials, arrival, and follow-up fields
- Safe source seeding from Assignments and Lesson Packs
- Linked, non-destructive carryover
- Shortcuts into Schedule, Pacing, Mission Planner, Assignments, Lesson Packs, Year Plan, and Insights
- Deterministic planner package export/import
- Parent/Teacher/Admin editing, Director rollup, and Student denial

## Current release

### v10.39 — Modularization and Offline Regression Foundation

Current scope:

- Reusable offline/runtime request-classification and ledger module
- External fetch, XHR, and beacon blocking before dispatch
- Browser-local offline-readiness status
- Explicit post-load network-disabled learner and adult workflow tests
- Repeat-render screenshot comparison baselines for high-risk learner and role routes
- Deterministic single-file release preserved
- No product redesign or role/reward/source behavior changes

Boundaries:

- No cloud account, database, API, telemetry, service worker, or external calendar dependency
- No feature removals or broad visual redesign
- No automatic completion, XP, attendance, mastery, portfolio approval, or destructive source rewrite
- No cross-project infrastructure changes

## Next planned release

### v10.40 — App Shell and Role Policy Module

Planned:

- Extract screen catalog, role visibility, route authorization, and navigation-group policy
- Replace duplicated role deny lists with one authoritative tested source
- Add role-policy parity tests across Student, Parent, Teacher, Director, and Admin
- Preserve the existing navigation design and public role behavior

## Maintained 10-release roadmap

See `docs/roadmap-v10.39-v10.48.md` for the bounded sequence through:

- App-shell and role-policy extraction
- Learner-route resolution
- Family Planner v2
- Controlled Lesson Pack apply
- Knowledge Check delivery and evidence queues
- Portfolio and records reconciliation
- Accessibility and multi-browser expansion
- Content and media quality controls
- Deployment, recovery, and release hardening
