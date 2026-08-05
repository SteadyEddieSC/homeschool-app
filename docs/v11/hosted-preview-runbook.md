# v11 RC.2 Hosted Preview Runbook

This runbook covers owner-controlled activation of the non-production hosted pilot from the verified `11.0.0-rc.1` baseline through the future RC.2 evidence package. The repository can prepare, validate, and deploy the preview after provider resources exist, but it cannot create or own external accounts on the owner’s behalf.

The current released candidate remains `11.0.0-rc.1` until hosted evidence is complete and the exact RC.2 candidate is assembled. v10.43 remains the stable production and downloadable fallback.

See `rc2-hosted-pilot-plan.md` and GitHub issue #47 for the release gates, evidence register, defect rules, and stop conditions.

## Hard boundaries

- Use one dedicated non-production Supabase project.
- Use synthetic adult accounts, synthetic households, and synthetic learners first.
- Do not point the v10 production hostname at v11.
- Do not migrate real v10.43 records during RC.2.
- Do not put service-role keys, database passwords, personal access tokens, OAuth secrets, BAND tokens, email credentials, Cloudflare tokens, sessions, or recovery tokens in browser variables, Git, reports, logs, or artifacts.
- Do not apply migrations automatically from a pull-request workflow.
- Do not enter real student names, records, evidence, accommodations, grades, attachments, or family schedules until a separately approved real-family pilot is authorized.
- Do not represent local CI, configuration files, or a workflow definition as proof that a provider resource exists or is healthy.
- Keep live migration, production data, automated promotion, production readiness, and production cutover disabled.

## 1. Create the non-production Supabase project

The owner creates a separate project and chooses the region intentionally. Record privately:

- project reference;
- HTTPS project URL;
- publishable browser key;
- database password for owner-controlled CLI linking;
- Supabase access token only when needed by the owner’s local CLI.

The browser needs only the HTTPS project URL and intended publishable key. A service-role key, `sb_secret_` key, database password, or owner access token must never be placed in `VITE_SUPABASE_PUBLISHABLE_KEY` or browser code.

## 2. Validate locally before linking a provider

Use a trusted checkout of the exact branch/head being evaluated:

```bash
cd v11
npm install --no-package-lock
npm run verify
npm run db:start
npm run db:reset
npm run db:test
npm run db:stop
```

Expected local boundaries:

- migrations rebuild from `001–009`;
- migration `009` remains synthetic-rehearsal-only;
- live migration is disabled;
- production data is disabled;
- production cutover is not approved;
- owner approval remains required;
- the stable v10.43 workflow is unchanged and separately green.

## 3. Link and review migrations `001–009`

From the owner-controlled environment:

```bash
npx supabase login
npx supabase link --project-ref PROJECT_REFERENCE
npx supabase db push --dry-run
```

Review the complete dry run. It must end at:

```text
202608040009_v11_migration_rehearsal.sql
```

Do not continue when the target project is uncertain, the migration order differs, an unexpected destructive statement appears, or the output references a production project.

Only after review:

```bash
npx supabase db push
```

Migration `008` provides the hosted-pilot repository/RPC baseline. Migration `009` adds synthetic-only migration-rehearsal receipts and authenticated release-candidate readiness status while keeping live migration, production data, and cutover disabled.

## 4. Configure authentication and sender boundaries

In the dedicated non-production project:

1. Keep anonymous sign-in disabled.
2. Enable adult email/password sign-up only for the bounded pilot.
3. Require email confirmation before testing invitations or recovery outside the owner’s account.
4. Set the Site URL to the isolated v11 preview origin.
5. Add only the intended preview origin to redirect URLs.
6. Configure a recognizable non-production sender before sending confirmation, invitation, or recovery messages.
7. Do not create independent learner logins. Learners remain parent-managed profiles with supervised handoff.
8. Do not enable social providers until their privacy, consent, secret-storage, and redirect boundaries are reviewed.
9. Configure bounded authentication and email rate limits suitable for synthetic testing.
10. Record bounce, complaint, and sender-domain behavior without placing recipient addresses in GitHub.

## 5. Create the synthetic verifier account

Create one disposable adult account containing no family information. It exists only so the protected deployment workflow can authenticate and call:

- `hosted_pilot_schema_status()` from migration `008`;
- `release_candidate_readiness_status()` from migration `009`.

Store its credentials only as protected GitHub environment secrets:

```text
PILOT_TEST_EMAIL
PILOT_TEST_PASSWORD
```

Delete or rotate the account after the pilot.

## 6. Configure the protected GitHub environment

Create a GitHub Actions environment named exactly:

```text
v11-preview
```

Recommended protections:

- required owner review;
- deployment restricted to the intended release branch and later exact candidate head;
- no untrusted fork deployment;
- prevent self-review when another trusted reviewer is available;
- least-privilege, short-lived, or regularly rotated provider credentials.

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

Scope the Cloudflare token only to the intended account and isolated preview Worker. Never reuse a production-wide token when a narrower token is available.

## 7. Run the pilot doctor

From the protected environment containing provider values:

```bash
npm run pilot:doctor
```

The doctor checks configuration presence, URL/host boundaries, browser-key privilege, migration ordering, and Worker isolation. It writes `pilot-doctor-report.json` without printing or storing secret values.

Expected outcomes:

- exit `0`: configured values passed the structural checks;
- exit `2`: required provider settings are missing;
- exit `1`: unsafe configuration was detected.

A successful doctor report proves only structural configuration readiness. It does not prove that remote migrations, authentication, deployment, email, backup, monitoring, or hosted workflows are healthy.

## 8. Verify the remote schema

With the disposable synthetic verifier credentials available only in the protected environment:

```bash
npm run pilot:verify-schema
```

The verifier:

- authenticates with the publishable browser key;
- calls `hosted_pilot_schema_status()` and verifies the beta.4/migration-008 hosted baseline;
- calls `release_candidate_readiness_status()` and verifies the RC.1/migration-009 boundary;
- confirms production data, live migration, and production cutover remain disabled;
- confirms owner approval remains required;
- writes sanitized `remote-schema-report.json`;
- signs out and does not persist the session.

Do not continue when either RPC is missing, the release/migration markers differ, privileged browser credentials are detected, or a production/cutover flag is enabled.

## 9. Configure the isolated Cloudflare preview

The Worker name is fixed:

```text
beaufort-learning-harbor-v11-preview
```

`V11_PREVIEW_URL` must be its HTTPS origin without an application path. It may be a dedicated `workers.dev` URL or isolated preview hostname. Never reuse the v10 production Worker name or production hostname.

Before deployment, verify:

- the token can affect only the intended preview resource where practical;
- the configured host does not collide with the v10 production origin;
- logs and observability do not intentionally capture request bodies, authorization headers, sessions, learner work, or private support content;
- caching rules cannot make authenticated or private API responses publicly cacheable.

## 10. Run the manual deployment

In GitHub Actions, select **Deploy v11 Preview**, choose **Run workflow**, and select:

```text
DEPLOY_V11_PREVIEW
```

The workflow performs, in order:

1. exact dependency installation;
2. TypeScript, architecture/boundary, migration rehearsal, readiness, recovery, and production-build validation;
3. pilot doctor validation;
4. protected deployment-boundary validation;
5. authenticated remote schema verification for migrations `008` and `009`;
6. deployment only to the isolated v11 preview Worker;
7. `/api/health` verification for the exact release;
8. `/api/config` verification for authority, synchronization, migration, recovery, hosted-pilot, and no-production boundaries;
9. upload of sanitized doctor, schema, health, configuration, and deployment receipts.

Any failure stops the workflow. Deployment remains manual and does not run automatically on push or merge.

## 11. Independently verify the deployed origin

Do not report the preview healthy solely because the deployment workflow succeeded. Independently check the exact public preview origin:

- HTTPS certificate and expected hostname;
- `/api/health` returns `ok=true`, the expected release, and the isolated Worker service name;
- `/api/config` keeps production data, live migration, automated promotion, and production cutover disabled;
- security headers include the intended CSP, frame denial, referrer policy, content-type protection, and permissions policy;
- authenticated/private responses are not publicly cached;
- the origin is visually and functionally separate from v10 production.

Record only the approved public preview hostname and sanitized status evidence.

## 12. Run the synthetic hosted pilot

Use synthetic adults and synthetic learners. Validate:

1. account creation, confirmation, sign-in, sign-out, recovery request, password update, session expiry, and reauthentication;
2. first-organization bootstrap;
3. invitation creation, expiration, revocation, redemption, replay denial, and role restrictions;
4. parent-managed household and learner creation;
5. Today assignment and supervised learner handoff;
6. learner start and review submission;
7. objective check scoring and exactly one hosted attempt after retry;
8. proof submission, return, revision, preserved history, and explicit adult acceptance;
9. seven-day planning and rejection of an eighth-day item;
10. temporary offline work, visible queue state, reconnect, and ordered acknowledgement;
11. failed operation retry and safe cancellation;
12. no duplicate hosted record after repeating an operation;
13. no automatic grade, mastery, attendance, XP, completion, or portfolio approval;
14. Director, unrelated Parent, Teacher, and System Administrator household-record denial unless an explicit relationship authorizes access;
15. no ordinary invitation path to System Administrator;
16. conflict visibility when synthetic local and hosted records intentionally diverge;
17. encrypted backup export, restore preview, confirmed restore, and emergency rollback;
18. hosted database backup/restore rehearsal and vendor-exit restore into an empty environment;
19. sanitized diagnostics containing no learner content, private support text, provider credentials, sessions, or queue payloads;
20. desktop, touch-tablet, and Pixel 7 presentation;
21. confirmation, invitation, and recovery delivery behavior;
22. authentication/invitation abuse controls and rate limits;
23. provider quotas, storage, connections, egress, monitoring, and alert routing;
24. preview shutdown, credential rotation, verifier deletion, and Supabase pause/delete procedures.

Use the stop conditions in `rc2-hosted-pilot-plan.md`. A blocker condition ends the pilot until corrected.

## 13. Record findings safely

A public GitHub finding may include:

- synthetic role and device class;
- action attempted;
- expected and observed behavior;
- bounded error code;
- queue status and operation kind without payload;
- whether a duplicate or conflict was detected;
- release, migration, commit, and run identifiers;
- non-reversible diagnostic digests;
- a screenshot only when it contains no names, emails, learner work, invitation codes, credentials, sessions, provider identifiers, or private support text.

Never paste raw database rows, access tokens, sessions, private support threads, backups, email addresses, project references, database URLs, or real family details into GitHub.

Every defect must include severity, synthetic reproduction, affected role/device, privacy/security impact, fix commit, exact-head validation, and closure or explicit owner acceptance.

## 14. Backup, outage, rollback, and shutdown

The v10 application remains unchanged. To stop the hosted pilot:

1. disable or delete the isolated v11 preview Worker;
2. remove its preview hostname or route;
3. export only necessary sanitized evidence and approved synthetic recovery packages;
4. complete the planned hosted restore or vendor-exit exercise before destructive provider deletion when required;
5. delete or pause the non-production Supabase project;
6. remove or rotate the synthetic verifier account and GitHub environment secrets;
7. revoke or rotate the Cloudflare token;
8. retain sanitized deployment, schema, recovery, and shutdown receipts plus the Git commit for audit history;
9. verify the stable v10.43 application and downloadable artifact remain available.

No v10 rollback is required because the hosted pilot must not alter the stable Worker, stable release pointer, production hostname, or v10.43 data.

## 15. Assemble the exact RC.2 candidate

Only after the hosted pilot evidence exists and release-blocking defects are closed:

1. advance package, runtime, Worker, validation, artifact, and documentation markers to `11.0.0-rc.2` in one bounded release change;
2. rerun local database and responsive browser validation;
3. rerun the unchanged v10.43 workflow;
4. rerun the protected hosted schema/deployment evidence against the exact final RC.2 head;
5. publish the exact-head RC.2 preview artifact and sanitized evidence package;
6. record `no-go`, `pilot-extension`, or `eligible-for-separate-production-decision`.

RC.2 does not authorize production migration or cutover. Production remains a separate release and explicit owner decision.
