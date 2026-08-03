# Beaufort Learning Harbor v11.0.0-alpha.1

## Cloud-Ready TypeScript Foundation

This release begins the v11 migration beside the stable v10.43 application. It is a technical and UX foundation preview, not a production replacement.

## Added

- Strict TypeScript, React, and Vite application source under `v11/`.
- Cloudflare Vite integration with one Worker serving preview API routes and application assets.
- Isolated `beaufort-learning-harbor-v11-preview` Worker configuration.
- `/api/health` and `/api/config` boundaries.
- Safe Supabase browser configuration with service-role-key rejection and local-preview fallback.
- Supabase email/password sign-in readiness and organization-membership resolution.
- Typed Student, Parent/Guardian, Teacher/Facilitator, Director, Group Administrator, and System Administrator/Developer roles.
- Role-aware desktop, tablet, and mobile application shell.
- Local-preview Help & Feedback workflow with private ticket conversations.
- Organization support triage, ticket status updates, public replies, and administrator-only internal notes.
- Supabase support repository adapter for the same ticket workflow after cloud configuration.
- Initial Supabase Postgres schema for profiles, organizations, memberships, households, learners, support, and audit events.
- Row-Level Security policies that separate household, organization, support, and administrator access.
- Fail-closed teacher household visibility until explicit teaching assignments are implemented.
- Strict dependency pinning, privacy/secret checks, and desktop/tablet/Pixel 7 browser coverage.
- Architecture, setup, migration, and service-owner documentation.

## Preserved

- v10.43 remains the stable release pointer and validated offline fallback.
- Existing v10.43 build, integrity, privacy, role, route, accessibility, and browser validation remain unchanged.
- No production Worker is replaced.
- No real family or student data is introduced.
- No automatic learning outcome, reward, attendance, mastery, portfolio, or record mutation is added.

## Not included

- Production Supabase project creation or credentials.
- Production deployment.
- Real account invitations.
- Parent consent workflows.
- File uploads or Supabase Storage.
- BAND OAuth or posting.
- R2 backup automation.
- v10.43 data migration.
- Full offline synchronization.

## Evaluation focus

Alpha 1 is intended to answer four questions:

1. Is the new shell clearer and calmer than the legacy navigation model?
2. Are the account, household, organization, and administrator boundaries correct?
3. Does the built-in feedback system support students, families, directors, and developers without exposing private data?
4. Can the new stack be built, tested, and hosted independently while v10.43 remains safe?
