# Beaufort Learning Harbor

Beaufort Learning Harbor is a homeschool and co-op learning application. The repository maintains two deliberately separated tracks: a validated offline v10 application and a typed v11 platform being built beside it.

## Development tracks

### Stable application — v10.43

The current production and downloadable baseline remains v10.43. It is an offline-first, deterministic single-file application with synthetic demo data, versioned import/export, role boundaries, lesson planning, controlled Lesson Pack overlays, and comprehensive browser validation.

### Resilient household preview — v11.0.0-beta.2

The `v11/` directory contains a TypeScript, React, Vite, Cloudflare Worker, and optional Supabase application for online homeschool-group use. Beta 2 adds an application-owned local mirror, ordered retryable synchronization queue, stable operation IDs, duplicate prevention, database idempotency receipts, visible sync state, and encrypted backup/restore with a required preview.

Supabase configuration is optional and deferred. Beta 2 does not replace v10.43, deploy automatically, migrate family data, or contain real family records.

See:

- `docs/v11/architecture.md`
- `docs/v11/setup-checklist.md`
- `docs/v11/hosted-preview-runbook.md`
- `docs/v11/offline-recovery.md`
- `docs/v11/migration-strategy.md`
- `docs/v11/roadmap-v11-beta.md`
- `docs/v11/release-v11.0.0-beta.2.md`

## Current stable baseline

- Application: v10.43
- Public identities: Jordan, Avery, Guest Student, and Demo Family
- Deterministic Load Demo Family and Reset Demo Data behavior
- Stable Learn, Practice, Quiz/Test, Proof, and Feedback learner routes
- Explicit Parent, Teacher, Director, and Administrator boundaries
- Schema-1 sanitized application-state export/import
- Adult-reviewed subjective proof and Knowledge Check Builder
- Controlled browser-local Lesson Pack overlays with rights/media gates and rollback
- Family/Co-op Planner v2 with templates, workload analysis, responsibility warnings, and portable output
- Same-origin/embedded offline request contract with external network blocking
- Desktop, tablet, mobile, accessibility, privacy, route, and visual-regression validation
- Deployment target: Cloudflare Workers Static Assets demo

## Repository model

### v10 stable application

- `source/releases/v10.32/`: immutable sanitized baseline
- `source/releases/v10.33/` through `source/releases/v10.43/`: deterministic release contracts
- `source/current-release.json`: stable release pointer
- `scripts/build-v10.33.mjs` through `scripts/build-v10.43.mjs`: layered deterministic transformations
- `modules/`: versioned v10 domain and UI boundaries
- `fixtures/` and `tests/`: synthetic data and v10 validation

### v11 typed application

- `v11/src/`: identity, household learning, synchronization, recovery, services, and role-aware UI
- `v11/worker/`: isolated Cloudflare Worker API and security boundary
- `v11/supabase/migrations/`: identity, invitations, family visibility, Today transitions, client operation IDs, and idempotency receipts
- `v11/supabase/tests/`: transaction-scoped authorization and retry tests
- `v11/tests/`: desktop, touch-tablet, and Pixel 7 workflows
- `docs/v11/`: architecture, setup, migration, recovery, roadmap, and release documentation
- `.github/workflows/validate-v11.yml`: isolated v11 build, database, browser, and artifact gates
- `.github/workflows/deploy-v11-preview.yml`: protected manual-only preview deployment

## Local workflow

### v10

```bash
npm install --no-package-lock
npm run verify:release
npx playwright install chromium
npm test
```

The validated v10 single-file output is generated at `site/index.html` and published as a downloadable Actions artifact.

### v11 application

```bash
cd v11
npm install --no-package-lock
npm run verify
npx playwright install chromium
npm run test:e2e
```

Without Supabase browser configuration, v11 operates in clearly labeled **Local preview** mode. Add `?sync-sim=1` to exercise the persistent queue without sending data anywhere.

### v11 database policies

With Docker running:

```bash
cd v11
npm run db:start
npm run db:reset
npm run db:test
npm run db:stop
```

The database suite rebuilds migrations `001–006` and verifies identity bootstrap, invitation controls, family isolation, reviewed Today transitions, operation ID reuse, retry idempotency, single audit events, receipt-forgery denial, and Row-Level Security.

## Cloudflare deployments

The root `wrangler.jsonc` remains the source of truth for the stable `beaufort-learning-harbor` Worker.

The v11 preview uses the separate Worker `beaufort-learning-harbor-v11-preview`. Normal validation CI builds but does not deploy it. Deployment requires explicit manual dispatch, a protected `v11-preview` environment, scoped secrets, and the exact confirmation phrase.

## Privacy, recovery, and learning-outcome boundaries

Only synthetic data belongs in this public repository. Real family exports, screenshots, backups, student work, account data, provider tokens, invitation codes, and local data remain outside Git.

Never place a Supabase service-role key, BAND client secret, OAuth access token, database password, or private key in browser configuration or a committed file.

The beta.2 encrypted backup includes only application-owned local records and queue state. It excludes sessions, passwords, credentials, deployment secrets, OAuth/BAND tokens, and active invitation tokens. Restore requires integrity verification, decryption, count validation, preview, and explicit confirmation.

The v11 database treats UI hiding as insufficient authorization. Organization membership alone does not reveal household learners, System Administrator access does not automatically reveal family records, and constrained operation receipts prevent duplicate Today transitions during retry.

Today items contain no automatic grade, XP, attendance, mastery, or portfolio approval. Completion requires an explicit household-manager review.

## Recommended next action

When convenient, create the non-production Supabase project, review `supabase db push --dry-run`, apply the reviewed migrations only to that preview project, and use beta.2 synchronization and recovery during a bounded synthetic household pilot.

## Next recommended release

`v11.0.0-beta.3 — Evidence, Knowledge Checks, and Family Planning`.

## License

Copyright © 2026. All rights reserved. No license is granted to copy, redistribute, or commercially use this source without permission.
