import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const report = JSON.parse(await readFile(path.join(root, 'hosted-browser-resilience-report.json'), 'utf8'));
const outputDirectory = path.join(root, 'test-results/rc2');

function assert(condition, message) {
  if (!condition) throw new Error(`Hosted browser resilience evidence validation failed: ${message}`);
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assertSanitized(value, location = 'report') {
  const text = JSON.stringify(value);
  for (const [pattern, label] of [
    [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, 'email address'],
    [/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i, 'UUID'],
    [/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/i, 'Supabase key'],
    [/\b(?:cfat|cfut)_[A-Za-z0-9_-]+/i, 'Cloudflare token'],
    [/\bservice_role\b/i, 'service-role marker'],
    [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, 'JWT-like value'],
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key']
  ]) assert(!pattern.test(text), `${location} contains a forbidden ${label}`);
}

assertSanitized(report);
assert(report.schema === 'beaufort-learning-harbor-hosted-browser-resilience-v1', 'report schema is unexpected');
assert(report.release === '11.0.0-rc.1', 'report release is unexpected');
assert(report.state === 'hosted-browser-resilience-complete-additional-gate-c-evidence-required', 'hosted browser resilience pilot did not complete');
if (process.env.GITHUB_SHA) assert(report.commit === process.env.GITHUB_SHA, 'report commit does not match the exact workflow head');
if (process.env.GITHUB_RUN_ID) assert(String(report.workflowRun) === String(process.env.GITHUB_RUN_ID), 'report workflow run does not match the current run');

for (const [key, value] of Object.entries(report.coverage ?? {})) assert(value === true, `coverage ${key} was not evidenced`);
assert(report.counts?.activeOperations === 4, 'four ordered active operations were not evidenced');
assert(report.counts?.cancelledOperations === 1, 'one explicit cancellation was not evidenced');
assert(report.counts?.hostedHouseholds === 1, 'hosted household count is unexpected');
assert(report.counts?.hostedLearners === 1, 'hosted learner count is unexpected');
assert(report.counts?.hostedTodayItems === 1, 'cancelled Today item reached the hosted database or the expected item is missing');
assert(report.counts?.hostedKnowledgeChecks === 1, 'hosted knowledge-check count is unexpected');
assert(report.counts?.openConflictsBeforeAcknowledgement === 1, 'visible conflict was not evidenced');
assert(report.attempts?.firstOperation === 2, 'the failed first operation was not explicitly retried once');
assert(Array.isArray(report.attempts?.subsequentOperations) && report.attempts.subsequentOperations.length === 3, 'subsequent ordered attempts are incomplete');
assert(report.attempts.subsequentOperations.every((attempt) => attempt === 1), 'a subsequent operation was duplicated or retried unexpectedly');
assert(/^[0-9a-f]{64}$/.test(String(report.diagnosticsDigest ?? '')), 'sanitized diagnostics digest is missing');
assert(report.cleanup?.syntheticOrganizationDeleted === true, 'synthetic organization cleanup was not evidenced');
assert(report.cleanup?.browserSignedOut === true, 'browser sign-out was not evidenced');
assert(report.cleanup?.observerSignedOut === true, 'observer sign-out was not evidenced');
assert(report.boundaries?.syntheticDataOnly === true, 'pilot is not marked synthetic-only');
for (const key of ['realFamilyDataAuthorized', 'liveMigrationEnabled', 'productionDataEnabled', 'productionReady', 'productionCutoverApproved', 'automatedPromotionAllowed']) {
  assert(report.boundaries?.[key] === false, `boundary ${key} must remain false`);
}

const evidence = {
  schema: 'beaufort-learning-harbor-rc2-hosted-browser-resilience-evidence-v1',
  release: report.release,
  checkedAt: new Date().toISOString(),
  commit: report.commit,
  workflowRun: report.workflowRun,
  state: 'hosted-browser-resilience-evidenced-full-gate-c-incomplete',
  reportDigest: digest(report),
  diagnosticsDigest: report.diagnosticsDigest,
  coverage: report.coverage,
  counts: report.counts,
  attempts: report.attempts,
  cleanup: report.cleanup,
  gates: {
    A: { complete: true },
    B: { complete: true },
    C: {
      complete: false,
      coreSyntheticTransactionPilot: true,
      hostedBrowserResilience: true,
      remaining: [
        'multi-account invitation redemption and cross-role authorization',
        'email confirmation, recovery delivery, and abuse controls',
        'hosted backup, restore, vendor-exit, monitoring, alerting, rotation, and shutdown rehearsal'
      ]
    },
    D: { complete: false }
  },
  boundaries: report.boundaries
};
assertSanitized(evidence, 'evidence');
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, 'rc2-hosted-browser-resilience-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ schema: evidence.schema, state: evidence.state, coverage: evidence.coverage, cleanup: evidence.cleanup }, null, 2));
