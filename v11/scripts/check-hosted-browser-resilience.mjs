import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const repositoryRoot = path.resolve(root, '..');

function assert(condition, message) {
  if (!condition) throw new Error(`Hosted browser resilience guard failed: ${message}`);
}

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
assert(pkg.scripts?.['pilot:doctor:browser'] === 'node scripts/pilot-doctor.mjs browser', 'least-privilege browser doctor is not wired exactly');
assert(pkg.scripts?.['pilot:test-browser-resilience'] === 'playwright test hosted-tests/hosted-browser-resilience.spec.ts --config=playwright.hosted.config.ts', 'hosted Playwright script is not wired exactly');
assert(pkg.scripts?.['pilot:validate-browser-resilience'] === 'node scripts/validate-hosted-browser-resilience.mjs', 'hosted evidence validator is not wired exactly');
assert(pkg.scripts?.['check:hosted-browser-resilience'] === 'node scripts/check-hosted-browser-resilience.mjs', 'hosted browser guard is not wired exactly');
assert(String(pkg.scripts?.verify ?? '').includes('npm run check:hosted-browser-resilience'), 'npm run verify must include the hosted browser guard');

const doctor = await readFile(path.join(root, 'scripts/pilot-doctor.mjs'), 'utf8');
for (const marker of [
  "const scope = process.argv[2] ?? 'deployment'",
  'deployment:',
  'browser:',
  "scope === 'deployment'",
  'Unsupported hosted-pilot doctor scope'
]) assert(doctor.includes(marker), `pilot doctor is missing ${marker}`);
assert(!doctor.includes('PILOT_TEST_EMAIL') && !doctor.includes('PILOT_TEST_PASSWORD'), 'pilot doctor must remain blind to protected synthetic credentials');

const nodeTypeScript = JSON.parse(await readFile(path.join(root, 'tsconfig.node.json'), 'utf8'));
const nodeIncludes = Array.isArray(nodeTypeScript.include) ? nodeTypeScript.include : [];
assert(nodeIncludes.includes('playwright.hosted.config.ts'), 'hosted Playwright configuration is outside TypeScript validation');
assert(nodeIncludes.includes('hosted-tests'), 'hosted browser tests are outside TypeScript validation');
assert(nodeIncludes.includes('tests'), 'queue and idempotency regressions are outside TypeScript validation');

const repository = await readFile(path.join(root, 'src/services/supabase-learning.ts'), 'utf8');
for (const marker of [
  "const householdId = options.householdId ?? crypto.randomUUID()",
  "const learnerId = input.learnerId ?? crypto.randomUUID()",
  "const itemId = input.itemId ?? crypto.randomUUID()",
  'existingHousehold',
  'existingLearner',
  'existingTodayItem',
  '.maybeSingle()',
  'isUniqueViolation',
  "String((error as { code?: unknown }).code ?? '') === '23505'",
  ".from('households').insert(record)",
  ".from('learners').insert(record)",
  ".from('learner_today_items').insert(record)",
  ".eq('client_operation_id', operationId)",
  'Read in a separate statement'
]) assert(repository.includes(marker), `hosted learning repository is missing ${marker}`);
assert(!repository.includes('.upsert('), 'hosted learning create recovery must not request PostgREST upsert/conflict-resolution authority');
assert(!repository.includes('await query.select(learnerColumns).single()'), 'learner write still combines mutation and returned-row visibility');
assert(!repository.includes('await query.select(todayColumns).single()'), 'Today write still combines mutation and returned-row visibility');
assert(repository.match(/const existingHousehold[\s\S]*?\.maybeSingle\(\)[\s\S]*?if \(existingHousehold\.data\)[\s\S]*?\.from\('households'\)\.insert\(record\)[\s\S]*?isUniqueViolation\(write\.error\)[\s\S]*?\.from\('households'\)[\s\S]*?\.single\(\)/), 'household ambiguous-write read/insert/23505/read sequence is missing');
assert(repository.match(/const existingLearner[\s\S]*?\.maybeSingle\(\)[\s\S]*?if \(existingLearner\.data\)[\s\S]*?\.from\('learners'\)\.insert\(record\)[\s\S]*?isUniqueViolation\(write\.error\)[\s\S]*?\.from\('learners'\)[\s\S]*?\.single\(\)/), 'learner ambiguous-write read/insert/23505/read sequence is missing');
assert(repository.match(/const existingTodayItem[\s\S]*?\.maybeSingle\(\)[\s\S]*?if \(existingTodayItem\.data\)[\s\S]*?\.from\('learner_today_items'\)\.insert\(record\)[\s\S]*?isUniqueViolation\(write\.error\)[\s\S]*?\.from\('learner_today_items'\)[\s\S]*?\.single\(\)/), 'Today ambiguous-write read/insert/23505/read sequence is missing');

const queueSource = await readFile(path.join(root, 'src/services/sync-queue.ts'), 'utf8');
for (const marker of [
  'DEFAULT_OPERATION_TIMEOUT_MS = 20_000',
  'operationTimeoutMs?: number',
  'this.operationTimeoutMs = Math.max(100',
  'await this.executeWithDeadline(operation)',
  'Promise.race([this.executor(operation), deadline])',
  'safeProviderCode',
  'Synchronization timed out. Retry when the connection is stable.',
  'Synchronization failed because the network connection was interrupted.',
  'Hosted synchronization was not authorized.',
  'Hosted provider rejected synchronization',
  'Synchronization failed. Retry or contact support.'
]) assert(queueSource.includes(marker), `bounded or sanitized queue execution is missing ${marker}`);
assert(!queueSource.includes('structured.details'), 'queue sanitizer must not retain structured provider details');

const timeoutTest = await readFile(path.join(root, 'tests/sync-queue-timeout.spec.ts'), 'utf8');
for (const marker of [
  "const moduleUrl = '/src/services/sync-queue.ts'",
  'operationTimeoutMs: 100',
  'await new Promise<void>(() => undefined)',
  "status: 'failed'",
  'Synchronization timed out. Retry when the connection is stable.',
  "manager.retry('synthetic-operation-one')",
  'snapshot.completedCount === 2',
  'snapshot.processing === false',
  'attempts: 2',
  "code: '42501'",
  'Hosted synchronization was not authorized. Confirm access and retry.',
  "not.toContain('raw row-level provider detail')",
  "not.toContain('private table and policy information')"
]) assert(timeoutTest.includes(marker), `queue timeout or sanitizer regression is missing ${marker}`);
assert(!timeoutTest.includes("from '../src/services/sync-queue'"), 'queue timeout regression must not import application source into the Node TypeScript project');

const idempotencyTest = await readFile(path.join(root, 'tests/supabase-learning-idempotency.spec.ts'), 'utf8');
for (const marker of [
  "const moduleUrl = '/src/services/supabase-learning.ts'",
  'ambiguous hosted create responses',
  'ordinary insert authority',
  "code: '23505'",
  'operation-household',
  'operation-learner',
  'operation-today',
  'Unexpected upsert',
  'expect(result.writes).toEqual([])',
  "expect(result.writes).toEqual(['households', 'learners', 'learner_today_items'])"
]) assert(idempotencyTest.includes(marker), `insert-only hosted create regression is missing ${marker}`);

const diagnostics = await readFile(path.join(root, 'src/components/HostedPilotWorkspace.tsx'), 'utf8');
for (const marker of [
  'hosted-pilot-diagnostics-v2',
  'operationDigest: diagnosticDigest(operation.id)',
  'conflictDigest: diagnosticDigest(conflict.id)',
  'recordDigest: diagnosticDigest(conflict.recordId)',
  'raw operation, conflict, and record identifiers'
]) assert(diagnostics.includes(marker), `sanitized diagnostics are missing ${marker}`);
assert(!diagnostics.includes('id: operation.id'), 'diagnostics still include raw operation IDs');
assert(!diagnostics.includes('recordId: conflict.recordId'), 'diagnostics still include raw record IDs');

const config = await readFile(path.join(root, 'playwright.hosted.config.ts'), 'utf8');
for (const marker of ["testDir: './hosted-tests'", 'timeout: 300_000', "trace: 'off'", "screenshot: 'off'", "video: 'off'", "name: 'hosted-chromium-desktop'"]) {
  assert(config.includes(marker), `hosted Playwright config is missing ${marker}`);
}
assert(!config.includes('webServer:'), 'hosted Playwright must target the protected deployed origin, not start a local server');

const testSource = await readFile(path.join(root, 'hosted-tests/hosted-browser-resilience.spec.ts'), 'utf8');
for (const marker of [
  'context.setOffline(true)',
  'already waiting to synchronize',
  'cancel-operation-',
  "route.abort('internetdisconnected')",
  'maxAdditionalRecoveries = 3',
  'maxAttemptsPerOperation = 3',
  'retrySettleDelayMs = 1_000',
  'waitForQueuePause',
  'drainQueueWithExplicitRetries',
  'Hosted queue operation reached the bounded per-operation attempt limit.',
  'hostedHouseholdsAfterForcedFailure',
  'boundedFailureRecovery',
  'recoveredFailures',
  'stopSnapshot',
  "name: 'Retry'",
  'Synthetic Local Divergence',
  'pilot-conflict-count',
  'download-pilot-diagnostics',
  'syntheticOrganizationDeleted',
  'productionCutoverApproved: false'
]) assert(testSource.includes(marker), `hosted browser test is missing ${marker}`);
assert(!testSource.includes("toHaveText('0', { timeout: 30_000 })"), 'hosted browser test still uses the brittle fixed queue-drain assertion');
assert(!testSource.includes('console.log(pilotEmail)') && !testSource.includes('console.log(pilotPassword)'), 'hosted browser test must not log protected credentials');

const validator = await readFile(path.join(root, 'scripts/validate-hosted-browser-resilience.mjs'), 'utf8');
for (const marker of [
  'hosted-browser-resilience-evidence-v2',
  'hostedHouseholdsAfterForcedFailure',
  'ambiguous household commit count is missing or unsafe',
  'recoveredFailures',
  'maxAttempts <= 3',
  'stopSnapshot === null',
  'UUID',
  'email address',
  'Cloudflare token',
  'syntheticOrganizationDeleted',
  'full-gate-c-incomplete'
]) assert(validator.includes(marker), `hosted browser validator is missing ${marker}`);

const workflow = await readFile(path.join(repositoryRoot, '.github/workflows/run-v11-hosted-pilot.yml'), 'utf8');
for (const marker of [
  'hosted-browser-resilience:',
  'needs: core-synthetic-pilot',
  'npx playwright install --with-deps chromium',
  'npm run pilot:doctor:browser',
  'npm run pilot:test-browser-resilience',
  'npm run pilot:validate-browser-resilience',
  'rc2-hosted-browser-resilience-evidence.json',
  "github.ref != 'refs/heads/main'"
]) assert(workflow.includes(marker), `hosted pilot workflow is missing ${marker}`);

const browserJob = workflow.split('  hosted-browser-resilience:')[1] ?? '';
assert(browserJob.length > 0, 'hosted browser workflow job is missing');
assert(!browserJob.includes('CLOUDFLARE_ACCOUNT_ID'), 'hosted browser job must not receive the Cloudflare account ID');
assert(!browserJob.includes('CLOUDFLARE_API_TOKEN'), 'hosted browser job must not receive the Cloudflare API token');
assert(!workflow.includes('wrangler deploy'), 'Gate C pilot workflow must not redeploy Cloudflare');
assert(!workflow.includes('supabase db push'), 'Gate C pilot workflow must not mutate provider schema');

console.log('Gate C hosted browser resilience guard passed: credential-blind browser doctor, insert-only ambiguous-write read/insert/23505/read recovery, sanitized structured provider errors, bounded product deadlines, strict per-operation retry limits, sanitized stop evidence, exact deployed origin, offline queue ordering, visible failure/retry/cancel, duplicate prevention, explicit conflict handling, digested diagnostics, synthetic cleanup, no deployment, no Cloudflare credentials, and no schema push.');
