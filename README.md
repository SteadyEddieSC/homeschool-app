# Beaufort Learning Harbor

Beaufort Learning Harbor is an offline-first homeschool and co-op learning application. The repository preserves the validated single-file app while introducing modular boundaries, synthetic demo data, repeatable builds, and automated validation.

## Current baseline

- Application: v10.32
- Public identities: Jordan, Avery, and Guest Student
- Deployment target: Cloudflare Pages demo
- Automated flow: deterministic integrity/privacy checks plus Playwright and axe-core

## Repository model

The folders under `modules/` define controlled extraction boundaries around the current single-file release. They are documentation-first until browser regression coverage protects the existing behavior.

- `modules/`: source boundaries for app shell, navigation, learning, assessment, portfolio, adult workflows, data, and shared code
- `fixtures/`: synthetic test and demo scenarios
- `tests/`: Playwright browser checks
- `scripts/`: build, integrity, privacy, and local-server tooling
- `docs/`: architecture, privacy, releases, roadmap, and testing guidance
- `.github/`: CI, issue forms, and pull-request standards

## Local workflow

```bash
npm install
npm run verify
npx playwright install chromium
npm test
```

## Privacy

Only synthetic demo data belongs in this public repository. Real family exports, screenshots, backups, and local data must remain outside Git.

## License

Copyright © 2026. All rights reserved. No license is granted to copy, redistribute, or commercially use this source without permission.
