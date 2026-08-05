# RC.2 Evidence Validation

RC.2 uses executable evidence gates so repository readiness, provider activation, hosted-pilot completion, and release promotion cannot be conflated.

The current application remains `11.0.0-rc.1`. These commands prepare and validate evidence for the future `11.0.0-rc.2` candidate; they do not authorize a version bump, production use, real-family migration, or cutover.

## Repository evidence mode

```bash
cd v11
npm run rc2:evidence:repository
```

This mode is included in `npm run verify`. It checks that:

- the package, runtime, Worker, and protected workflow remain on `11.0.0-rc.1`;
- migration `009` is the latest reviewed migration;
- the Worker target remains `beaufort-learning-harbor-v11-preview` and cannot collide with the v10 production Worker;
- deployment remains manual;
- the protected workflow is wired to validate provider evidence;
- the RC.2 plan contains Gates A–D and explicit stop conditions;
- the hosted runbook covers migrations `001–009` and the gated RC.2 target.

It writes:

```text
test-results/rc2/rc2-repository-evidence.json
```

The report deliberately states:

- repository structure is ready for exact-head validation;
- provider activation has not been observed;
- hosted-pilot evidence does not exist;
- the exact RC.2 candidate is blocked;
- production readiness, live migration, production data, automated promotion, and cutover remain false.

A successful repository report is not hosted-provider evidence.

## Provider evidence mode

```bash
npm run rc2:evidence:provider
```

Do not run this mode manually with copied reports. The protected **Deploy v11 Preview** workflow runs it after all of the following succeed:

1. pilot doctor validation;
2. deployment-boundary validation;
3. authenticated verification of migrations `008` and `009`;
4. deployment to the isolated v11 preview Worker;
5. exact `/api/health` validation;
6. authority, resilience, migration, readiness, and hosted-pilot `/api/config` validation;
7. sanitized deployment-receipt creation.

Provider mode reads:

```text
pilot-doctor-report.json
remote-schema-report.json
deployment-health.json
deployment-config.json
deployment-receipt.json
```

It verifies exact release, migration, Worker, host, workflow-run, no-production, no-cutover, authority, idempotency, conflict, and owner-approval boundaries. It also rejects evidence containing email addresses, Supabase secret keys, service-role markers, token-like values, JWT-like values, private keys, or sensitive fields containing anything other than a boolean/null presence indicator.

It writes:

```text
test-results/rc2/rc2-provider-evidence.json
```

A successful provider report may complete Gate B only. It must leave Gate C and Gate D incomplete because synthetic hosted workflows, recovery exercises, provider operations evidence, defect closure, and the exact RC.2 candidate still do not exist.

## Defect intake

Use the GitHub issue form:

```text
.github/ISSUE_TEMPLATE/v11-rc2-hosted-pilot-defect.yml
```

The form requires:

- RC.2 gate and severity;
- synthetic role and device class;
- exact Git commit;
- synthetic reproduction steps;
- expected and observed behavior;
- privacy, authority, or data-integrity impact;
- sanitized evidence references;
- fix and exact-head closure evidence when available;
- confirmations that synthetic data was used and stop conditions were followed.

Never place names, email addresses, learner work, schedules, accommodations, invitation material, private support content, raw database rows, queue payloads, provider identifiers, sessions, credentials, or private screenshots in a public issue.

## Evidence progression

The intended progression is:

1. `rc2-repository-evidence.json` proves repository structure only.
2. Exact-head GitHub Actions evidence proves current local/database/browser validation.
3. `rc2-provider-evidence.json` proves isolated non-production provider activation only.
4. Hosted-pilot findings and recovery/operations receipts prove Gate C.
5. Closed or explicitly accepted defect records prove release-blocking defect disposition.
6. Only then may one bounded change advance all exact markers to `11.0.0-rc.2` and rerun every local, hosted, artifact, and unchanged-v10.43 gate.

The final RC.2 decision remains non-production: `no-go`, `pilot-extension`, or `eligible-for-separate-production-decision`.
