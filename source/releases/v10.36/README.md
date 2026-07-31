# Beaufort Learning Harbor v10.36

## Knowledge Check Builder v1

v10.36 adds a dedicated adult-only authoring workspace for subjective learning proof:

- recitations;
- discussions;
- notebook checks;
- projects;
- oral tell-backs;
- mastery proof.

The builder captures learner directions, evidence expectations, visible success criteria, subject and track targets, plus adult-only return, approval, and planning language. Its student-ready preview deliberately excludes all adult-only fields.

Prompt banks use the deterministic `beaufort-learning-harbor-knowledge-check-bank` format with schema version `1`. Import validates the full bank before local state changes and rejects malformed JSON, unsupported schemas or kinds, duplicate identifiers, partial prompts, unsupported types, and dangerous object keys.

## Boundaries

- Subjective work is not auto-graded.
- Adult approval remains authoritative.
- Formal Quiz/Test remains separate and tool-scored.
- No cloud sync, accounts, authentication service, telemetry, database, or external API.
- No real family data or copyrighted curriculum content.
- Existing schema-1 application-state import/export remains compatible.

## Release contract

- Artifact: `beaufort_learning_harbor_v10_36.html`
- Bytes: `5,331,042`
- SHA-256: `0c495ca46fbc2cf43762b33f5b89895adeee48d9db323542d1284e2285e49725`
- Application data schema: `1`
- Knowledge-check bank schema: `1`
- Mobile, route, role, hero, dock, destination-stability, privacy, accessibility, and demo gates remain required.
