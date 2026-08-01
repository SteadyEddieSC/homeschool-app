# Beaufort Learning Harbor v10.37

## Lesson Pack Editor v1

v10.37 adds a structured adult-only authoring path between broad Curriculum Studio ideas and any future controlled overlay apply.

The editor supports:

- ordered lesson sections with original student-facing content;
- separate practice prompts and lab/project prompts;
- subject, learner-track, target-week, and target-destination mapping;
- a media-needs checklist covering hero/supporting visuals, diagrams or maps, source/license review, and alt text;
- a complete no-equipment path with directions and evidence expectations;
- side-by-side before/after preview;
- deterministic lesson-pack package export/import;
- non-destructive migration from existing Curriculum Studio draft stores.

Parent, Teacher, and Admin can author. Director receives a read-only readiness rollup. Student mode receives no authoring, import/export, migration, or adult-note controls. The editor appears in Parent Support and in the Teacher, Director, and Admin build/operations navigation groups.

## Package safety

Lesson-pack files use the deterministic `beaufort-learning-harbor-lesson-pack` format with schema version `1` and kind `lesson-pack-draft`.

Import validates the complete package before application state changes and rejects malformed JSON, unsupported schemas or kinds, partial packs, duplicate section identifiers, unsupported statuses, dangerous keys, and polluted prototypes.

## Boundaries

- No live curriculum apply.
- No destructive curriculum rewrite.
- Existing Curriculum Studio and managed-apply stores remain unchanged.
- Any later overlay/apply step remains reversible and separately governed.
- No copyrighted curriculum copying.
- No cloud sync, accounts, external API, telemetry, database, or real family data.
- No route-only XP or authoring rewards.
- Printable/offline binder materials remain optional support only.

## Release contract

- Artifact: `beaufort_learning_harbor_v10_37.html`
- Bytes: `5,380,725`
- SHA-256: `daf8a3a970116ed8a1dd79a610d2e37cb345b8a2519c4742e4564d848f7170f5`
- Application data schema: `1`
- Knowledge-check bank schema: `1`
- Lesson-pack package schema: `1`
- All 22 inline scripts parse successfully in the independently recovered Actions artifact.
- Desktop, touch-tablet, Pixel 7/mobile, route, role, hero, dock, destination-stability, privacy, accessibility, data, knowledge-check, and Cloudflare branch-deployment gates remain required.
