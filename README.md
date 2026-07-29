# Beaufort Learning Harbor

Beaufort Learning Harbor is an offline-first homeschool and co-op learning application. The repository preserves an immutable validated single-file baseline, builds newer releases reproducibly, and adds modular boundaries, synthetic demo data, and automated validation.

## Current baseline

- Application: v10.33
- Public identities: Jordan, Avery, Guest Student, and Demo Family
- Demo behavior: deterministic Load Demo Family and Reset Demo Data controls
- Deployment target: Cloudflare Pages demo
- Automated flow: integrity/privacy checks, Playwright desktop/mobile coverage, dock stability, visual capture, and axe-core

## Repository model

- `source/releases/v10.32/`: immutable sanitized baseline
- `source/releases/v10.33/release.json`: v10.33 artifact contract
- `source/current-release.json`: current release pointer
- `scripts/build-v10.33.mjs`: deterministic transformation from v10.32 to v10.33
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

## Privacy

Only synthetic demo data belongs in this public repository. Real family exports, screenshots, backups, and local data must remain outside Git.

## License

Copyright © 2026. All rights reserved. No license is granted to copy, redistribute, or commercially use this source without permission.
