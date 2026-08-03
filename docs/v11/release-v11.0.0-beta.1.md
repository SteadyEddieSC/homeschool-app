# Beaufort Learning Harbor v11.0.0-beta.1

## Parent-Managed Learners and Today Workflow

Beta 1 turns the identity preview into the first complete household learning workflow. It remains isolated from production and contains only synthetic validation data.

## Added

- Parent-managed learner profiles that do not require learner email addresses.
- Preferred name, optional pronouns, grade band, avatar, status, and parent-assisted access metadata.
- Household creation restricted to Parent/Guardian and Group Administrator roles.
- A Learners workspace for household managers.
- A supervised device-handoff mode that removes adult navigation until the adult exits.
- Learn, Practice, Quiz/Test, and Proof Today item types.
- Adult assignment of a bounded Today item to a household learner.
- Learner start and send-for-review actions.
- Explicit adult complete or return decisions with optional completion feedback and required return feedback.
- Audit events for every Today status transition.
- Browser-local and Supabase implementations of the same workflow.
- A new family-visibility policy that excludes Teacher, Director, unrelated Parent, and System Administrator roles unless an explicit future relationship grants access.
- Database and browser coverage for household isolation, learner creation, supervised handoff, adult review, and automatic-outcome denial.

## Privacy and authorization boundaries

- A learner profile is not a Supabase Auth account and has no required email address.
- Parent-assisted learner mode is a supervised convenience, not an independent authentication boundary.
- The adult account remains the database actor during supervised handoff, and the application records the explicit action in the audit trail.
- Organization membership alone does not reveal household learner records.
- Teacher and Director access remains fail-closed until explicit teaching assignments or rosters are introduced.
- System Administrator access does not automatically reveal family learner records.
- Today items contain no grade, XP, attendance, mastery, or portfolio-approval columns.
- A learner cannot create a final outcome; completion requires an explicit household-manager review transition.
- Direct client updates and deletes on Today items are revoked. Status changes use the constrained transition RPC.

## Validation

Required validation includes:

- strict TypeScript;
- exact pinned dependencies;
- secret and architecture boundary checks;
- Cloudflare Worker and Vite production build;
- local Supabase startup and reset from migrations `001` through `005`;
- the existing identity and invitation pgTAP suite;
- the new household, learner, Today, cross-household denial, and no-automatic-outcome pgTAP suite;
- Chromium desktop, touch-tablet, and Pixel 7 workflows;
- the unchanged v10.43 regression and release artifact suite.

## Not included

- Production deployment.
- Creation or configuration of the hosted Supabase project.
- Real family or learner data.
- Independent learner email/password authentication.
- Learner PIN authentication.
- File or photo proof uploads.
- Automated quiz scoring.
- Automatic grades, XP, attendance, mastery, portfolio approval, or permanent transcript records.
- BAND integration.
- v10.43 data migration.
- Full offline synchronization.

## Recommended next action

Configure the protected `v11-preview` Supabase and Cloudflare environment, review the migration dry run, and conduct a bounded household pilot using synthetic or disposable records. Do not migrate v10.43 or cut over production until the hosted pilot, backup, recovery, and offline behavior have been verified.

## Next recommended release

`v11.0.0-beta.2 — Hosted Household Pilot, Offline Queue, and Recovery`

Beta 2 should connect the owner-controlled preview, add clear synchronization state and a retryable offline mutation queue, verify backup and recovery procedures, and capture pilot findings without beginning production migration.
