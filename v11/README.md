# Beaufort Learning Harbor v11

`v11/` is the cloud-ready TypeScript application being developed beside the stable v10.43 single-file application.

## Foundation alpha 1

The first alpha establishes:

- React and strict TypeScript source rather than release-by-release HTML string patching;
- Vite development and production builds;
- one Cloudflare Worker for preview API routes and static assets;
- a Supabase-ready authentication client that fails safely into local preview mode when credentials are absent;
- typed Student, Parent/Guardian, Teacher/Facilitator, Director, Group Administrator, and System Administrator/Developer roles;
- an initial Postgres schema and row-level-security boundary for organizations, households, learners, support tickets, support messages, and audit events;
- a responsive role-aware shell with a functional Help & Feedback workflow;
- local preview tickets for UX evaluation before a real Supabase project is connected.

This alpha does **not** replace v10.43, deploy to the production Worker, migrate real family data, configure BAND, or award learning outcomes.

## Run locally

```bash
cd v11
npm install --no-package-lock
npm run verify
npx playwright install chromium
npm run test:e2e
```

Start the interactive preview:

```bash
npm run dev
```

The app runs at `http://127.0.0.1:4173`. Without environment values it displays **Local preview** and stores synthetic support tickets in browser-local storage.

## Optional Supabase browser configuration

Copy `.env.example` to `.env.local` and enter only the public browser values:

```text
VITE_APP_ENV=preview
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=PUBLIC_PUBLISHABLE_KEY
```

Never place a Supabase service-role key, BAND secret, provider access token, database password, or private key in a `VITE_` variable. Vite variables are included in browser-delivered code.

The SQL migrations under `supabase/migrations/` must be reviewed and applied to a dedicated non-production Supabase project before cloud login is tested.

## Cloudflare preview

The preview Worker is intentionally named:

```text
beaufort-learning-harbor-v11-preview
```

It is separate from the current `beaufort-learning-harbor` Worker. No deployment is performed by CI in this alpha.

A manually authorized preview deployment can later use:

```bash
npm run deploy:preview
```

## Privacy boundary

Only synthetic preview data belongs in the repository or public preview. Real accounts, family exports, screenshots, student work, backups, database dumps, and provider credentials must remain outside Git.

The built-in support system is designed so private submissions remain in the application database. Nothing is copied to the public GitHub repository automatically.
