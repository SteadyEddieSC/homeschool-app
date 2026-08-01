# Beaufort Learning Harbor

Beaufort Learning Harbor is an offline-first homeschool and co-op learning application. The repository preserves an immutable validated single-file baseline, builds newer releases reproducibly, and adds modular boundaries, synthetic demo data, and automated validation.

## Current baseline

- Application: v10.38
- Public identities: Jordan, Avery, Guest Student, and Demo Family
- Demo behavior: deterministic Load Demo Family and Reset Demo Data controls
- Hero/title behavior: one authoritative owner with legacy version writers made idempotent
- Student routes: stable Learn, Practice, Quiz/Test, Proof, and Feedback actions
- Role boundaries: explicit Parent/Teacher/Director/Admin access checks and Student denial of adult-only tools
- Data contract: schema-1 sanitized application-state export/import with deterministic migration
- Subjective proof: adult-only Knowledge Check Builder with student-safe preview and deterministic prompt-bank packages
- Curriculum drafting: adult-only Lesson Pack Editor with ordered sections, practice/lab prompts, media needs, no-equipment paths, before/after preview, and no live apply
- Weekly coordination: adult-only Family/Co-op Planner with learner filters, flex/catch-up modes, optional co-op responsibilities, safe source seeding, linked carryover, and deterministic planner packages
- Destination stability: source-media galleries and visual models render once instead of rebuilding through their own MutationObserver
- Deployment target: Cloudflare Workers Static Assets demo
- Automated flow: integrity/privacy checks, Node contract tests, Playwright desktop/tablet/mobile coverage, route and role coverage, destination stability, hero stability, dock stability, visual capture, and axe-core

## Repository model

- `source/releases/v10.32/`: immutable sanitized baseline
- `source/releases/v10.33/` through `source/releases/v10.38/`: deterministic release contracts
- `source/current-release.json`: current release pointer
- `scripts/build-v10.33.mjs` through `scripts/build-v10.38.mjs`: layered deterministic transformations
- `modules/data-adapter.mjs`: schema-1 application-data boundary
- `modules/knowledge-check-bank.mjs` and `modules/knowledge-check-ui.js`: subjective-proof authoring boundary
- `modules/lesson-pack.mjs` and `modules/lesson-pack-ui.js`: structured curriculum-draft boundary
- `modules/family-planner.mjs` and `modules/family-planner-ui-*.js`: weekly family/co-op coordination boundary
- `fixtures/`: synthetic test and demo scenarios
- `tests/`: Node contract tests and Playwright browser checks
- `docs/`: architecture, privacy, releases, roadmap, and testing guidance
- `.github/`: CI, issue forms, and pull-request standards

## Local workflow

```bash
npm install --no-package-lock
npm run verify:release
npx playwright install chromium
npm test
```

Playwright and axe are pinned exactly in `package.json`. The lockfile is intentionally omitted while npm's newly published Playwright tarball URLs are inconsistent under `npm ci`; clean pinned installs are exercised independently in CI.

The validated single-file output is generated at `site/index.html`. GitHub Actions also publishes it as a downloadable workflow artifact.

## Cloudflare Workers

Connect the repository using the **SteadyEddieSC** GitHub owner installation. The root `wrangler.jsonc` is the deployment source of truth and matches the connected Worker name `beaufort-learning-harbor`.

Use these connected-build settings:

```text
Production branch: main
Root directory: /
Build command: npm run verify:release
Deploy command: npx wrangler deploy
Non-production deploy command: npx wrangler versions upload
```

Wrangler serves the generated `site` directory as static assets with single-page-application fallback behavior.

The default `workers.dev` address is public when enabled and includes the account-level subdomain. For a public-facing link, attach a neutral custom domain and disable the old `workers.dev` route after the custom hostname is verified.

## Privacy and content boundaries

Only synthetic demo data belongs in this public repository. Real family exports, screenshots, backups, and local data must remain outside Git.

Lesson packs and tests use original synthetic examples. Do not commit copied proprietary curriculum text. Media planning should prefer reputable free/OER/public-domain/nonprofit/government sources and record license/source review before controlled apply.

Planner examples are synthetic and browser-local. Planner actions must not silently complete assignments, grant rewards, record attendance, approve mastery, or rewrite source learning records.

## License

Copyright © 2026. All rights reserved. No license is granted to copy, redistribute, or commercially use this source without permission.
