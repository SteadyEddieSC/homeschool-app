# Beaufort Learning Harbor v11

The `v11/` application is the typed React/TypeScript platform being developed beside the stable v10.43 single-file application.

## Current release

`v11.0.0-beta.4 — Hosted Pilot Readiness and Operational Recovery`

Beta 4 provides:

- parent-managed learners and supervised learner handoff;
- Today assignment and explicit adult review workflows;
- deterministic objective knowledge checks;
- revision-preserving subjective proof and adult accept/return decisions;
- bounded weekly household planning;
- application-owned local persistence;
- ordered retryable hosted operations with stable operation and record IDs;
- Supabase repositories for household learning and learning-studio records;
- conflict-aware reconciliation that preserves divergent local records;
- encrypted backup with beta.2 and beta.3 compatibility;
- a secret-safe pilot doctor, authenticated schema verifier, and sanitized operational diagnostics.

It does not create or configure the owner’s Supabase or Cloudflare account, apply remote migrations automatically, deploy automatically, migrate v10.43 data, or replace production.

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
npm run pilot:doctor   # expected exit code 2 until provider settings exist
npm run db:start
npm run db:reset
npm run db:test
npm run db:stop
npx playwright install chromium
npm run test:e2e
```

## Hosted activation

Hosted activation remains explicit and owner-controlled:

1. Create a dedicated non-production Supabase project.
2. Dry-run and apply migrations `001–008` after local CI passes on the exact release commit.
3. Create a synthetic adult pilot account.
4. Configure the protected `v11-preview` GitHub environment.
5. Run `npm run pilot:doctor` and `npm run pilot:verify-schema` from a protected environment.
6. Manually dispatch **Deploy v11 Preview** with `DEPLOY_V11_PREVIEW`.

The deployment workflow refuses to continue if the browser key is privileged, migration `008` is absent, the schema status RPC is unavailable, or the Worker target is not the isolated v11 preview.

## Learning authority

- Objective checks are scored only from explicit answer keys.
- Scores are informational and do not create grades, mastery, attendance, XP, or portfolio approval.
- Subjective proof requires an adult Accept or Return decision.
- Returned proof keeps its revision and feedback.
- Weekly planning never completes learner work.
- Hosted reconciliation never silently overwrites divergent local studio records.

See `docs/v11/release-v11.0.0-beta.4.md`, `docs/v11/hosted-preview-runbook.md`, `docs/v11/evidence-and-planning.md`, and `docs/v11/roadmap-v11-beta.md`.
