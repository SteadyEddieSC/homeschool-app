# Beaufort Learning Harbor

Beaufort Learning Harbor is an offline-first homeschool and co-op learning application. The repository preserves an immutable validated single-file baseline, builds newer releases reproducibly, and adds modular boundaries, synthetic demo data, and automated validation.

## Current baseline

- Application: v10.33.1
- Public identities: Jordan, Avery, Guest Student, and Demo Family
- Demo behavior: deterministic Load Demo Family and Reset Demo Data controls
- Hero/title behavior: one authoritative owner with legacy version writers made idempotent
- Deployment target: Cloudflare Workers Static Assets demo
- Automated flow: integrity/privacy checks, Playwright desktop/mobile coverage, hero stability, dock stability, visual capture, and axe-core

## Repository model

- `source/releases/v10.32/`: immutable sanitized baseline
- `source/releases/v10.33/release.json`: v10.33 demo-foundation contract
- `source/releases/v10.33.1/release.json`: current hero-stability patch contract
- `source/current-release.json`: current release pointer
- `scripts/build-v10.33.mjs`: deterministic v10.33 transformation
- `scripts/build-v10.33.1.mjs`: deterministic hero/title stabilization patch
- `modules/`: controlled extraction boundaries for later physical modularization
- `fixtures/`: synthetic test and demo scenarios
- `tests/`: Playwright browser checks
- `docs/`: architecture, privacy, releases, roadmap, and testing guidance
- `.github/`: CI, issue forms, and pull-request standards

## Local workflow

```bash
npm install --no-package-lock
npm run verify:release
npx playwright install chromium
npm test
```

Playwright and axe are pinned exactly in `package.json`. The lockfile is intentionally omitted while npm's newly published Playwright tarball URLs are inconsistent under `npm ci`; clean pinned installs are exercised independently in both CI jobs.

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

## Privacy

Only synthetic demo data belongs in this public repository. Real family exports, screenshots, backups, and local data must remain outside Git.

## License

Copyright © 2026. All rights reserved. No license is granted to copy, redistribute, or commercially use this source without permission.
