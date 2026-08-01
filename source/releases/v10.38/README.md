# Beaufort Learning Harbor v10.38

## Family/Co-op Planner v1

v10.38 adds one adult coordination layer across the existing Schedule/Rhythm, Year Pacing, Mission Planner, Assignments, Lesson Packs, Year Plan, and Insights workflows.

The planner supports:

- a Monday-Friday weekly planning board;
- standard, catch-up, flex, co-op-heavy, and break/light week modes;
- learner, learner-track, day, type, and status filters;
- family-wide, learner-specific, and track-specific plan items;
- student-safe directions kept separate from adult coordination notes;
- optional co-op event, location, role, materials, arrival, and follow-up fields;
- non-destructive seeding from current-week assignments and lesson packs;
- linked carryover into another loaded week while leaving the source item intact;
- shortcuts into Assignments, Lesson Packs, Mission Planner, Schedule/Rhythm, Year Pacing, Year Plan, and Insights;
- deterministic planner package export and fail-closed import.

Parent, Teacher, and Admin can edit. Director receives a read-only workload and responsibility rollup. Student mode receives no planner navigation, authoring, package, or adult-note controls.

## Package safety

Planner files use the deterministic `beaufort-learning-harbor-family-planner` format with schema version `1` and kind `family-planner-workspace`.

Import validates the entire workspace before application state changes and rejects malformed JSON, unsupported schemas or kinds, partial workspaces, duplicate week or item identifiers, invalid days/types/statuses/targets/sources/time windows, dangerous keys, and polluted prototypes.

## Boundaries

- No external calendar sync.
- No cloud accounts, APIs, telemetry, database, or real family data.
- No automatic assignment completion, XP, coins, loot, attendance, mastery, portfolio approval, or lesson-pack status changes.
- No destructive rewrite of Assignments, Lesson Packs, Schedule, Pacing, Year Plan, or Insights.
- Carryover creates a linked planning item and preserves its source.
- Printable/offline binder output remains optional support only.
- Student Home and the five-action mobile dock remain uncluttered.

## Release contract

- Artifact: `beaufort_learning_harbor_v10_38.html`
- Bytes: `5,447,658`
- SHA-256: `e4377a78637811f2c1099484c6cabdcb69703213d923ea774250b064e45d9566`
- Application data schema: `1`
- Knowledge-check bank schema: `1`
- Lesson-pack package schema: `1`
- Family-planner package schema: `1`
- Desktop, touch-tablet, Pixel 7/mobile, route, role, hero, dock, destination-stability, privacy, accessibility, data, knowledge-check, lesson-pack, planner, and Cloudflare branch-deployment gates remain required.
