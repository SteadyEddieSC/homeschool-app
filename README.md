# Beaufort Learning Harbor

Beaufort Learning Harbor is a homeschool and co-op learning application. The repository maintains two deliberately separated development tracks: a validated offline v10 application and a cloud-ready v11 platform being built beside it.

## Development tracks

### Stable application — v10.43

The current production and downloadable baseline remains v10.43. It is an offline-first, deterministic single-file application with synthetic demo data, versioned import/export, role boundaries, lesson planning, controlled Lesson Pack overlays, and comprehensive browser validation.

### Household workflow preview — v11.0.0-beta.1

The `v11/` directory contains a TypeScript, React, Vite, Cloudflare Worker, and Supabase-ready application for online homeschool-group use. Beta 1 adds parent-managed learner profiles without learner email accounts, supervised parent-assisted device handoff, household-scoped Today assignments, explicit learner review submission, and adult complete-or-return decisions. It does not replace v10.43, deploy automatically, migrate family data, or contain real family records.

See `docs/v11/architecture.md`, `docs/v11/setup-checklist.md`, `docs/v11/hosted-preview-runbook.md`, `docs/v11/migration-strategy.md`, `docs/v11/roadmap-v11-beta.md`, and `docs/v11/release-v11.0.0-beta.1.md`.

## Current stable baseline

- Application: v10.43
- Public identities: Jordan, Avery, Guest Student, and Demo Family
- Demo behavior: deterministic Load Demo Family and Reset Demo Data controls
- Hero/title behavior: one authoritative owner with legacy version writers made idempotent
- Student routes: stable Learn, Practice, Quiz/Test, Proof, and Feedback actions
- Learner route resolver: one schema-1 module owns learner/track normalization, assignment applicability, completion-aware next-item selection, direct assignment destinations, and safe route fallbacks
- App-shell role policy: one schema-1 module owns normalized role metadata, screen catalog membership, static route authorization, role defaults, and navigation-group definitions
- Role boundaries: explicit Parent/Teacher/Director/Admin access checks, Student denial of adult-only tools, and dynamic learner permission checks preserved
- Data contract: schema-1 sanitized application-state export/import with deterministic migration
- Subjective proof: adult-only Knowledge Check Builder with student-safe preview and deterministic prompt-bank packages
- Curriculum drafting and integration: adult-only Lesson Pack Editor plus explicit controlled browser-local overlays with selective review, rights/media gates, rollback, and student-safe destination rendering
- Weekly coordination: adult-only Family/Co-op Planner v2 with learner filters, reusable week templates, duplicate/roll-forward tools, workload/conflict analysis, responsibility-gap warnings, safe source seeding, linked carryover, deterministic planner packages, and optional learner-safe print/CSV output
- Curriculum intake: family-provided 4th–6th booklist recorded as preliminary, edition-unconfirmed planning input only
- Offline runtime: reusable same-origin/embedded request contract with external fetch/XHR/beacon blocking and a browser-local ledger
- Console/runtime stability: legacy learning-path version binding restored, nine obsolete body-wide observers and fifteen startup polling loops retired after initial render, and retained media class cleanup made idempotent
- Visual regression: repeat-render screenshot comparison baselines for high-risk learner and adult-role routes
- Deployment target: Cloudflare Workers Static Assets demo

## Repository model

### v10 stable application

- `source/releases/v10.32/`: immutable sanitized baseline
- `source/releases/v10.33/` through `source/releases/v10.43/`: deterministic release contracts
- `source/current-release.json`: stable release pointer
- `scripts/build-v10.33.mjs` through `scripts/build-v10.43.mjs`: layered deterministic transformations
- `modules/`: versioned v10 domain and UI boundaries
- `fixtures/` and `tests/`: synthetic data and v10 validation

### v11 cloud-ready application

- `v11/src/`: React application, identity and learning domains, services, and role-aware UI
- `v11/worker/`: Cloudflare Worker API and response-security boundary
- `v11/supabase/migrations/`: Postgres schema, invitations, family visibility, Today transitions, and Row-Level Security
- `v11/supabase/tests/`: transaction-scoped synthetic database-policy tests
- `v11/tests/`: desktop, tablet, and Pixel 7 browser workflows
- `docs/v11/`: architecture, setup, migration, preview runbook, beta roadmap, and release documentation
- `.github/workflows/validate-v11.yml`: isolated v11 build, database, and browser gates
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

Without Supabase browser configuration, v11 operates in clearly labeled local-preview mode with synthetic browser-local support, membership, invitation, household, learner, and Today records.

### v11 database policies

With Docker running:

```bash
cd v11
npm run db:start
npm run db:reset
npm run db:test
npm run db:stop
```

The database suite rebuilds from migrations and verifies identity bootstrap, invitation expiry/replay controls, family visibility, cross-household denial, reviewed Today transitions, role restrictions, and Row-Level Security using synthetic transaction-scoped accounts.

## Cloudflare deployments

The root `wrangler.jsonc` remains the deployment source of truth for the stable `beaufort-learning-harbor` Worker.

The v11 preview uses `v11/wrangler.jsonc` and the separate Worker name `beaufort-learning-harbor-v11-preview`. Normal validation CI builds but does not deploy the preview. Deployment requires an explicit manual workflow dispatch, a protected `v11-preview` GitHub environment, scoped secrets, and the exact confirmation phrase.

## Privacy and learning-outcome boundaries

Only synthetic data belongs in this public repository. Real family exports, screenshots, backups, student work, account data, provider tokens, invitation codes, and local data must remain outside Git.

Never place a Supabase service-role key, BAND client secret, OAuth access token, database password, or private key in browser configuration or a committed file.

Lesson packs and tests use original synthetic examples. Do not commit copied proprietary curriculum text. Media planning should prefer reputable free/OER/public-domain/nonprofit/government sources and record license/source review before controlled apply.

Controlled Lesson Pack apply in v10 is explicit, browser-local, reversible, and adult-reviewed. It never rewrites the source pack, destination source lesson, assignment, progress, reward, grade, attendance, mastery, or portfolio records.

The v11 database treats UI hiding as insufficient authorization. Shared tables require Row-Level Security, organization membership alone does not reveal household learners, invitation codes are one-time and expiring, and System Administrator access cannot be invited or automatically used to inspect family records.

Beta 1 Today items deliberately contain no automatic grade, XP, attendance, mastery, or portfolio-approval outcome. Completion requires an explicit household-manager review action.

## Recommended next action and release

After beta.1, configure the protected hosted preview and conduct a bounded household pilot using synthetic or disposable records before any migration or production cutover.

The next recommended release is `v11.0.0-beta.2 — Hosted Household Pilot, Offline Queue, and Recovery`.

## License

Copyright © 2026. All rights reserved. No license is granted to copy, redistribute, or commercially use this source without permission.
