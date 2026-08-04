# v11.0.0-beta.4 Hosted Preview Runbook

This runbook covers the owner-controlled activation of the non-production hosted pilot. The repository can prepare, validate, and deploy the preview after provider resources exist, but it cannot create or own the external accounts on the owner’s behalf.

## Hard boundaries

- v10.43 remains the stable production and downloadable fallback.
- Use a dedicated non-production Supabase project with synthetic data only.
- Do not point the v10 production hostname at v11.
- Do not put service-role keys, database passwords, personal access tokens, OAuth secrets, or BAND tokens in browser variables or Git.
- Do not apply migrations automatically from a pull-request workflow.
- Do not enter real student names, records, evidence, accommodations, grades, or family schedules during this pilot.

## 1. Create the non-production Supabase project

Create a separate Supabase project and choose the region intentionally. Record privately:

- project reference;
- HTTPS project URL;
- publishable browser key;
- database password for owner-controlled CLI linking;
- Supabase access token, only when needed by the owner’s local CLI.

The browser needs only the project URL and publishable key. A service-role or `sb_secret_` key must never be placed in `VITE_SUPABASE_PUBLISHABLE_KEY`.

## 2. Review and apply migrations `001–008`

From a trusted local checkout of the exact beta.4 commit:

```bash
cd v11
npm install --no-package-lock
npm run verify
npm run db:start
npm run db:reset
npm run db:test
npm run db:stop
npx supabase login
npx supabase link --project-ref PROJECT_REFERENCE
npx supabase db push --dry-run
```

Review the dry-run output. It must end at:

```text
202608040008_v11_hosted_pilot.sql
```

Only after review:

```bash
npx supabase db push
```

Migration `008` adds client-record-ID-preserving objective scoring and a non-sensitive authenticated schema-status RPC. It does not enable production data.

## 3. Configure authentication

In the non-production project:

1. Keep anonymous sign-in disabled.
2. Keep adult email/password sign-up enabled only for the bounded pilot.
3. Require email confirmation before outside testing.
4. Set the Site URL to the future v11 preview origin.
5. Add only the intended preview origin to redirect URLs.
6. Configure a recognizable sender before sending invitations.
7. Do not create independent learner logins. Learners remain parent-assisted profiles.
8. Do not enable social providers until their privacy and redirect boundaries are reviewed.

## 4. Create the synthetic pilot verifier account

Create one disposable adult account containing no family information. It exists only so the protected deployment workflow can authenticate and call `hosted_pilot_schema_status()`.

Store its credentials only as protected GitHub environment secrets:

```text
PILOT_TEST_EMAIL
PILOT_TEST_PASSWORD
```

Delete or rotate this account after the pilot.

## 5. Configure the protected GitHub environment

Create a GitHub Actions environment named exactly:

```text
v11-preview
```

Recommended protections:

- required owner review;
- deployment restricted to `main`;
- no untrusted fork deployment;
- prevent self-review when another trusted reviewer is available.

Environment secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
VITE_SUPABASE_PUBLISHABLE_KEY
PILOT_TEST_EMAIL
PILOT_TEST_PASSWORD
```

Environment variables:

```text
VITE_SUPABASE_URL
V11_PREVIEW_URL
```

Scope the Cloudflare token only to the intended account and isolated preview Worker.

## 6. Run the pilot doctor

From a protected environment containing the provider values:

```bash
npm run pilot:doctor
```

The doctor checks only configuration presence, safe URL/host boundaries, browser-key privilege, migration ordering, and Worker isolation. It writes `pilot-doctor-report.json` without printing or storing secret values.

Expected outcomes:

- exit `0`: configuration is ready;
- exit `2`: required provider settings are missing;
- exit `1`: unsafe configuration was detected.

## 7. Verify the remote schema

With the synthetic verifier credentials available only in the protected environment:

```bash
npm run pilot:verify-schema
```

The verifier:

- authenticates with the publishable browser key;
- calls the authenticated `hosted_pilot_schema_status()` RPC;
- confirms beta.4 and migration `008`;
- confirms production data remains disabled;
- writes a sanitized `remote-schema-report.json`;
- signs out and does not persist the session.

## 8. Configure the isolated Cloudflare preview

The Worker name is fixed:

```text
beaufort-learning-harbor-v11-preview
```

`V11_PREVIEW_URL` must be its HTTPS origin without an application path. It may be a dedicated `workers.dev` URL or preview hostname. Never reuse the v10 production Worker name or hostname.

## 9. Run the manual deployment

In GitHub Actions, select **Deploy v11 Preview**, choose **Run workflow**, and select:

```text
DEPLOY_V11_PREVIEW
```

The workflow performs, in order:

1. exact dependency installation;
2. TypeScript, boundary, and production-build validation;
3. pilot doctor validation;
4. protected deployment-boundary validation;
5. authenticated remote schema verification;
6. deployment of only the isolated v11 preview Worker;
7. `/api/health` verification for beta.4;
8. `/api/config` verification for authority, reconciliation, recovery, and no-production boundaries;
9. upload of sanitized doctor, schema, health, configuration, and deployment receipts.

Any failure stops the workflow. No deployment occurs automatically on push or merge.

## 10. Run the bounded hosted pilot

Use synthetic adult accounts and synthetic learner records. Validate:

1. organization bootstrap and invitation acceptance;
2. parent-managed household and learner creation;
3. Today assignment and supervised learner handoff;
4. objective check scoring and one hosted attempt after retry;
5. proof submission, return, revision, and adult acceptance;
6. seven-day weekly planning and rejection of an eighth-day item;
7. temporary offline work, visible queue state, reconnect, and ordered acknowledgement;
8. failed operation retry and cancellation;
9. no duplicate record after repeating an operation;
10. no automatic grade, mastery, attendance, XP, completion, or portfolio approval;
11. Director, unrelated Parent, Teacher, and System Administrator household-record denial;
12. conflict visibility when synthetic local and hosted records intentionally diverge;
13. encrypted backup export, preview, restore, and emergency rollback;
14. sanitized diagnostics download containing no learner content or queue payloads;
15. desktop, touch-tablet, and Pixel 7 presentation.

## 11. Record findings safely

A public GitHub finding may include:

- synthetic role and device class;
- action attempted;
- expected and observed behavior;
- queue status and operation kind;
- whether a duplicate or conflict was detected;
- non-reversible diagnostic digests;
- a screenshot only when it contains no names, emails, learner work, invitation codes, credentials, or provider identifiers.

Never paste a database row, access token, session, private support thread, backup, or real family detail into GitHub.

## 12. Rollback and shutdown

The v10 application is unchanged. To stop the hosted pilot:

1. disable or delete the isolated v11 preview Worker;
2. remove its preview hostname;
3. export only necessary synthetic test artifacts;
4. delete or pause the non-production Supabase project;
5. remove or rotate the synthetic verifier account and GitHub environment secrets;
6. retain sanitized deployment receipts and the Git commit for audit history.

No v10 rollback is required because beta.4 does not alter the stable Worker or release pointer.

## Next release

After hosted pilot findings are resolved, proceed to `v11.0.0-rc.1 — Migration Rehearsal and Production Readiness`.
