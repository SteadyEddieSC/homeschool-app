# Beaufort Learning Harbor v10.43

## Lesson Pack Controlled Apply v1

This release adds an explicit, reversible bridge from a reviewed Lesson Pack draft to a browser-local student-facing destination overlay. The source pack remains immutable, and no destination source lesson or learner record is rewritten.

### Added

- Selective approval of the objective, individual sections, practice prompts, lab/project prompts, no-equipment path, and media plan.
- Before/after comparison against the selected destination and week.
- Required adult audit note and original/OER/public-domain/nonprofit/government-use content-rights attestation.
- Separate media license and provenance checks when a media plan is selected.
- Deterministic overlay fingerprints and duplicate-active prevention.
- Browser-local overlay and capped audit history.
- Student-safe destination rendering that excludes adult notes, reviewer role, rights attestations, audit details, fingerprints, and rollback controls.
- Parent/Teacher/Admin management, Director read-only rollups, and Student denial of authoring/apply controls.
- Audited rollback with restoration of the prior active overlay state.
- Dedicated Node, static-integrity, privacy, desktop, touch-tablet, and Pixel 7 coverage.

### Preserved boundaries

- Lesson Pack drafts remain `draft-only` source records and are not mutated by apply or rollback.
- Existing destination source content, assignments, progress, XP, coins, grades, attendance, mastery, and portfolio state remain unchanged.
- Apply never occurs automatically from draft status alone.
- Copied proprietary curriculum text is not supported and cannot be silently attested.
- No cloud account, API, database, telemetry, service worker, external calendar, or network dependency is introduced.
- Preliminary curriculum records remain planning input only until exact adult review.

### Artifact contract

- File: `beaufort_learning_harbor_v10_43.html`
- Bytes: `PENDING`
- SHA-256: `PENDING`
- Lesson Pack schema: `1`
- Controlled Apply operations schema: `1`
