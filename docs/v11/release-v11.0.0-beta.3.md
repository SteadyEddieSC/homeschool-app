# Beaufort Learning Harbor v11.0.0-beta.3

## Evidence, Knowledge Checks, and Family Planning

Beta 3 extends the resilient household workflow without requiring a hosted Supabase project. It adds deterministic objective checks, revision-preserving subjective proof, explicit adult evidence decisions, and bounded weekly planning to the typed v11 application.

## Added

- Multiple-choice and true/false knowledge checks attached to Quiz / Test Today items.
- Deterministic per-question tool scoring from explicit answer keys.
- Informational score summaries that do not create grades, mastery, attendance, XP, or portfolio approval.
- Subjective proof submissions using text or an HTTP/HTTPS evidence link.
- Preserved proof revisions with previous-submission references and adult feedback.
- Explicit adult **Accept proof** and **Return for revision** decisions.
- Accepted proof completes the reviewed Today item as part of the same explicit adult action.
- Returned proof returns the Today item and permits a new preserved revision.
- Weekly household plans with seven-day date boundaries and learner-specific items.
- Learner handoff views for checks, evidence, feedback, and weekly plans.
- Queue operation kinds and stable receipts for beta.3 records in cloud simulation.
- Local backup coverage for checks, attempts, evidence, plans, and plan items.
- Controlled import of valid beta.2 encrypted backups with an empty beta.3 studio store added during preview.
- Database migration 007 with Row-Level Security, constrained scoring/review functions, idempotent receipts, and audit events.

## Authority boundaries

- Only questions with an explicit answer key are tool-scored.
- A tool score is informational and never becomes a grade or mastery decision automatically.
- Subjective proof is never tool-approved.
- Proof completion requires the adult to press **Accept proof**.
- Returning proof requires feedback and preserves the returned submission.
- Generic Today review cannot bypass the evidence-review workflow for Proof items.
- Weekly plans do not mark work started, submitted, completed, graded, or approved.
- Hosted beta.3 writes are intentionally deferred to beta.4; local preview and no-transmission cloud simulation remain available.

## Backup compatibility

Beta 3 creates encrypted `11.0.0-beta.3` backups and can inspect and restore valid beta.2 encrypted local-preview backups. A beta.2 restore receives an empty studio store because beta.2 did not contain knowledge checks, evidence, or weekly plans. Integrity verification, decryption, record-count validation, preview, confirmation, and emergency pre-restore snapshot requirements remain in force.

## Preserved boundaries

- v10.43 remains the stable production and downloadable fallback.
- No hosted Supabase project is created or configured.
- No Cloudflare deployment occurs automatically.
- No v10.43 data is migrated.
- No real family or learner data belongs in Git or validation artifacts.
- BAND remains deferred.

## Recommended next action

Continue using beta.3 locally. When convenient, create the non-production Supabase project and conduct a bounded synthetic hosted pilot after reviewing migrations `001–007` with a dry run.

## Next recommended release

`v11.0.0-beta.4 — Hosted Pilot and Operational Recovery`
