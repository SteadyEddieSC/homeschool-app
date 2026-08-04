# Beaufort Learning Harbor

Beaufort Learning Harbor is a homeschool and co-op learning application with two deliberately separated tracks.

## Stable production fallback — v10.43

The validated v10.43 application remains the production and downloadable baseline. It is an offline-first single-file application with role boundaries, learner routes, lesson planning, controlled lesson-pack overlays, family/co-op planning, portable data contracts, privacy protections, and desktop/tablet/mobile validation.

## Typed preview — v11.0.0-beta.4

The `v11/` directory contains the TypeScript, React, Vite, Cloudflare Worker, and optional-Supabase platform. Beta 4 adds hosted repositories for Today, checks, proof revisions, adult reviews, and weekly plans; stable queued operations; client-record-ID preservation; conflict-aware local/hosted reconciliation; protected schema verification; and sanitized operational diagnostics.

The release remains fully usable in local preview without a hosted project. Provider activation and deployment are owner-controlled, manual, and limited to a non-production pilot. Beta 4 does not replace v10.43, migrate v10.43 data, deploy automatically, or contain real family records.

## Repository layout

- stable v10 source, modules, fixtures, and tests at the repository root;
- `v11/src/` for typed identity, household learning, evidence, planning, synchronization, reconciliation, and recovery;
- `v11/supabase/` for reviewed migrations and transaction-scoped policy tests;
- `v11/worker/` for the isolated preview Worker boundary;
- `docs/v11/` for architecture, activation, recovery, learning authority, roadmap, and release documentation.

## Privacy and authority

Only synthetic data belongs in this public repository. Never commit family exports, student work, screenshots, backups, passwords, service-role keys, provider tokens, OAuth/BAND tokens, or private keys.

Objective scores are informational only. Subjective proof requires an explicit adult decision. Plans do not silently create completion, grades, mastery, attendance, XP, or portfolio approval. Divergent hosted records are surfaced as conflicts instead of silently overwriting the local mirror.

## Next release

`v11.0.0-rc.1 — Migration Rehearsal and Production Readiness`.
