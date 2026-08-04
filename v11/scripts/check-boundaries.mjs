import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const repositoryRoot = path.resolve(root, '..');
const ignoredDirectories = new Set(['node_modules', 'dist', '.wrangler', 'playwright-report', 'test-results']);
const textExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.jsonc', '.md', '.sql', '.css', '.html', '.example', '.toml', '.yml', '.yaml']);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolute));
    else if (textExtensions.has(path.extname(entry.name)) || entry.name === '.env.example') files.push(absolute);
  }
  return files;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
assert(packageJson.version === '11.0.0-beta.3', 'package release must be 11.0.0-beta.3');
assert(packageJson.devDependencies?.supabase === '2.110.0', 'Supabase CLI must be pinned exactly');
for (const [groupName, dependencies] of Object.entries({ dependencies: packageJson.dependencies, devDependencies: packageJson.devDependencies })) {
  for (const [name, version] of Object.entries(dependencies ?? {})) {
    assert(typeof version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version), `${groupName}.${name} must use an exact pinned version`);
  }
}

const wrangler = await readFile(path.join(root, 'wrangler.jsonc'), 'utf8');
assert(wrangler.includes('beaufort-learning-harbor-v11-preview'), 'v11 must use the isolated preview Worker name');
assert(!wrangler.includes('"name": "beaufort-learning-harbor"'), 'v11 must not target the v10 production Worker');
assert(wrangler.includes('"APP_RELEASE": "11.0.0-beta.3"'), 'Worker release must match beta.3');
assert(wrangler.includes('"/api/*"'), 'Worker-first API routing is required');

const migrationDirectory = path.join(root, 'supabase/migrations');
const migrationNames = (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort();
const migrationText = (await Promise.all(migrationNames.map((name) => readFile(path.join(migrationDirectory, name), 'utf8')))).join('\n');
const rlsCount = (migrationText.match(/enable row level security/gi) ?? []).length;
assert(rlsCount >= 18, `Expected RLS on all shared tables; found ${rlsCount}`);
for (const requiredBoundary of [
  'current_org_role', 'can_view_family', 'can_manage_family', 'organization_invites',
  'learner_today_items', 'learning_operation_receipts', 'client_operation_id', 'transition_learner_today_item',
  'knowledge_checks', 'knowledge_attempts', 'evidence_submissions', 'weekly_plans', 'weekly_plan_items',
  'learning_studio_operation_receipts', 'submit_knowledge_attempt', 'review_evidence_submission'
]) {
  assert(migrationText.includes(requiredBoundary), `Missing Supabase boundary: ${requiredBoundary}`);
}
assert(migrationText.includes('Operation ID is required'), 'Idempotent RPCs must require operation IDs');
assert(migrationText.includes('Operation ID was already used for a different action'), 'Operation receipts must reject cross-action reuse');
assert(migrationText.includes('revoke all on public.learning_operation_receipts from anon, authenticated'), 'clients must not forge Today receipts');
assert(migrationText.includes('revoke all on public.knowledge_attempts'), 'knowledge attempts must use the constrained scoring RPC');
assert(migrationText.includes('revoke all on function public.review_evidence_submission'), 'evidence review must use the constrained review RPC');
assert(!/target_role\s+in\s*\([^)]*system-admin/i.test(migrationText), 'System Administrator must not be an invitable role');
assert(migrationText.includes("access_mode text not null default 'parent-assisted'"), 'learner access must remain parent-assisted');
assert(migrationText.includes('revoke update, delete on public.learner_today_items from authenticated'), 'Today status must use the constrained transition RPC');

const todayStart = migrationText.indexOf('create table public.learner_today_items');
const todayEnd = migrationText.indexOf(');', todayStart);
const todayDefinition = migrationText.slice(todayStart, todayEnd + 2).toLowerCase();
for (const forbiddenOutcome of [' grade ', ' xp ', ' attendance ', ' mastery ']) {
  assert(!todayDefinition.includes(forbiddenOutcome), `Today items must not contain automatic outcome column:${forbiddenOutcome}`);
}

const syncQueue = await readFile(path.join(root, 'src/services/sync-queue.ts'), 'utf8');
for (const boundary of ['pending', 'syncing', 'failed', 'completed', 'cancelled', 'lastSuccessfulSyncAt', 'setEnabled']) {
  assert(syncQueue.includes(boundary), `Sync queue is missing ${boundary}`);
}
assert(syncQueue.includes("['pending', 'syncing', 'failed'].includes(operation.status)"), 'active duplicate operations must be deduplicated');
const resilientLearning = await readFile(path.join(root, 'src/services/resilient-learning.ts'), 'utf8');
assert(resilientLearning.includes('operationId') && resilientLearning.includes('queue.enqueue'), 'Today writes must use stable queued operations');
const studioRepository = await readFile(path.join(root, 'src/services/local-studio.ts'), 'utf8');
for (const boundary of ['scoreKnowledgeCheck', 'submit-evidence', 'review-evidence', 'create-weekly-plan', 'create-weekly-plan-item', 'receipts']) {
  assert(studioRepository.includes(boundary), `Beta.3 studio boundary is missing ${boundary}`);
}
const studioDomain = await readFile(path.join(root, 'src/domain/studio.ts'), 'utf8');
assert(studioDomain.includes('deterministic') || studioDomain.includes('scoreKnowledgeCheck'), 'Objective scoring must be deterministic');
assert(studioDomain.includes("EVIDENCE_STATUSES = ['pending', 'accepted', 'returned']"), 'Subjective proof must require explicit adult states');

const backup = await readFile(path.join(root, 'src/services/local-backup-beta3.ts'), 'utf8');
for (const boundary of ['AES-GCM', 'PBKDF2', 'SHA-256', '120_000', 'active invitation tokens', 'applyBackupPreview', 'knowledgeChecks', 'evidenceSubmissions', 'weeklyPlans']) {
  assert(backup.includes(boundary), `Encrypted beta.3 backup boundary is missing ${boundary}`);
}
assert(backup.includes("'11.0.0-beta.2'"), 'beta.3 must preserve controlled beta.2 backup import');
assert(!backup.includes('service_role'), 'backup implementation must not handle a service-role credential');

const supabaseConfig = await readFile(path.join(root, 'supabase/config.toml'), 'utf8');
assert(supabaseConfig.includes('minimum_password_length = 12'), 'local auth must require at least 12-character passwords');
assert(supabaseConfig.includes('enable_anonymous_sign_ins = false'), 'anonymous Supabase sign-ins must remain disabled');
const identityDatabaseTest = await readFile(path.join(root, 'supabase/tests/identity_bootstrap_test.sql'), 'utf8');
assert(identityDatabaseTest.includes('System Administrator cannot be invited'), 'database tests must cover privileged invitation denial');
const learningDatabaseTest = await readFile(path.join(root, 'supabase/tests/parent_managed_learning_test.sql'), 'utf8');
assert(learningDatabaseTest.includes('Director does not automatically see household learners'), 'database tests must cover Director family-record denial');
const idempotencyDatabaseTest = await readFile(path.join(root, 'supabase/tests/idempotent_sync_test.sql'), 'utf8');
assert(idempotencyDatabaseTest.includes('Transition retry creates one receipt'), 'database tests must cover Today retry idempotency');
const studioDatabaseTest = await readFile(path.join(root, 'supabase/tests/learning_studio_test.sql'), 'utf8');
assert(studioDatabaseTest.includes('Knowledge retry creates one attempt'), 'database tests must cover objective attempt idempotency');
assert(studioDatabaseTest.includes('Evidence retry creates one receipt'), 'database tests must cover evidence review idempotency');

const deployWorkflow = await readFile(path.join(repositoryRoot, '.github/workflows/deploy-v11-preview.yml'), 'utf8');
assert(deployWorkflow.includes('workflow_dispatch:'), 'preview deployment must be manually dispatched');
assert(!/\npush:\s*\n/.test(deployWorkflow), 'preview deployment must not run automatically on push');
assert(deployWorkflow.includes('environment: v11-preview'), 'preview deployment must use the protected v11-preview environment');
assert(deployWorkflow.includes('DEPLOY_V11_PREVIEW'), 'preview deployment must require an explicit confirmation phrase');
assert(deployWorkflow.includes('beaufort-learning-harbor-v11-preview'), 'deployment workflow must verify the isolated Worker target');
assert(deployWorkflow.includes('11.0.0-beta.3'), 'deployment workflow must verify the beta.3 release');

const legacyPointer = JSON.parse(await readFile(path.join(root, '../source/current-release.json'), 'utf8'));
assert(String(legacyPointer.manifest).includes('v10.43'), 'v10.43 must remain the stable legacy release pointer');

const forbiddenPatterns = [
  { pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+/i, label: 'Supabase service-role secret' },
  { pattern: /VITE_[A-Z0-9_]*(?:SERVICE_ROLE|CLIENT_SECRET|ACCESS_TOKEN)/i, label: 'privileged secret exposed through Vite' },
  { pattern: /BAND_(?:CLIENT_SECRET|ACCESS_TOKEN)\s*=\s*\S+/i, label: 'BAND secret or access token' },
  { pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, label: 'private key' },
  { pattern: /eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}/, label: 'committed JWT-like credential' }
];
for (const file of await collectFiles(root)) {
  const relative = path.relative(root, file);
  const content = await readFile(file, 'utf8');
  for (const forbidden of forbiddenPatterns) assert(!forbidden.pattern.test(content), `${forbidden.label} found in ${relative}`);
}

console.log(`v11 beta.3 boundary checks passed: ${rlsCount} RLS tables, explicit objective scoring, adult-reviewed proof, bounded planning, queued operations, encrypted recovery, manual preview gate, exact dependencies, and no committed secrets`);
