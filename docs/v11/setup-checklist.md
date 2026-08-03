# v11 Service Setup Checklist

This checklist separates account-owner actions from work automated by the repository. Beta 1 can be built and validated without external credentials; a hosted preview requires the owner-controlled steps below. See `hosted-preview-runbook.md` for the exact deployment and household-pilot sequence.

## Supabase

### Account-owner actions

1. Create or select the Supabase organization.
2. Create a dedicated non-production project in an appropriate United States region.
3. Record the project reference, HTTPS project URL, and publishable browser key.
4. Keep the database password, service-role key, and access tokens outside Git and outside `VITE_` variables.
5. Link the reviewed local repository to the preview project.
6. Run a migration dry run before applying beta.1 migrations remotely.
7. Configure the preview Site URL and redirect URLs.
8. Require email confirmation before inviting outside testers.
9. Configure a recognizable transactional-email sender before using real addresses.
10. Keep anonymous sign-in disabled.
11. Do not create learner email/password accounts for beta 1.
12. Approve production upgrade only after recovery, backup, privacy, role, household, and offline testing are complete.

### Repository automation

The repository provides:

- a pinned project-scoped Supabase CLI;
- reproducible local project configuration;
- migration reset from an empty database;
- pgTAP policy, identity-bootstrap, invitation, family-visibility, and Today-transition tests;
- reviewed SQL migrations for organizations, memberships, invitations, support, households, learners, Today items, and audit events;
- exact browser configuration checks;
- rejection of service-role credentials in browser configuration;
- constrained status transitions rather than direct client updates;
- future-compatible paths for generated database types and remote schema-drift checks.

## GitHub Actions environment

Create a protected environment named exactly:

```text
v11-preview
```

Recommended controls:

- require repository-owner approval;
- limit deployments to `main`;
- prevent untrusted fork deployments;
- keep secrets environment-scoped rather than repository-wide.

Environment secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
VITE_SUPABASE_PUBLISHABLE_KEY
```

Environment variables:

```text
VITE_SUPABASE_URL
V11_PREVIEW_URL
```

The deployment workflow fails before Wrangler runs when any required value is missing or unsafe.

## Cloudflare

### Account-owner actions

1. Keep ownership of the existing Cloudflare account and domain.
2. Create a narrowly scoped API token for the preview deployment.
3. Approve the first deployment through the protected GitHub environment.
4. Add a preview hostname only after the isolated Worker responds correctly.
5. Keep the v10 production hostname and Worker unchanged.

### Repository automation

The repository can:

- build the React application and Worker together;
- validate the isolated `beaufort-learning-harbor-v11-preview` target;
- deploy only after the exact `DEPLOY_V11_PREVIEW` manual confirmation;
- verify the deployed `/api/health` release and service identity;
- verify the reviewed-learning `/api/config` boundary;
- publish a machine-readable deployment receipt;
- preserve rollback evidence without exposing credentials.

## Identity and household bootstrap

After the preview is deployed:

1. Create the first adult account.
2. Confirm its email address.
3. Create the first organization.
4. Verify the account becomes Group Administrator, not System Administrator.
5. Create synthetic Parent, Teacher, Director, and Student invitations.
6. Verify expiration, revocation, replay denial, and role-specific navigation.
7. Sign in as a synthetic Parent/Guardian.
8. Create one synthetic household and one learner without a learner email.
9. Verify Teacher, Director, unrelated Parent, and System Administrator accounts cannot view that learner.
10. Test password recovery and sign-out.
11. Remove synthetic identities and records before any later production transition.

System Administrator memberships are never created through invitations and do not automatically grant family-record access.

## Household pilot

Before considering v10.43 migration:

- use only synthetic or disposable records;
- assign at least one Learn and one Practice Today item;
- verify supervised learner handoff removes adult navigation;
- verify the learner can start and send work for review but cannot create a final outcome;
- verify an adult explicitly completes or returns work;
- verify return feedback is required;
- verify no grade, XP, attendance, mastery, or portfolio outcome appears;
- test desktop, touch-tablet, and Pixel 7 workflows;
- test a temporary network interruption and record behavior without repeated action presses;
- sanitize every issue or screenshot before placing it in the public repository.

A retryable offline mutation queue is not included in beta 1. It is the next release priority.

## BAND

### Account-owner actions

1. Register the developer service with BAND.
2. Complete any required preliminary review.
3. Receive the client ID and client secret.
4. Authorize the intended BAND account and choose permitted Bands.
5. Approve the exact permissions requested by the application.

### Repository automation after approval

The application can later implement:

- server-side OAuth exchange and refresh-token handling;
- a reviewed “Share to BAND” workflow;
- selected announcement and reminder publishing;
- optional scheduled polling for approved inbound content;
- audit events and disconnect/revoke controls.

BAND remains deferred. Its credentials and private learner records must never be delivered to browser code or committed to Git.

## Production prerequisites

Before real group invitations or family records:

- privacy policy and terms reviewed;
- parent/guardian consent process defined;
- account deletion and data export tested;
- MFA required for privileged administrators;
- backup and restore drill completed;
- transactional email configured;
- support and privacy escalation workflow staffed;
- production Supabase policies tested with each role;
- invitation issuance and revocation procedures documented;
- parent-assisted learner handoff clearly explained;
- offline retry and duplicate-prevention behavior tested;
- v10.43 export and recovery path preserved;
- no real names, screenshots, invitation codes, learner work, or family data in the public repository.

## Recommended next action and release

After beta 1, configure the protected hosted preview and run the bounded household pilot.

The next recommended release is `v11.0.0-beta.2 — Hosted Household Pilot, Offline Queue, and Recovery`.
