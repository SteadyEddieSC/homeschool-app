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

Current release scope:

- Monday-Friday weekly planning board
- Learner, learner-track, day, type, and status filters
- Standard, catch-up, flex, co-op-heavy, and break/light modes
- Optional co-op event, location, responsibility, materials, arrival, and follow-up fields
- Safe source seeding from Assignments and Lesson Packs
- Linked, non-destructive carryover
- Shortcuts into Schedule, Pacing, Mission Planner, Assignments, Lesson Packs, Year Plan, and Insights
- Deterministic planner package export/import
- Parent/Teacher/Admin editing, Director rollup, and Student denial

Boundaries:

- No external calendar sync
- No silent completion, XP, coins, attendance, mastery, portfolio, or source-record changes
- No required printable/offline binder work
- Student Home and mobile dock remain uncluttered

## Next planned release

### v10.39 — Modularization and Offline Regression Foundation

Planned:

- Extract one controlled application module at a time behind existing regression contracts
- Add screenshot comparison baselines for high-risk role and learner routes
- Add explicit offline/network-blocked browser checks
- Preserve deterministic single-file release output throughout extraction
- Keep feature behavior stable while reducing release-builder coupling

Boundaries:

- No broad visual redesign during extraction
- No feature removals or role-contract changes
- No cloud dependency introduced by modularization
- No cross-project infrastructure changes

## Later releases

- Firefox and WebKit coverage
- Neutral custom production domain and optional protected preview
