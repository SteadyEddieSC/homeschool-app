# Beaufort Learning Harbor v11 Architecture

## Decision

Beaufort Learning Harbor v11 will be maintained as a TypeScript web application and deployed primarily as an online group platform. The browser still receives HTML, CSS, and JavaScript, but those files are generated from typed modules and components rather than maintained as one progressively patched HTML source file.

The stable v10.43 application remains available during migration as the validated offline fallback and data-export source.

## Initial platform

```text
React + TypeScript application
        │
        ▼
Vite + Cloudflare Vite plugin
        │
        ├── Cloudflare Worker API
        ├── Cloudflare static assets
        └── Supabase browser client
                  │
                  ├── Supabase Auth
                  ├── Postgres + Row-Level Security
                  └── Storage in a later release
```

BAND is an optional communication integration. It is not the system of record and cannot receive private grades, student evidence, accommodations, support conversations, or detailed learner records.

## Authority boundaries

### Supabase Auth

Owns credentials, sessions, identity-provider connections, password recovery, and future MFA enrollment. Application tables do not store passwords.

### Application database

Owns organizations, membership, households, learners, role assignments, learning records, support tickets, audit events, and integration metadata.

### Browser application

Renders only records permitted by database policies. UI hiding is not authorization. Every shared table must have Row-Level Security enabled before real data is allowed.

### Cloudflare Worker

Owns server-side API routes, provider-token exchange, future BAND OAuth, scheduled jobs, rate limiting, backup orchestration, and operations that must not expose secrets to the browser.

## Roles

- **Student:** learner-facing work and personal support requests.
- **Parent / Guardian:** household coordination and guardian-controlled learner access.
- **Teacher / Facilitator:** assigned instructional work only; no blanket household access.
- **Director:** organization coordination and support triage.
- **Group Administrator:** membership, organization configuration, and private support administration.
- **System Administrator / Developer:** platform operations, deployment, recovery, and technical support.

A role is an organization membership. Household membership is a separate relationship. System administration does not automatically grant educational decision authority.

## Data model principles

1. A login account is not the same object as a learner profile.
2. A household is not the same object as the homeschool organization.
3. A parent-managed learner may exist without an independent login.
4. Teachers receive access through explicit future teaching assignments, not through a broad organization-wide household policy.
5. Directors and administrators are separate roles.
6. Support conversations are private application records; public GitHub escalation is manual and sanitized.
7. Audit data records privileged actions without copying credentials or sensitive content unnecessarily.

## Online and offline model

Supabase becomes authoritative for shared group records. The browser may retain local drafts and recently used content for resilience, but v11 will not pretend that independent browser copies are automatically conflict-free.

The first releases prioritize:

- reliable online use;
- explicit local draft queues;
- clear synchronization status;
- deterministic conflict handling;
- portable export and recovery;
- preservation of the v10.43 fallback.

Full multi-device offline synchronization is not part of alpha 1.

## Deployment environments

- **Local development:** synthetic data and local preview mode.
- **Cloud preview:** isolated Worker and non-production Supabase project.
- **Production:** real members and records only after security, privacy, backup, restore, and migration acceptance.

The alpha Worker name is `beaufort-learning-harbor-v11-preview`; it cannot overwrite the existing production Worker by accident.

## Release gates

Every v11 release must include, as applicable:

- strict TypeScript validation;
- database migration review;
- Row-Level Security checks;
- secret scanning;
- role and privacy tests;
- desktop, tablet, and Pixel 7 browser tests;
- keyboard and accessibility checks;
- dark-mode review;
- migration and rollback evidence;
- no real family data in public fixtures or artifacts.
