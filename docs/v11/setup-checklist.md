# v11 Service Setup Checklist

This checklist separates account-owner actions from work that can be automated in the repository. Alpha 1 does not require completing these steps.

## Supabase

### Account-owner actions

1. Create or select the Supabase organization.
2. Create a dedicated non-production project in a nearby United States region.
3. Record the project reference and public project URL.
4. Place the publishable browser key into the preview environment only.
5. Keep the database password, service-role key, and access tokens outside Git and outside `VITE_` variables.
6. Review authentication email settings before inviting anyone.
7. Approve production upgrade only when real families are ready to depend on the service.

### Repository automation

After project ownership exists, the development workflow can:

- link the project through the Supabase CLI;
- apply reviewed SQL migrations;
- generate database TypeScript types;
- run database linting and policy tests;
- configure non-secret public browser values;
- add server-side secrets through approved secret stores;
- deploy future Edge Functions when required;
- verify schema and Row-Level Security drift.

## Cloudflare

### Account-owner actions

1. Keep ownership of the existing Cloudflare account and domain.
2. Authorize the repository installation if the v11 preview receives its own connected deployment.
3. Approve the first preview Worker deployment.
4. Add a preview hostname only after the preview is ready for outside review.
5. Enter secrets directly into Cloudflare secret storage when requested.

### Repository automation

The repository can:

- build the React application and Worker together;
- deploy the isolated `beaufort-learning-harbor-v11-preview` Worker;
- create environment-specific configuration;
- run migrations and smoke tests before deployment;
- add future R2 bindings and scheduled backup jobs;
- publish deployment and rollback evidence.

## BAND

### Account-owner actions

1. Register the developer service with BAND.
2. Complete any required preliminary review.
3. Receive the client ID and client secret.
4. Authorize the intended BAND account and choose permitted Bands.
5. Approve the exact permissions requested by the application.

### Repository automation after approval

The application can implement:

- server-side OAuth exchange and refresh-token handling;
- a reviewed “Share to BAND” workflow;
- selected announcement and reminder publishing;
- optional scheduled polling for approved inbound content;
- audit events and disconnect/revoke controls.

BAND credentials and private student records must never be delivered to browser code or committed to Git.

## Production prerequisites

Before real group invitations:

- privacy policy and terms reviewed;
- parent/guardian consent process defined;
- account deletion and data export tested;
- MFA required for privileged administrators;
- backup and restore drill completed;
- transactional email configured;
- support and privacy escalation workflow staffed;
- production Supabase policies tested with each role;
- v10.43 export and recovery path preserved;
- no real names, screenshots, or family data in the public repository.
