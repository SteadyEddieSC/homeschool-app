# Beaufort Learning Harbor v11

`v11/` is the cloud-ready TypeScript application being developed beside the stable v10.43 single-file application.

## Current preview — v11.0.0-beta.1

Beta 1 preserves the identity and hosted-preview boundaries from alpha.2 and adds the first complete household learning workflow:

- React and strict TypeScript source;
- Vite and one isolated Cloudflare Worker;
- Supabase Auth sign-in, sign-up, confirmation messaging, sign-out, and password recovery;
- first-organization bootstrap and one-time role-limited invitations;
- parent-managed learner profiles without learner email accounts;
- preferred name, optional pronouns, grade band, avatar, and parent-assisted access metadata;
- household-scoped Row-Level Security that does not expose family records from organization membership alone;
- a supervised device-handoff learner mode that hides adult navigation;
- Learn, Practice, Quiz/Test, and Proof Today items;
- explicit learner start and review submission actions;
- explicit adult complete or return decisions;
- browser-local equivalents for credential-free UX testing;
- Postgres migrations and pgTAP authorization tests;
- a protected, manual-only Cloudflare preview deployment workflow;
- deployment health and reviewed-learning configuration verification.

Beta 1 does **not** replace v10.43, deploy automatically, migrate family data, create independent learner logins, configure BAND, or award automatic learning outcomes.

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

Without environment values the application displays **Local preview** and uses synthetic browser-local support, membership, invitation, household, learner, and Today records.

## Run the local Supabase policy suite

Docker must be running for the local Supabase stack.

```bash
npm run db:start
npm run db:reset
npm run db:test
npm run db:stop
```

The reset rebuilds the database from every migration. The pgTAP suites create transaction-scoped synthetic identities and verify organization bootstrap, invitation replay denial, System Administrator restrictions, family visibility, cross-household denial, constrained Today transitions, and the absence of automatic grade, XP, attendance, or mastery fields.

## Optional Supabase browser configuration

Copy `.env.example` to `.env.local` and enter only public browser values:

```text
VITE_APP_ENV=preview
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=PUBLIC_PUBLISHABLE_KEY
```

For local Supabase development, the URL may be `http://127.0.0.1:54321` with the publishable key shown by `supabase status`.

Never place a Supabase service-role key, BAND secret, provider access token, database password, or private key in a `VITE_` variable. Vite variables are included in browser-delivered code.

## Identity and learner progression

A hosted adult follows this sequence:

1. Create or sign in to an adult account.
2. Confirm the email address when confirmation is enabled.
3. Create the first organization or redeem an invitation.
4. Load the role permitted by the organization membership.
5. A Parent/Guardian or Group Administrator creates an authorized household.
6. The household manager creates a learner profile without a learner email.
7. The household manager assigns a Today item.
8. The adult starts supervised learner mode and hands over the device.
9. The learner starts the item and sends it for review.
10. The adult exits learner mode and explicitly completes or returns the work.

Parent-assisted learner mode is not a separate authentication boundary. The adult account remains signed in and remains the database actor. The interface hides adult navigation, restricts available actions, and records explicit status transitions.

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

Organization membership does not automatically reveal household learner records. Teacher, Director, unrelated Parent, and System Administrator roles remain outside a household unless a deliberate relationship or household-management rule grants access.

## Recommended next action and release

After beta.1, configure the owner-controlled hosted preview and conduct a bounded household pilot using synthetic or disposable records.

The next recommended release is `v11.0.0-beta.2 — Hosted Household Pilot, Offline Queue, and Recovery`. See `docs/v11/roadmap-v11-beta.md`.
