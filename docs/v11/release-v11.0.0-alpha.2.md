# Beaufort Learning Harbor v11.0.0-alpha.2

## Hosted Preview Readiness and Identity Bootstrap

Alpha 2 turns the cloud-ready foundation into a reproducible identity and deployment preview. It remains isolated from production and does not contain real family or student data.

## Added

- Email/password account creation with optional provider-controlled email confirmation.
- Sign-in, sign-out, password recovery request, and recovery password update workflows.
- A first-organization bootstrap flow for authenticated accounts without membership.
- One-time, expiring organization invitation codes.
- Invitation creation, listing, revocation, redemption, acceptance, and replay protection.
- Role-limited invitations for Student, Parent/Guardian, Teacher/Facilitator, Director, and Group Administrator.
- Explicit denial of invitation-based System Administrator access.
- Membership directory and invitation administration workspace.
- Local-preview membership and invitation adapters using synthetic browser-local records.
- Hosted and loopback Supabase URL validation with service-role-key rejection.
- Pinned Supabase CLI and reproducible local Supabase configuration.
- Database reset and pgTAP validation from an empty local database.
- Protected manual Cloudflare preview deployment workflow using the `v11-preview` GitHub environment.
- Deployment readiness validation, health verification, and machine-readable deployment receipts.
- Security headers for Worker-served API and application responses.

## Security boundaries

- Organization creation uses an authenticated bootstrap RPC rather than direct browser inserts.
- A new account may bootstrap only when it has no active organization membership.
- Group Administrators cannot create, modify, delete, or invite System Administrator memberships.
- Invitation tokens are generated with 256 bits of randomness, stored only as SHA-256 hashes, displayed once, expire, and cannot be replayed.
- Membership and invitation records remain protected by Row-Level Security.
- Administrators may view member display names only within organizations they manage.
- The Cloudflare deployment requires an explicit `DEPLOY_V11_PREVIEW` confirmation and protected environment credentials.
- No service-role key is required by the browser or committed workflow.

## Validation

- Strict TypeScript and exact dependency checks.
- Cloudflare Worker and Vite production build.
- Local Supabase startup, database reset, migrations, and pgTAP tests.
- Desktop, touch-tablet, and Pixel 7 membership, support, privacy, and overflow workflows.
- Existing v10.43 release integrity and browser suites.

## Not included

- Creation of the account owner's hosted Supabase project.
- Entry of Cloudflare or Supabase secrets.
- Automatic preview deployment.
- Production deployment.
- Real user invitations or family records.
- Parent-managed child accounts.
- MFA enrollment.
- BAND integration.
- v10.43 data migration.
- File uploads, backup automation, or full offline synchronization.

The account owner must create the preview Supabase project and protected GitHub environment before the manual deployment workflow can run. The release deliberately fails closed when those values are absent.