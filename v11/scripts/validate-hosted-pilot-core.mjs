import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const report = JSON.parse(await readFile(path.join(root, 'hosted-pilot-core-report.json'), 'utf8'));
const outputDirectory = path.join(root, 'test-results/rc2');

function assert(condition, message) {
  if (!condition) throw new Error(`Hosted pilot evidence validation failed: ${message}`);
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isSensitiveFieldName(key) {
  const normalized = key.replace(/[-_]/g, '').toLowerCase();
  return ['password', 'secret', 'token', 'credential', 'session', 'email', 'emailaddress', 'accountid', 'projectref', 'userid', 'organizationid', 'householdid', 'learnerid'].some((suffix) => normalized.endsWith(suffix));
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

  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const next = `${location}.${key}`;
    if (isSensitiveFieldName(key)) assert(child === null || typeof child === 'boolean', `${next} must contain only a boolean/null presence indicator`);
    assertSanitized(child, next);
  }
}

assertSanitized(report);
assert(report.schema === 'beaufort-learning-harbor-hosted-pilot-core-v1', 'report schema is unexpected');
assert(report.release === '11.0.0-rc.1', 'report release is unexpected');
assert(report.state === 'synthetic-core-pilot-complete-additional-gate-c-evidence-required', 'core pilot did not complete');
if (process.env.GITHUB_SHA) assert(report.commit === process.env.GITHUB_SHA, 'report commit does not match the exact workflow head');

assert(report.identity?.invalidPasswordDenied === true, 'invalid password denial was not evidenced');
assert(report.identity?.passwordSignIn === true, 'password sign-in was not evidenced');
assert(report.identity?.sessionRefresh === true, 'session refresh was not evidenced');
assert(report.identity?.signOut === true, 'sign-out was not evidenced');
assert(report.provider?.health === true && report.provider?.configuration === true, 'preview health/config was not evidenced');
assert(report.invitations?.organizationBootstrap === true, 'organization bootstrap was not evidenced');
assert(report.invitations?.systemAdministratorDenied === true, 'System Administrator invitation denial was not evidenced');
assert(report.invitations?.revocation === true && report.invitations?.revokedRedemptionDenied === true, 'invitation revocation boundary was not evidenced');
assert(report.today?.parentManagedLearner === true, 'parent-managed learner was not evidenced');
assert(report.today?.startIdempotent === true, 'Today start idempotency was not evidenced');
assert(report.today?.submitReviewIdempotent === true, 'Today submit-review idempotency was not evidenced');
assert(report.today?.returnIdempotent === true, 'Today return idempotency was not evidenced');
assert(report.today?.explicitAdultCompletion === true, 'explicit adult completion was not evidenced');
assert(report.objective?.clientRecordIdPreserved === true, 'objective client record ID preservation was not evidenced');
assert(report.objective?.retryIdempotent === true, 'objective retry idempotency was not evidenced');
assert(report.objective?.correctCount === 1 && report.objective?.percentage === 100, 'deterministic objective score was not evidenced');
assert(report.objective?.automaticCompletion === false, 'objective attempt automatically completed work');
assert(report.evidence?.returnIdempotent === true, 'proof return idempotency was not evidenced');
assert(report.evidence?.revisionHistoryCount === 2, 'proof revision history was not preserved');
assert(report.evidence?.automaticAcceptance === false, 'proof was automatically accepted');
assert(report.evidence?.explicitAdultAcceptance === true, 'explicit adult proof acceptance was not evidenced');
assert(report.planning?.sevenDayItemCount === 7, 'seven-day planning was not evidenced');
assert(report.planning?.eighthDayDenied === true, 'eighth-day rejection was not evidenced');
assert(report.cleanup?.syntheticOrganizationDeleted === true, 'synthetic organization cleanup was not evidenced');
assert(report.cleanup?.verifierSignedOut === true, 'verifier sign-out cleanup was not evidenced');

for (const key of ['syntheticDataOnly', 'realFamilyDataAuthorized', 'liveMigrationEnabled', 'productionDataEnabled', 'productionReady', 'productionCutoverApproved', 'automatedPromotionAllowed']) {
  assert(Object.hasOwn(report.boundaries ?? {}, key), `boundary ${key} is missing`);
}
assert(report.boundaries.syntheticDataOnly === true, 'pilot was not marked synthetic-only');
for (const key of ['realFamilyDataAuthorized', 'liveMigrationEnabled', 'productionDataEnabled', 'productionReady', 'productionCutoverApproved', 'automatedPromotionAllowed']) {
  assert(report.boundaries[key] === false, `boundary ${key} must remain false`);
}
assert(Array.isArray(report.remaining) && report.remaining.length >= 5, 'remaining Gate C work is not explicit');

const evidence = {
  schema: 'beaufort-learning-harbor-rc2-hosted-pilot-core-evidence-v1',
  release: report.release,
  checkedAt: new Date().toISOString(),
  commit: report.commit,
  state: 'core-synthetic-pilot-evidenced-full-gate-c-incomplete',
  reportDigest: digest(report),
  coverage: {
    identitySession: true,
    organizationBootstrap: true,
    invitationRevocationAndRoleRestriction: true,
    parentManagedLearner: true,
    todayTransitionsAndIdempotency: true,
    deterministicObjectiveScoring: true,
    explicitSubjectiveReview: true,
    sevenDayPlanningBoundary: true,
    syntheticCleanup: true
  },
  gates: {
    A: { complete: true },
    B: { complete: true },
    C: { complete: false, coreSyntheticTransactionPilot: true, remaining: report.remaining },
    D: { complete: false }
  },
  boundaries: report.boundaries
};
assertSanitized(evidence, 'evidence');
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, 'rc2-hosted-pilot-core-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
