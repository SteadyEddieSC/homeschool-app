import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const repositoryRoot = path.resolve(root, '..');

function assert(condition, message) {
  if (!condition) throw new Error(`Hosted browser resilience guard failed: ${message}`);
}

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
assert(pkg.scripts?.['pilot:doctor:browser'] === 'node scripts/pilot-doctor.mjs browser', 'least-privilege browser doctor is not wired exactly');
assert(pkg.scripts?.['pilot:test-browser-resilience'] === 'playwright test --config=playwright.hosted.config.ts', 'hosted Playwright script is not wired exactly');
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
assert(nodeIncludes.includes('tests'), 'queue timeout regression is outside TypeScript validation');

const repository = await readFile(path.join(root, 'src/services/supabase-learning.ts'), 'utf8');
for (const marker of [
  "const householdId = options.householdId ?? crypto.randomUUID()",
  "const learnerId = input.learnerId ?? crypto.randomUUID()",
  "const itemId = input.itemId ?? crypto.randomUUID()",
  ".upsert(record, { onConflict: 'client_operation_id' })",
  ".eq('client_operation_id', operationId)",
  'Read in a separate statement'
]) assert(repository.includes(marker), `hosted learning repository is missing ${marker}`);
assert(!repository.includes('await query.select(learnerColumns).single()'), 'learner write still combines mutation and returned-row visibility');
assert(!repository.includes('await query.select(todayColumns).single()'), 'Today write still combines mutation and returned-row visibility');
assert(repository.match(/\.from\('learners'\)[\s\S]*?\.upsert\(record, \{ onConflict: 'client_operation_id' \}\)[\s\S]*?\.from\('learners'\)[\s\S]*?\.eq\('client_operation_id', operationId\)/), 'learner write/read phases are not both present');
assert(repository.match(/\.from\('learner_today_items'\)[\s\S]*?\.upsert\(record, \{ onConflict: 'client_operation_id' \}\)[\s\S]*?\.from\('learner_today_items'\)[\s\S]*?\.eq\('client_operation_id', operationId\)/), 'Today write/read phases are not both present');

const queueSource = await readFile(path.join(root, 'src/services/sync-queue.ts'), 'utf8');
for (const marker of [
  'DEFAULT_OPERATION_TIMEOUT_MS = 20_000',
  'operationTimeoutMs?: number',
  'this.operationTimeoutMs = Math.max(100',
  'await this.executeWithDeadline(operation)',
  'Promise.race([this.executor(operation), deadline])',
  'Synchronization timed out. Retry when the connection is stable.'
]) assert(queueSource.includes(marker), `bounded queue execution is missing ${marker}`);

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
  'attempts: 2'
]) assert(timeoutTest.includes(marker), `queue timeout regression is missing ${marker}`);
assert(!timeoutTest.includes("from '../src/services/sync-queue'"), 'queue timeout regression must not import application source into the Node TypeScript project');

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
for (const marker of ["testDir: './hosted-tests'", "trace: 'off'", "screenshot: 'off'", "video: 'off'", "name: 'hosted-chromium-desktop'"]) {
  assert(config.includes(marker), `hosted Playwright config is missing ${marker}`);
}
assert(!config.includes('webServer:'), 'hosted Playwright must target the protected deployed origin, not start a local server');

const testSource = await readFile(path.join(root, 'hosted-tests/hosted-browser-resilience.spec.ts'), 'utf8');
for (const marker of [
  'context.setOffline(true)',
  'already waiting to synchronize',
  'cancel-operation-',
  "route.abort('internetdisconnected')",
  "name: 'Retry'",
  'Synthetic Local Divergence',
  'pilot-conflict-count',
  'download-pilot-diagnostics',
  'syntheticOrganizationDeleted',
  'productionCutoverApproved: false'
]) assert(testSource.includes(marker), `hosted browser test is missing ${marker}`);
assert(!testSource.includes('console.log(pilotEmail)') && !testSource.includes('console.log(pilotPassword)'), 'hosted browser test must not log protected credentials');

const validator = await readFile(path.join(root, 'scripts/validate-hosted-browser-resilience.mjs'), 'utf8');
for (const marker of ['hosted-browser-resilience-evidence-v1', 'UUID', 'email address', 'Cloudflare token', 'syntheticOrganizationDeleted', 'full-gate-c-incomplete']) {
  assert(validator.includes(marker), `hosted browser validator is missing ${marker}`);
}

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

console.log('Gate C hosted browser resilience guard passed: credential-blind browser doctor, two-phase idempotent learning writes, bounded timeout and retry coverage, exact deployed origin, offline queue ordering, visible failure/retry/cancel, duplicate prevention, explicit conflict handling, digested diagnostics, synthetic cleanup, no deployment, no Cloudflare credentials, and no schema push.');
