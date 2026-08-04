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
assert(packageJson.version === '11.0.0-beta.4', 'package release must be 11.0.0-beta.4');
assert(packageJson.devDependencies?.supabase === '2.110.0', 'Supabase CLI must be pinned exactly');
assert(packageJson.scripts?.['pilot:doctor'] === 'node scripts/pilot-doctor.mjs', 'pilot doctor script must remain explicit and inert');
assert(packageJson.scripts?.['pilot:verify-schema'] === 'node scripts/verify-remote-schema.mjs', 'remote schema verifier must remain explicit');
for (const [groupName, dependencies] of Object.entries({ dependencies: packageJson.dependencies, devDependencies: packageJson.devDependencies })) {
  for (const [name, version] of Object.entries(dependencies ?? {})) {
    assert(typeof version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version), `${groupName}.${name} must use an exact pinned version`);
  }
}

const wrangler = await readFile(path.join(root, 'wrangler.jsonc'), 'utf8');
assert(wrangler.includes('"name": "beaufort-learning-harbor-v11-preview"'), 'v11 must use the isolated preview Worker name');
assert(!wrangler.includes('"name": "beaufort-learning-harbor"'), 'v11 must not target the v10 production Worker');
assert(wrangler.includes('"APP_RELEASE": "11.0.0-beta.4"'), 'Worker release must match beta.4');
assert(wrangler.includes('"/api/*"'), 'Worker-first API routing is required');

const migrationDirectory = path.join(root, 'supabase/migrations');
const migrationNames = (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort();
assert(migrationNames.at(-1) === '202608040008_v11_hosted_pilot.sql', 'migration 008 must be the latest reviewed migration');
const migrationText = (await Promise.all(migrationNames.map((name) => readFile(path.join(migrationDirectory, name), 'utf8')))).join('\n');
const rlsCount = (migrationText.match(/enable row level security/gi) ?? []).length;
assert(rlsCount >= 18, `Expected RLS on all shared tables; found ${rlsCount}`);
for (const requiredBoundary of [
  'current_org_role', 'can_view_family', 'can_manage_family', 'organization_invites',
  'learner_today_items', 'learning_operation_receipts', 'client_operation_id', 'transition_learner_today_item',
  'knowledge_checks', 'knowledge_attempts', 'evidence_submissions', 'weekly_plans', 'weekly_plan_items',
  'learning_studio_operation_receipts', 'submit_knowledge_attempt', 'submit_knowledge_attempt_v2',
  'review_evidence_submission', 'hosted_pilot_schema_status'
]) {
  assert(migrationText.includes(requiredBoundary), `Missing Supabase boundary: ${requiredBoundary}`);
}
assert(migrationText.includes('Target attempt ID is required'), 'hosted scoring must preserve an explicit client record ID');
assert(migrationText.includes('client_record_id_preserved'), 'hosted scoring audit must record client ID preservation');
assert(migrationText.includes('Operation ID was already used for a different action'), 'operation receipts must reject cross-action reuse');
assert(migrationText.includes('revoke all on public.learning_operation_receipts from anon, authenticated'), 'clients must not forge Today receipts');
assert(migrationText.includes('revoke all on public.knowledge_attempts'), 'knowledge attempts must use constrained scoring RPCs');
assert(migrationText.includes('revoke all on function public.review_evidence_submission'), 'evidence review must use the constrained review RPC');
assert(migrationText.includes('production_data_enabled'), 'schema status must explicitly report production-data state');
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
for (const boundary of ['studioRemote', 'create-knowledge-check', 'submit-knowledge-attempt', 'submit-evidence', 'review-evidence', 'create-weekly-plan-item']) {
  assert(resilientLearning.includes(boundary), `shared queue executor is missing hosted studio boundary ${boundary}`);
}
assert(resilientLearning.includes('operationId: operation.id'), 'hosted retries must reuse stable operation IDs');
assert(resilientLearning.includes('attemptId: payload.id'), 'hosted knowledge attempts must preserve the local record ID');

const localStudio = await readFile(path.join(root, 'src/services/local-studio.ts'), 'utf8');
for (const boundary of ['readOrganizationSnapshot', 'replaceOrganizationSnapshot', 'scoreKnowledgeCheck', 'receipts', 'cloud-connected', 'cloud-ready']) {
  assert(localStudio.includes(boundary), `local-first studio mirror is missing ${boundary}`);
}
const hostedStudio = await readFile(path.join(root, 'src/services/supabase-studio.ts'), 'utf8');
for (const boundary of ['SupabaseLearningStudioRepository', 'submit_knowledge_attempt_v2', 'review_evidence_submission', 'client_operation_id']) {
  assert(hostedStudio.includes(boundary), `hosted studio repository is missing ${boundary}`);
}
const resilientStudio = await readFile(path.join(root, 'src/services/resilient-studio.ts'), 'utf8');
for (const boundary of ['reconcileRecords', 'activeStudioRecordIds', 'replaceOrganizationConflicts', 'localDigest', 'remoteDigest']) {
  assert(resilientStudio.includes(boundary), `conflict-aware reconciliation is missing ${boundary}`);
}
assert(resilientStudio.includes('records.push(local)'), 'divergent records must preserve the local record rather than silently overwrite it');
const conflictStore = await readFile(path.join(root, 'src/services/studio-conflicts.ts'), 'utf8');
assert(conflictStore.includes('acknowledge') && conflictStore.includes('lastRemoteRefreshError'), 'hosted pilot conflict diagnostics must be visible and acknowledgeable');
const pilotWorkspace = await readFile(path.join(root, 'src/components/HostedPilotWorkspace.tsx'), 'utf8');
for (const exclusion of ['record content and learner work', 'queue payloads', 'raw synchronization error text']) {
  assert(pilotWorkspace.includes(exclusion), `sanitized diagnostics must exclude ${exclusion}`);
}
assert(!pilotWorkspace.includes('operation.payload'), 'pilot diagnostics must not export queue payloads');

const studioDomain = await readFile(path.join(root, 'src/domain/studio.ts'), 'utf8');
assert(studioDomain.includes('scoreKnowledgeCheck'), 'objective scoring must remain deterministic');
assert(studioDomain.includes("EVIDENCE_STATUSES = ['pending', 'accepted', 'returned']"), 'subjective proof must require explicit adult states');
assert(studioDomain.includes('LearningStudioMirrorRepository'), 'hosted reconciliation requires an explicit local mirror contract');

const runtime = await readFile(path.join(root, 'src/lib/supabase.ts'), 'utf8');
assert(runtime.includes("release: '11.0.0-beta.4'"), 'browser runtime release must match beta.4');
assert(runtime.includes("publishableKey.startsWith('sb_secret_')"), 'browser runtime must reject Supabase secret keys');
assert(runtime.includes("decodeJwtRole(publishableKey) === 'service_role'"), 'browser runtime must reject service-role JWTs');

const backup = await readFile(path.join(root, 'src/services/local-backup-beta3.ts'), 'utf8');
for (const boundary of ['AES-GCM', 'PBKDF2', 'SHA-256', '120_000', 'active invitation tokens', 'hosted reconciliation diagnostics', 'applyBackupPreview', 'knowledgeChecks', 'evidenceSubmissions', 'weeklyPlans']) {
  assert(backup.includes(boundary), `encrypted beta.4 backup boundary is missing ${boundary}`);
}
assert(backup.includes("'11.0.0-beta.2'") && backup.includes("'11.0.0-beta.3'"), 'beta.4 must preserve controlled beta.2 and beta.3 backup import');
assert(!backup.includes('service_role'), 'backup implementation must not handle a service-role credential');

const doctor = await readFile(path.join(root, 'scripts/pilot-doctor.mjs'), 'utf8');
assert(doctor.includes('pilot-doctor-report.json') && doctor.includes('missing') && doctor.includes('unsafe'), 'pilot doctor must produce a sanitized readiness report');
assert(!doctor.includes('PILOT_TEST_PASSWORD'), 'pilot doctor must not inspect or report test-account credentials');
const remoteVerifier = await readFile(path.join(root, 'scripts/verify-remote-schema.mjs'), 'utf8');
assert(remoteVerifier.includes('hosted_pilot_schema_status'), 'remote verifier must use the authenticated schema-status RPC');
assert(remoteVerifier.includes('persistSession: false'), 'remote verifier must not persist the synthetic pilot session');
assert(remoteVerifier.includes('client.auth.signOut'), 'remote verifier must explicitly close its synthetic session');

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
const hostedPilotDatabaseTest = await readFile(path.join(root, 'supabase/tests/hosted_pilot_test.sql'), 'utf8');
for (const assertion of ['Hosted attempt preserves the local record ID', 'Hosted retry creates one operation receipt', 'Eighth day is rejected by the database']) {
  assert(hostedPilotDatabaseTest.includes(assertion), `hosted pilot database tests must cover: ${assertion}`);
}

const validateWorkflow = await readFile(path.join(repositoryRoot, '.github/workflows/validate-v11.yml'), 'utf8');
assert(validateWorkflow.includes('v11-beta4-pilot-doctor-unconfigured'), 'normal CI must retain the safe missing-provider doctor report');
assert(validateWorkflow.includes('beaufort-learning-harbor-v11.0.0-beta.4-preview'), 'normal CI must build the beta.4 preview artifact');
const deployWorkflow = await readFile(path.join(repositoryRoot, '.github/workflows/deploy-v11-preview.yml'), 'utf8');
assert(deployWorkflow.includes('workflow_dispatch:'), 'preview deployment must be manually dispatched');
assert(!/\npush:\s*\n/.test(deployWorkflow), 'preview deployment must not run automatically on push');
assert(deployWorkflow.includes('environment: v11-preview'), 'preview deployment must use the protected v11-preview environment');
assert(deployWorkflow.includes('DEPLOY_V11_PREVIEW'), 'preview deployment must require an explicit confirmation phrase');
assert(deployWorkflow.includes('beaufort-learning-harbor-v11-preview'), 'deployment workflow must verify the isolated Worker target');
assert(deployWorkflow.includes('11.0.0-beta.4'), 'deployment workflow must verify the beta.4 release');
assert(deployWorkflow.includes('npm run pilot:verify-schema'), 'deployment must verify migration 008 through the authenticated schema RPC before deployment');
assert(deployWorkflow.includes('PILOT_TEST_EMAIL') && deployWorkflow.includes('PILOT_TEST_PASSWORD'), 'protected deployment must use a synthetic pilot account for schema verification');
assert(deployWorkflow.includes('automaticDeployment'), 'deployed configuration must verify automatic deployment remains disabled');

const legacyPointer = JSON.parse(await readFile(path.join(root, '../source/current-release.json'), 'utf8'));
assert(String(legacyPointer.manifest).includes('v10.43'), 'v10.43 must remain the stable legacy release pointer');

const forbiddenPatterns = [
  { pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+/i, label: 'Supabase service-role secret' },
  { pattern: /VITE_[A-Z0-9_]*(?:SERVICE_ROLE|CLIENT_SECRET|ACCESS_TOKEN)\s*[:=]\s*[^$\s][^\s]*/i, label: 'privileged secret exposed through Vite' },
  { pattern: /BAND_(?:CLIENT_SECRET|ACCESS_TOKEN)\s*=\s*\S+/i, label: 'BAND secret or access token' },
  { pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, label: 'private key' },
  { pattern: /eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}/, label: 'committed JWT-like credential' }
];
for (const file of await collectFiles(root)) {
  const relative = path.relative(root, file);
  const content = await readFile(file, 'utf8');
  for (const forbidden of forbiddenPatterns) assert(!forbidden.pattern.test(content), `${forbidden.label} found in ${relative}`);
}

console.log(`v11 beta.4 boundary checks passed: ${rlsCount} RLS tables, hosted studio repositories, stable client IDs, conflict-aware reconciliation, secret-safe pilot diagnostics, encrypted recovery, protected manual deployment, exact dependencies, and no committed secrets`);
