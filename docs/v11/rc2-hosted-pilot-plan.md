# v11.0.0-rc.2 Hosted Pilot Plan

RC.2 is an evidence-backed, non-production hosted pilot and defect-closure release. It is not a production migration, production deployment, DNS change, or production approval.

The current released candidate remains `11.0.0-rc.1` until the hosted pilot is complete and the exact final RC.2 candidate is assembled. v10.43 remains the stable production and downloadable fallback.

Tracked by GitHub issue #47.

## Verified starting point

- repository default branch: `main`;
- verified main commit at kickoff: `62cb9c2034b2891e7d6bbc14e07e6ef1d78d4da8`;
- current v11 package/runtime: `11.0.0-rc.1`;
- RC.1 issue #45: completed;
- RC.1 pull request #46: squash-merged;
- exact validated RC.1 head: `136bc055f4fe611c7277950b84422152a3823b10`;
- Validate v11 run #94: successful;
- unchanged-v10.43 Validate run #318: successful;
- validated RC.1 preview artifact ID: `8908945698`;
- validated RC.1 preview artifact SHA-256: `e67f50c973ce2e79488c917dac93f9c2e7641abde9f8cd68d0f93a9c73a9f292`.

At kickoff, no repository evidence demonstrated a linked non-production Supabase project, remotely applied migrations, a deployed v11 Cloudflare preview, production-capable SMTP, BAND/OAuth integration, a real-family pilot, real-data migration, DNS cutover, or production hostname change.

## Release gates

RC.2 uses four ordered gates. Evidence from a later gate cannot be substituted for an earlier one, and local CI cannot be represented as hosted-provider evidence.

### Gate A — Repository activation readiness

Repository-only work may proceed without provider credentials:

- keep the application consolidated in the existing TypeScript/React/Vite architecture;
- preserve migrations `001–009` as the reviewed remote baseline;
- keep migration rehearsal synthetic-only and live migration disabled;
- preserve manual-only deployment to `beaufort-learning-harbor-v11-preview`;
- preserve public/publishable browser-key enforcement and privileged-key rejection;
- preserve authenticated hosted schema verification;
- update activation, evidence, shutdown, and defect-handling documentation;
- keep package/runtime/workflow release markers at RC.1 until hosted evidence exists.

Gate A does not prove that any provider is configured or healthy.

### Gate B — Owner-created provider activation

The owner must create and own:

- one dedicated non-production Supabase project;
- one protected GitHub environment named exactly `v11-preview`;
- one isolated Cloudflare preview resource for `beaufort-learning-harbor-v11-preview`;
- one disposable synthetic adult verifier account;
- one non-production email sender suitable for confirmation, invitation, and recovery testing.

Long-lived secrets remain only in provider or protected GitHub settings. They must not be pasted into chat, committed to Git, placed in browser source, stored in reports, or uploaded as artifacts.

After the owner creates those resources, the development workflow must:

1. run the full local RC.1 validation and database rebuild;
2. link only the non-production Supabase project from a trusted owner-controlled environment;
3. review `supabase db push --dry-run` through migration `009`;
4. apply migrations `001–009` only after review;
5. run `npm run pilot:doctor`;
6. run `npm run pilot:verify-schema`;
7. manually dispatch **Deploy v11 Preview** with `DEPLOY_V11_PREVIEW`;
8. independently verify the deployed HTTPS origin and exact release/capability boundaries.

Gate B is blocked until owner-created resources exist.

### Gate C — Synthetic hosted pilot and defect closure

Use synthetic adult accounts, synthetic households, and synthetic learners first. Do not enter real family names, emails, schedules, evidence, accommodations, grades, attachments, exports, or backups.

Required hosted workflows:

1. sign-up, email confirmation, sign-in, sign-out, password recovery, password update, session expiry, and reauthentication;
2. first-organization bootstrap;
3. one-time invitation creation, redemption, expiration, revocation, and replay denial;
4. household/group separation and role boundaries;
5. parent-managed learners and supervised learner handoff;
6. Today assignment, learner start, review submission, adult complete/return, and feedback;
7. deterministic multiple-choice and true/false scoring with informational results only;
8. proof submission, return, revision, preserved history, and explicit adult acceptance;
9. seven-day plan creation and rejection of out-of-range dates;
10. offline queue ordering, retry, cancel, reconnect, idempotency, and duplicate prevention;
11. visible local/hosted conflict handling with no silent overwrite;
12. private support thread behavior and sanitized diagnostics;
13. encrypted backup, restore preview, confirmed restore, emergency rollback, hosted restore, and vendor-exit restore;
14. provider outage, account lockout, credential rotation, preview shutdown, and project deletion procedures;
15. desktop, touch-tablet, and Pixel 7 presentation;
16. quotas, egress, storage, connection limits, authentication rate limits, email limits, monitoring, and alert routing.

### Gate D — Exact-head RC.2 candidate

Only after Gate C evidence and release-blocking defect closure:

- advance package/runtime/workflows/docs to `11.0.0-rc.2`;
- update exact release checks and artifact names in one bounded change;
- run strict TypeScript and architecture/boundary validation;
- rebuild local Supabase from migrations `001–009` and run all pgTAP suites;
- run desktop, touch-tablet, and Pixel 7 Playwright suites;
- run the unchanged v10.43 validation workflow;
- rerun hosted schema and deployment evidence against the exact final RC.2 head;
- publish the validated RC.2 preview artifact and sanitized evidence package;
- record one non-production decision: `no-go`, `pilot-extension`, or `eligible-for-separate-production-decision`.

RC.2 must never declare production ready, enable live migration, enable production data, approve cutover, change production DNS, or deploy production automatically.

## Evidence register

Every completed item must point to direct evidence from the exact applicable commit or hosted environment. Sanitized evidence may contain identifiers, counts, timestamps, release markers, migration markers, status values, non-reversible digests, device classes, and bounded error codes.

Sanitized evidence must not contain:

- names or email addresses;
- learner work, schedules, notes, accommodations, grades, or attachments;
- invitation tokens or redemption URLs;
- passwords, sessions, recovery tokens, OAuth tokens, provider keys, database credentials, or private keys;
- raw database rows;
- queue payloads;
- private support-thread text;
- provider account IDs, project references, or internal hostnames beyond the approved public preview/Supabase hosts already represented in protected reports;
- screenshots containing private or provider-sensitive material.

Required evidence classes:

| ID | Evidence | Required before RC.2 candidate |
|---|---|---|
| R1 | exact main/branch/head and release-marker verification | yes |
| R2 | local TypeScript, boundary, build, database, pgTAP, and responsive browser validation | yes |
| R3 | unchanged-v10.43 validation and exact fallback artifact | yes |
| P1 | pilot doctor report from protected provider environment | yes |
| P2 | authenticated remote schema report for migrations `008` and `009` | yes |
| P3 | isolated Cloudflare deployment receipt and independent health/config check | yes |
| H1 | identity, invitation, household, learner, Today, check, proof, and planning hosted workflow results | yes |
| H2 | queue, retry, idempotency, conflict, and outage results | yes |
| H3 | backup, restore, RTO/RPO, rollback, shutdown, and vendor-exit results | yes |
| H4 | email, rate-limit, quota, monitoring, and alert results | yes |
| D1 | release-blocking defect register with exact-head closure evidence | yes |
| A1 | owner approvals/status for privacy, security, support, incident, and pilot participation | yes, status may remain blocked |
| G1 | final RC.2 non-production go/no-go package | yes |

## Defect rules

Every defect record must include:

- synthetic reproduction steps;
- expected and observed behavior;
- affected role, device class, and environment;
- severity;
- privacy/security impact;
- sanitized evidence reference;
- root cause when known;
- fix commit;
- exact-head validation result;
- closure or explicit owner acceptance.

Severity:

- **Blocker** — private-data exposure, authorization bypass, secret exposure, destructive loss, silent conflict overwrite, automatic educational outcome, production-target collision, or inability to restore/shut down safely. RC.2 cannot proceed.
- **High** — core hosted workflow failure, duplicate records after retry, broken recovery, broken cross-household denial, inaccessible critical workflow, or unreliable mobile operation. Must be fixed before RC.2.
- **Medium** — bounded workflow degradation with a safe workaround and no privacy/data-integrity impact. Fix or explicitly accept before RC.2.
- **Low** — cosmetic or minor usability defect that does not affect authority, privacy, integrity, accessibility, or task completion. May be deferred with a recorded rationale.

## Stop conditions

Stop the pilot immediately and preserve sanitized evidence when any of the following occurs:

- a service-role/secret key reaches browser code, logs, reports, or artifacts;
- cross-household or cross-organization access succeeds unexpectedly;
- Director or System Administrator receives household learner access without an explicit relationship;
- ordinary invitation creates System Administrator access;
- navigation or opening content creates completion, grades, mastery, attendance, XP, or portfolio approval;
- subjective proof is accepted without an explicit authorized adult decision;
- retry creates duplicate hosted records;
- a conflict is silently overwritten;
- backup, rollback, shutdown, or credential rotation cannot be completed safely;
- the deployment target or hostname can collide with v10 production;
- real family data is entered before the separately approved pilot prerequisites are complete.

## Owner approvals and later real-family pilot

A real-family pilot is not included automatically. Before inviting any real family, require owner-reviewed and recorded status for:

- privacy policy and terms;
- parental notice and consent;
- data minimization and retention;
- export and deletion procedures;
- attachment restrictions and scanning;
- incident response and breach notification;
- support ownership and escalation;
- vendor inventory and data-flow review;
- backup, restore, and vendor exit;
- participant scope and consent;
- explicit owner approval.

Even after RC.2, production migration and cutover remain a separate release and decision.
