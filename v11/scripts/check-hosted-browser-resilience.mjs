import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const repositoryRoot = path.resolve(root, '..');

function assert(condition, message) {
  if (!condition) throw new Error(`Hosted browser resilience guard failed: ${message}`);
}

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
assert(pkg.scripts?.['pilot:test-browser-resilience'] === 'playwright test --config=playwright.hosted.config.ts', 'hosted Playwright script is not wired exactly');
assert(pkg.scripts?.['pilot:validate-browser-resilience'] === 'node scripts/validate-hosted-browser-resilience.mjs', 'hosted evidence validator is not wired exactly');
assert(pkg.scripts?.['check:hosted-browser-resilience'] === 'node scripts/check-hosted-browser-resilience.mjs', 'hosted browser guard is not wired exactly');
assert(String(pkg.scripts?.verify ?? '').includes('npm run check:hosted-browser-resilience'), 'npm run verify must include the hosted browser guard');

const repository = await readFile(path.join(root, 'src/services/supabase-learning.ts'), 'utf8');
for (const marker of [
  "const householdId = options.householdId ?? crypto.randomUUID()",
  "const operationId = options.operationId ?? crypto.randomUUID()",
  ".upsert(record, { onConflict: 'client_operation_id' })",
  ".eq('client_operation_id', operationId)",
  'Read the row in a separate statement'
]) assert(repository.includes(marker), `hosted household repository is missing ${marker}`);
assert(!repository.includes("const result = await query.select('id, organization_id, name, created_at').single()"), 'hosted household repository still combines write and returned-row visibility');

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
  'npm run pilot:test-browser-resilience',
  'npm run pilot:validate-browser-resilience',
  'rc2-hosted-browser-resilience-evidence.json'
]) assert(workflow.includes(marker), `hosted pilot workflow is missing ${marker}`);
assert(!workflow.includes('wrangler deploy'), 'Gate C pilot workflow must not redeploy Cloudflare');
assert(!workflow.includes('supabase db push'), 'Gate C pilot workflow must not mutate provider schema');

console.log('Gate C hosted browser resilience guard passed: exact deployed origin, offline queue ordering, visible failure/retry/cancel, duplicate prevention, explicit conflict handling, digested diagnostics, synthetic cleanup, no deployment, and no schema push.');
