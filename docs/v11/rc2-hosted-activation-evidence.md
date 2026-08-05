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

- identity and organization foundation;
- access hardening;
- identity bootstrap and one-time invitation controls;
- invitation cryptographic hardening;
- parent-managed learners and explicit adult-reviewed Today transitions;
- stable operation IDs and idempotent Today receipts;
- objective checks, subjective evidence review, and seven-day planning;
- hosted client-record-ID preservation and schema-status RPC;
- synthetic-only migration rehearsal and owner-blocked readiness metadata;
- hosted ACL hardening discovered during provider activation.

After activation:

- public application tables: 20;
- public tables with Row-Level Security enabled: 20;
- application rows: 0;
- anonymous executable security-definer functions: 0;
- directly executable trigger-only functions for authenticated users: 0;
- legacy knowledge-attempt RPC available to authenticated clients: false;
- current client-record-ID-preserving knowledge-attempt RPC available to authenticated clients: true.

### Hosted defect discovered and closed

The provider initially assigned direct anonymous or inherited `PUBLIC` execute access to public-schema security-definer functions despite earlier migrations revoking `PUBLIC` on selected callable functions. Internal authentication checks prevented unauthenticated business actions, but the exposed RPC surface violated least privilege and produced Supabase security warnings.

The repository-owned hosted ACL hardening migration now:

- revokes function execution from both `PUBLIC` and `anon` across the public schema;
- preserves only explicit authenticated application RPC grants;
- removes direct authenticated execution from trigger-only functions;
- disables the superseded knowledge-attempt RPC;
- fixes the mutable search path on `set_updated_at()`.

Direct post-migration ACL inspection verified the corrected state above.

## Remaining Gate B work

This evidence does not complete Gate B. Still required:

- protected GitHub environment `v11-preview`;
- protected publishable Supabase value and synthetic verifier credentials;
- isolated Cloudflare Worker `beaufort-learning-harbor-v11-preview`;
- protected manual deployment;
- authenticated remote schema-status verification;
- independent health/config verification and sanitized provider receipt.

Gate C hosted workflows and Gate D exact RC.2 candidate remain blocked.
