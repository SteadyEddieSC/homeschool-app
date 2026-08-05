# RC.2 Hosted Activation Evidence

This document records sanitized non-production provider evidence. It contains no provider keys, account credentials, project reference, personal email address, learner data, queue payload, private support content, or internal provider URL.

## Evidence checkpoint — 2026-08-05

Exact repository branch at activation: `release/v11.0.0-rc.2-hosted-pilot`.

### Supabase project boundary

- provider project label: `Homeschool`;
- owning organization label: `SC Apps`;
- project status before migration: healthy and empty;
- intended use: dedicated non-production synthetic hosted pilot only;
- real-family data authorized: false;
- production data enabled: false;
- live migration enabled: false;
- production cutover approved: false.

### Applied schema

The repository-owned migration sequence was applied in reviewed order through:

- `202608030001_v11_foundation.sql`;
- `202608030002_v11_access_hardening.sql`;
- `202608030003_v11_identity_bootstrap.sql`;
- `202608030004_v11_invite_crypto_hardening.sql`;
- `202608030005_v11_parent_managed_learning.sql`;
- `202608030006_v11_idempotent_sync.sql`;
- `202608040007_v11_learning_studio.sql`;
- `202608040008_v11_hosted_pilot.sql`;
- `202608040009_v11_migration_rehearsal.sql`;
- `202608050010_v11_hosted_acl_hardening.sql`.

After activation:

- public application tables: 20;
- public tables with Row-Level Security enabled: 20;
- application rows: 0;
- anonymous executable security-definer functions: 0;
- directly executable trigger-only functions for authenticated users: 0;
- legacy knowledge-attempt RPC available to authenticated clients: false;
- current client-record-ID-preserving knowledge-attempt RPC available to authenticated clients: true;
- authenticated sanitized ACL-status RPC available: true;
- anonymous ACL-status RPC available: false.

### Hosted defect discovered and closed

The provider initially assigned direct anonymous or inherited `PUBLIC` execute access to public-schema security-definer functions despite earlier migrations revoking `PUBLIC` on selected callable functions. Internal authentication checks prevented unauthenticated business actions, but the exposed RPC surface violated least privilege and produced Supabase security warnings.

The repository-owned migration `202608050010_v11_hosted_acl_hardening.sql` now:

- runs after hosted migration `008` and release-candidate migration `009`;
- revokes function execution from both `PUBLIC` and `anon` across the public schema;
- preserves only explicit authenticated application RPC grants;
- removes direct authenticated execution from trigger-only functions;
- disables the superseded knowledge-attempt RPC;
- preserves the current client-record-ID-aware scoring RPC;
- fixes the mutable search path on `set_updated_at()`;
- provides `hosted_acl_status()` for sanitized authenticated verification.

Direct post-migration ACL inspection verified the corrected state above.

### Repository regression coverage

The RC.2 branch now includes:

- `hosted_acl_test.sql` for local pgTAP verification;
- learning-studio tests that use `submit_knowledge_attempt_v2`;
- pilot-doctor checks requiring migration `010` while retaining migration `009` release-candidate evidence;
- protected remote verification of migrations `008`, `009`, and `010`;
- RC.2 provider-evidence validation covering the ACL state;
- deployment workflow and hosted-preview runbook updates through migrations `001–010`.

## Remaining Gate B work

The Supabase database portion of Gate B is complete. Still required:

- protected GitHub environment `v11-preview`;
- protected publishable Supabase value and synthetic verifier credentials;
- isolated Cloudflare Worker `beaufort-learning-harbor-v11-preview`;
- protected manual deployment;
- authenticated remote schema-status verification;
- independent health/config verification and sanitized provider receipt.

Gate C hosted workflows and Gate D exact RC.2 candidate remain blocked.
