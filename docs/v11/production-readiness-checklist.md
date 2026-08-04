# v11 Production Readiness Checklist

RC.1 deliberately cannot mark the application production-ready. This checklist separates automated repository evidence from provider-dependent verification and owner approvals. Every required item must be evidenced and accepted in a later release before cutover.

## A. Repository and release evidence

- [ ] live `main` version and merge commit verified;
- [ ] focused release issue and pull request closed through an approved merge;
- [ ] exact dependency and TypeScript checks pass;
- [ ] architecture, privacy, secret, authority, migration, backup, and deployment boundary checks pass;
- [ ] migrations rebuild from zero locally;
- [ ] all pgTAP authorization, RLS, idempotency, audit, migration, and cutover-denial tests pass;
- [ ] desktop, touch-tablet, and Pixel 7 Playwright suites pass on the exact final head;
- [ ] unchanged v10.43 foundation, responsive browser, integrity, privacy, and single-file artifact workflow passes;
- [ ] validated v11 artifact belongs to the exact final head;
- [ ] v10.43 stable pointer remains unchanged;
- [ ] no unresolved release-blocking review threads or defects.

## B. Migration and data integrity

- [ ] strict synthetic v10.43 parser rejects malformed, unknown, oversized, secret-bearing, and non-synthetic inputs;
- [ ] deterministic dry-run produces zero writes;
- [ ] create, match, adult-review-required, conflict, unsupported, and rejected states are explicit;
- [ ] legacy completion and accepted proof require adult re-review;
- [ ] objective tool scores remain informational;
- [ ] repeat apply is idempotent;
- [ ] conflicts are never silently overwritten;
- [ ] rollback restores the exact pre-apply checksum;
- [ ] encrypted vendor-exit export restores with matching checksum and zero record loss;
- [ ] a separate, reviewed real-data migration plan exists before any real migration;
- [ ] real-data backup and rollback checkpoints exist before any apply;
- [ ] data owners approve record mappings, exclusions, and retention.

## C. Identity and authorization

- [ ] sign-up, email confirmation, sign-in, sign-out, recovery, reauthentication, and session expiry verified in non-production;
- [ ] parent-managed learner flow verified without requiring learner email;
- [ ] household and group memberships remain separate;
- [ ] Student, Parent/Guardian, Teacher/Facilitator, Director, Group Administrator, and System Administrator permissions tested;
- [ ] Director and System Administrator do not automatically receive household learner access;
- [ ] System Administrator cannot be created through ordinary invitation;
- [ ] privileged actions require appropriate role and recent authentication;
- [ ] cross-organization and cross-household access attempts fail;
- [ ] service-role or secret keys are absent from browser code and client logs;
- [ ] audit records exist for sensitive administrative and learning decisions.

## D. Learning authority and workflow

- [ ] Today → Learn → Practice → Quiz/Test or Proof → Feedback flow is coherent on all target devices;
- [ ] navigation and page loading never create educational outcomes;
- [ ] objective quizzes/tests are deterministic and informational;
- [ ] subjective proof remains explicit adult accept/return;
- [ ] completion requires the correct adult authority boundary;
- [ ] no automatic grades, mastery, attendance, XP, or portfolio approval;
- [ ] returned proof preserves revision history;
- [ ] seven-day plans reject out-of-range dates;
- [ ] offline actions remain visible, retryable, cancelable when safe, and ordered;
- [ ] reconnect creates no duplicate hosted records;
- [ ] divergent local/hosted records surface as conflicts.

## E. Privacy, child data, and legal approval

- [ ] owner-reviewed privacy policy and terms exist;
- [ ] parental notice and consent process exists;
- [ ] data minimization and purpose limitation are documented;
- [ ] retention periods are documented and implemented;
- [ ] user/family export and deletion procedures are tested;
- [ ] attachment types, sizes, scanning, and redaction rules are defined;
- [ ] no ads or behavioral tracking;
- [ ] vendor inventory and data-flow diagram are approved;
- [ ] COPPA-conscious and FERPA-like practices reviewed by qualified counsel or responsible owner;
- [ ] incident response, breach notification, and support escalation owners are assigned;
- [ ] support tickets and diagnostics cannot expose private learner information publicly.

## F. Supabase non-production verification

- [ ] owner-created dedicated non-production project exists;
- [ ] correct region and data-residency choice recorded;
- [ ] migrations `001–009` applied through a reviewed dry run;
- [ ] authenticated `hosted_pilot_schema_status` and `release_candidate_readiness_status` RPCs pass;
- [ ] RLS and RPC authorization retested against the hosted project;
- [ ] database backups and retention verified;
- [ ] hosted restore rehearsal completed;
- [ ] quotas, egress, storage, connections, and expected cost reviewed;
- [ ] logs contain no secrets or learner content beyond approved operational needs;
- [ ] project shutdown and credential rotation procedures tested.

## G. Cloudflare preview verification

- [ ] owner-created isolated preview Worker/Pages resource exists;
- [ ] protected `v11-preview` GitHub environment requires approval;
- [ ] deployment remains manual and confirmation-gated;
- [ ] Worker name cannot collide with v10 production;
- [ ] preview origin uses HTTPS and is separate from Supabase;
- [ ] health and config endpoints report the exact release and production-disabled state;
- [ ] CSP, frame denial, referrer policy, content-type protection, and permissions policy verified;
- [ ] caching behavior does not expose private data;
- [ ] rollback to the previous preview deployment tested;
- [ ] public preview URL is independently checked before reporting it healthy.

## H. Email, abuse protection, monitoring, and support

- [ ] custom production-capable SMTP provider configured in non-production first;
- [ ] confirmation, invitation, and password-recovery delivery tested;
- [ ] SPF, DKIM, DMARC, sender identity, bounce, and complaint handling reviewed;
- [ ] authentication and invitation rate limits verified;
- [ ] abuse, enumeration, brute-force, and replay protections tested;
- [ ] monitoring and alert routing configured;
- [ ] operational dashboards exclude learner work and secrets;
- [ ] support ticket response and private-thread behavior tested;
- [ ] on-call/incident owner and support owner documented;
- [ ] shutdown communication path exists.

## I. Backup, restore, resilience, and vendor exit

- [ ] application backup is encrypted before external storage;
- [ ] recovery key is separated from database and deployment credentials;
- [ ] restore preview shows counts, conflicts, missing files, and required migrations;
- [ ] production-like backup/restore rehearsal completed in non-production;
- [ ] RTO and RPO targets are defined and measured;
- [ ] offline queue behavior tested through browser/device restart and network loss;
- [ ] failed operations remain visible and actionable;
- [ ] vendor-exit export is documented and successfully restored into an empty environment;
- [ ] provider outage, account lockout, credential rotation, and project deletion scenarios reviewed;
- [ ] v10.43 fallback and v11 shutdown procedures remain usable.

## J. Accessibility, responsive design, and quality

- [ ] keyboard navigation and visible focus reviewed;
- [ ] labels, roles, headings, errors, and status announcements reviewed;
- [ ] contrast and dark/light presentation reviewed where supported;
- [ ] reduced-motion preference honored;
- [ ] desktop, touch-tablet, Pixel 7, and living-room readability reviewed as applicable;
- [ ] no material horizontal overflow;
- [ ] loading, empty, offline, error, conflict, and recovery states are understandable;
- [ ] destructive actions require clear confirmation;
- [ ] pilot feedback and release-blocking defects closed or explicitly accepted.

## K. Owner decision and cutover

- [ ] bounded hosted pilot completed with approved participants and synthetic-first validation;
- [ ] pilot findings, residual risks, costs, and support burden reviewed;
- [ ] privacy/legal approval recorded;
- [ ] security and authorization approval recorded;
- [ ] backup/restore and vendor-exit evidence accepted;
- [ ] incident, support, rollback, and communication owners accepted their roles;
- [ ] production project, domain, DNS, email, and monitoring plan approved;
- [ ] real-data migration plan separately approved;
- [ ] explicit written owner decision records **go**, **no-go**, or **pilot extension**;
- [ ] cutover occurs in a separate production release—not automatically from rc.1 or rc.2;
- [ ] v10.43 rollback remains available until post-cutover acceptance is complete.

Until every applicable required item is complete and the owner records an explicit production decision, the correct state is **not ready for production**.
