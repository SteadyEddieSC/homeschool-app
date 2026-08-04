# Beaufort Learning Harbor v11

`v11/` is the typed, cloud-ready application being developed beside the stable v10.43 single-file application.

## Current preview — v11.0.0-beta.2

Beta 2 preserves the identity, role, household, learner, and adult-review boundaries from beta.1 and adds resilience that can be tested before a hosted Supabase project exists:

- React and strict TypeScript source;
- Vite and one isolated Cloudflare Worker;
- optional Supabase Auth and Postgres integration;
- parent-managed learner profiles without learner email accounts;
- supervised learner-device handoff;
- reviewed Today assignments;
- application-owned local learning mirror;
- ordered persistent mutation queue;
- stable operation IDs and duplicate prevention;
- database receipts for idempotent Today transitions;
- visible Local only, Offline, Pending, Failed, and Synced states;
- explicit retry, cancellation, and queue cleanup controls;
- encrypted portable local-preview backup;
- checksum verification and restore preview;
- local emergency pre-restore snapshot;
- browser-local cloud simulation that transmits no data;
- protected manual-only hosted deployment path.

Beta 2 does **not** replace v10.43, deploy automatically, require Supabase setup, migrate family data, configure BAND, or award automatic learning outcomes.

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

Without environment values, the application displays **Local preview** and stores only synthetic browser-local records.

## Exercise the synchronization queue without Supabase

Open the local preview with:

```text
http://127.0.0.1:4173/?sync-sim=1
```

Simulation uses the real persistent queue but acknowledges operations locally. It sends nothing to Supabase or another provider.

A useful exercise is:

1. enable browser offline mode;
2. create one household, learner, and Today item;
3. confirm three Pending operations;
4. attempt the same learner or assignment again and confirm duplicate rejection;
5. reconnect;
6. confirm ordered completion and a last successful synchronization time;
7. create another pending operation and test Cancel.

## Encrypted backup and restore

The Sync workspace can create an encrypted local-preview backup using:

- PBKDF2 with SHA-256;
- 120,000 derivation iterations;
- AES-256-GCM;
- random salt and initialization vector;
- SHA-256 ciphertext verification.

The backup includes application-owned organization, household, learner, Today, support, and queue data. It excludes sessions, passwords, credentials, deployment secrets, OAuth/BAND tokens, and active invitation tokens.

Restore always verifies and decrypts the file, validates its record counts, displays a preview, and requires explicit confirmation. A malformed or incorrectly decrypted file does not modify local records.

See `docs/v11/offline-recovery.md`.

## Run the local database policy suite

Docker must be running:

```bash
npm run db:start
npm run db:reset
npm run db:test
npm run db:stop
```

The reset rebuilds migrations `001–006`. The pgTAP suites verify identity bootstrap, invitation replay denial, family visibility, cross-household denial, reviewed Today transitions, client operation IDs, idempotent retry receipts, audit-event deduplication, and receipt-forgery denial.

## Optional Supabase browser configuration

Supabase setup is not required for beta.2 local development. When ready, copy `.env.example` to `.env.local` and enter only public browser values:

```text
VITE_APP_ENV=preview
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=PUBLIC_PUBLISHABLE_KEY
```

Never place a service-role key, BAND secret, OAuth access token, database password, or private key in a `VITE_` variable. Vite variables are included in browser-delivered code.

## Hosted preview boundary

The preview Worker remains:

```text
beaufort-learning-harbor-v11-preview
```

It is separate from the current `beaufort-learning-harbor` Worker. Validation CI builds an artifact but does not deploy it. The protected deployment workflow requires manual dispatch, the exact confirmation phrase, environment approval, scoped Cloudflare credentials, and a hosted Supabase URL and publishable key.

## Privacy and authority

- Only synthetic data belongs in the public repository or test artifacts.
- Organization membership alone does not reveal household learner records.
- Parent-assisted learner mode is supervised and is not independent authentication.
- Synchronization is disabled while a hosted user is signed out.
- A local save is not labeled as a cloud synchronization.
- Direct Today updates are prohibited; constrained transitions and operation receipts preserve explicit adult authority.
- Today items contain no automatic grade, XP, attendance, mastery, or portfolio approval.

## Recommended next action

Create the non-production Supabase project later, review `supabase db push --dry-run`, apply migrations only to the preview project, and use beta.2 queue/recovery tools during a synthetic household pilot.

## Next recommended release

`v11.0.0-beta.3 — Evidence, Knowledge Checks, and Family Planning`.

See `docs/v11/roadmap-v11-beta.md`.
