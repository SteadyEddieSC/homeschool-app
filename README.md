# Beaufort Learning Harbor

Beaufort Learning Harbor is an offline-first homeschool and co-op learning application. The repository preserves an immutable validated single-file baseline, builds newer releases reproducibly, and adds modular boundaries, synthetic demo data, and automated validation.

## Current baseline

- Application: v10.42
- Public identities: Jordan, Avery, Guest Student, and Demo Family
- Demo behavior: deterministic Load Demo Family and Reset Demo Data controls
- Hero/title behavior: one authoritative owner with legacy version writers made idempotent
- Student routes: stable Learn, Practice, Quiz/Test, Proof, and Feedback actions
- Learner route resolver: one schema-1 module owns learner/track normalization, assignment applicability, completion-aware next-item selection, direct assignment destinations, and safe route fallbacks
- App-shell role policy: one schema-1 module owns normalized role metadata, screen catalog membership, static route authorization, role defaults, and navigation-group definitions
- Role boundaries: explicit Parent/Teacher/Director/Admin access checks, Student denial of adult-only tools, and dynamic learner permission checks preserved
- Data contract: schema-1 sanitized application-state export/import with deterministic migration
- Subjective proof: adult-only Knowledge Check Builder with student-safe preview and deterministic prompt-bank packages
- Curriculum drafting: adult-only Lesson Pack Editor with ordered sections, practice/lab prompts, media needs, no-equipment paths, before/after preview, and no live apply
- Weekly coordination: adult-only Family/Co-op Planner v2 with learner filters, reusable week templates, duplicate/roll-forward tools, workload/conflict analysis, responsibility-gap warnings, safe source seeding, linked carryover, deterministic planner packages, and optional learner-safe print/CSV output
- Curriculum intake: family-provided 4th–6th booklist recorded as preliminary, edition-unconfirmed planning input only
- Offline runtime: reusable same-origin/embedded request contract with external fetch/XHR/beacon blocking and a browser-local ledger
- Console/runtime stability: legacy learning-path version binding restored, nine obsolete body-wide observers and fifteen startup polling loops retired after initial render, and retained media class cleanup made idempotent
- Visual regression: repeat-render screenshot comparison baselines for high-risk learner and adult-role routes
- Destination stability: source-media galleries and visual models render once instead of rebuilding through their own MutationObserver
- Deployment target: Cloudflare Workers Static Assets demo
- Automated flow: integrity/privacy checks, Node contract tests, explicit offline checks, app-shell policy parity, learner-route parity and fallback checks, Family Planner v2 template/copy/analysis checks, console/page-error and mutation-stability checks, visual comparisons, Playwright desktop/tablet/mobile coverage, route and role coverage, destination stability, hero stability, dock stability, and axe-core

## Repository model

- `source/releases/v10.32/`: immutable sanitized baseline
- `source/releases/v10.33/` through `source/releases/v10.42/`: deterministic release contracts
- `source/current-release.json`: current release pointer
- `scripts/build-v10.33.mjs` through `scripts/build-v10.42.mjs`: layered deterministic transformations
- `modules/data-adapter.mjs`: schema-1 application-data boundary
- `modules/knowledge-check-bank.mjs` and `modules/knowledge-check-ui.js`: subjective-proof authoring boundary
- `modules/lesson-pack.mjs` and `modules/lesson-pack-ui.js`: structured curriculum-draft boundary
- `modules/family-planner.mjs` and `modules/family-planner-ui-*.js`: Family Planner v1 package and workspace boundary
- `modules/family-planner-v2.mjs` and `modules/family-planner-v2-ui.js`: template, copy/roll-forward, workload/conflict, responsibility-gap, and learner-safe output boundary
- `modules/offline-runtime.mjs` and `modules/offline-runtime-ui.js`: reusable offline/runtime request boundary
- `modules/app-shell-role-policy.mjs`: app-shell catalog and static role-policy boundary
- `modules/learner-route-resolver.mjs`: learner, assignment, completion-aware route, and destination boundary
- `docs/curriculum/`: preliminary and confirmed curriculum-source documentation
- `fixtures/`: synthetic test and demo scenarios
- `tests/`: Node contract tests and Playwright browser checks
- `docs/`: architecture, privacy, release scopes, roadmap, curriculum intake, and testing guidance
- `.github/`: CI, issue forms, and pull-request standards

## Local workflow

```bash
npm install --no-package-lock
npm run verify:release
npx playwright install chromium
npm test
```

Playwright, axe, and PNG parsing are pinned exactly in `package.json`. The lockfile is intentionally omitted while npm's newly published Playwright tarball URLs are inconsistent under `npm ci`; clean pinned installs are exercised independently in CI.

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

Family-provided booklists may be documented without identifying data, but preliminary sources must remain visibly unconfirmed until exact editions, learner assignment, consumable status, ownership, and pacing are reviewed. They must not silently create live assignments or final pacing.

Planner examples are synthetic and browser-local. Planner actions, templates, duplicate-week operations, roll-forward operations, and print/export tools must not silently complete assignments, grant rewards, record attendance, approve mastery, or rewrite source learning records. Learner-safe print/CSV output excludes adult-only notes and remains optional support material only.

Learner-route resolution is advisory. Route selection and local completion markers must not award XP, coins, grades, attendance, mastery, portfolio approval, or rewrite learning records.

The offline runtime contract blocks programmatic external requests but does not remove intentional adult-visible links to reputable learning sources. No network service is required for the loaded application to continue operating.

See `docs/roadmap-v10.42-v10.51.md` for the maintained 10-release roadmap.

## License

Copyright © 2026. All rights reserved. No license is granted to copy, redistribute, or commercially use this source without permission.
