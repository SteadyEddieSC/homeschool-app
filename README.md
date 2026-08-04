# Beaufort Learning Harbor

Beaufort Learning Harbor is a homeschool and co-op learning application with two deliberately separated tracks.

## Stable production fallback — v10.43

The validated v10.43 application remains the production and downloadable baseline. It is an offline-first single-file application with role boundaries, learner routes, lesson planning, controlled lesson-pack overlays, family/co-op planning, portable data contracts, privacy protections, and desktop/tablet/mobile validation.

## Typed preview — v11.0.0-beta.3

The `v11/` directory contains the TypeScript, React, Vite, Cloudflare Worker, and optional-Supabase platform. Beta 3 adds deterministic objective checks, revision-preserving subjective proof, explicit adult evidence decisions, weekly household planning, the beta.2 local queue/recovery layer, and encrypted backup compatibility.

Supabase remains optional and deferred. Beta 3 does not deploy automatically, replace v10.43, migrate family data, or contain real family records.

## Repository layout

- stable v10 source, modules, fixtures, and tests at the repository root;
- `v11/src/` for the typed identity, household learning, evidence, planning, synchronization, and recovery application;
- `v11/supabase/` for reviewed migrations and transaction-scoped policy tests;
- `v11/worker/` for the isolated preview Worker boundary;
- `docs/v11/` for architecture, recovery, learning authority, roadmap, and release documentation.

## Privacy and authority

Only synthetic data belongs in this public repository. Never commit family exports, student work, screenshots, backups, passwords, service-role keys, provider tokens, OAuth/BAND tokens, or private keys.

Objective scores are informational only. Subjective proof requires an explicit adult decision. Plans do not silently create completion, grades, mastery, attendance, XP, or portfolio approval.

## Next release

`v11.0.0-beta.4 — Hosted Pilot and Operational Recovery`, after the owner creates the non-production Supabase project.
