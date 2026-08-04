# Beaufort Learning Harbor v11

The `v11/` application is the typed React/TypeScript platform being developed beside the stable v10.43 single-file application.

## Current release

`v11.0.0-beta.3 — Evidence, Knowledge Checks, and Family Planning`

Beta 3 provides:

- parent-managed learners and supervised learner handoff;
- Today assignment and explicit adult review workflows;
- deterministic objective knowledge checks;
- revision-preserving subjective proof and adult accept/return decisions;
- bounded weekly household planning;
- application-owned local persistence;
- ordered cloud-simulation queue and duplicate prevention;
- encrypted backup, beta.2 backup compatibility, restore preview, and emergency rollback.

It does not create or configure a hosted Supabase project, deploy automatically, migrate v10.43 data, or replace production.

## Local development

```bash
cd v11
npm install --no-package-lock
npm run dev
```

Add `?sync-sim=1` to the local URL to exercise the persistent queue without transmitting data.

## Validation

```bash
npm run verify
npm run db:start
npm run db:reset
npm run db:test
npm run db:stop
npx playwright install chromium
npm run test:e2e
```

## Hosted boundary

The Cloudflare preview workflow is manual-only and protected. Beta.3 studio writes are intentionally local/simulation-only. Hosted repositories and the owner-controlled Supabase pilot belong to beta.4.

## Learning authority

- Objective checks are scored only from explicit answer keys.
- Scores are informational and do not create grades, mastery, attendance, XP, or portfolio approval.
- Subjective proof requires an adult Accept or Return decision.
- Returned proof keeps its revision and feedback.
- Weekly planning never completes learner work.

See `docs/v11/release-v11.0.0-beta.3.md`, `docs/v11/evidence-and-planning.md`, and `docs/v11/roadmap-v11-beta.md`.
