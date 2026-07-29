# Agent Instructions

## Product invariants

- Preserve offline-first behavior.
- Keep a downloadable single-file release artifact.
- Do not add telemetry, advertising, or required cloud services.
- Keep student and adult role boundaries explicit.
- Never commit real student or family data.
- Treat versioned release artifacts as immutable; create a new release for behavioral changes.

## Change workflow

- Use a short-lived branch and pull request.
- Run static validation and Playwright tests.
- Add or update regression coverage for defects.
- Record release-level changes in the roadmap and release notes.
- Prefer squash merge after checks pass.
