# Beaufort Learning Harbor v11

`v11/` is the cloud-ready TypeScript application being developed beside the stable v10.43 single-file application.

## Current preview — v11.0.0-alpha.2

Alpha 2 preserves the alpha.1 architecture and adds hosted-preview and identity-bootstrap readiness:

- React and strict TypeScript source;
- Vite and one isolated Cloudflare Worker;
- Supabase Auth sign-in, sign-up, confirmation messaging, sign-out, and password recovery;
- authenticated onboarding for accounts that do not yet have a group membership;
- first-organization bootstrap that creates a Group Administrator, never a System Administrator;
- one-time, expiring organization invitations stored as hashes in Postgres;
- invitation creation, revocation, redemption, expiration, and replay protection;
- a role-aware member directory and invitation workspace;
- local-preview equivalents for UX testing without provider credentials;
- Postgres Row-Level Security and pgTAP database-policy tests;
- a protected, manual-only Cloudflare preview deployment workflow;
- deployment health verification and a machine-readable receipt.

This release does **not** replace v10.43, deploy automatically, migrate family data, configure BAND, create parent-managed child accounts, or award learning outcomes.

## Run the application locally

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

The app runs at `http://127.0.0.1:4173`. Without environment values it displays **Local preview** and uses synthetic browser-local support, membership, and invitation records.

## Run the local Supabase policy suite

Docker must be running for the local Supabase stack.

```bash
npm run db:start
npm run db:reset
npm run db:test
npm run db:stop
```

The reset rebuilds the database from every migration. The pgTAP suite creates transaction-scoped synthetic identities and verifies organization bootstrap, invitation permissions, System Administrator denial, token replay denial, and Row-Level Security behavior.

## Optional Supabase browser configuration

Copy `.env.example` to `.env.local` and enter only public browser values:

```text
VITE_APP_ENV=preview
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=PUBLIC_PUBLISHABLE_KEY
```

For local Supabase development, the URL may be `http://127.0.0.1:54321` with the publishable key shown by `supabase status`.

Never place a Supabase service-role key, BAND secret, provider access token, database password, or private key in a `VITE_` variable. Vite variables are included in browser-delivered code.

## Identity progression

A hosted user follows this sequence:

1. Create or sign in to an account.
2. Confirm the email address when confirmation is enabled.
3. Create the first organization or redeem an invitation.
4. Load the role permitted by the organization membership.
5. Use password recovery when account access is lost.

Invitation roles are limited to Student, Parent/Guardian, Teacher/Facilitator, Director, and Group Administrator. System Administrator access is never granted through an invitation.

## Cloudflare preview

The preview Worker is intentionally named:

```text
beaufort-learning-harbor-v11-preview
```

It is separate from the current `beaufort-learning-harbor` Worker. Validation CI builds an artifact but does not deploy it.

The only repository deployment route is `.github/workflows/deploy-v11-preview.yml`. It requires:

- manual workflow dispatch;
- the exact `DEPLOY_V11_PREVIEW` confirmation;
- a protected GitHub environment named `v11-preview`;
- scoped Cloudflare credentials;
- a hosted Supabase URL and publishable browser key;
- an HTTPS preview origin.

See `docs/v11/hosted-preview-runbook.md` before configuring or running it.

## Privacy boundary

Only synthetic preview data belongs in the repository or public preview. Real accounts, family exports, screenshots, student work, backups, database dumps, and provider credentials must remain outside Git.

Private support submissions remain in the application database. Nothing is copied to the public GitHub repository automatically. Invitation codes are shown once and should be shared directly with the intended member rather than posted publicly.
