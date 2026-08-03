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
assert(packageJson.version === '11.0.0-beta.1', 'package release must be 11.0.0-beta.1');
assert(packageJson.devDependencies?.supabase === '2.110.0', 'Supabase CLI must be pinned exactly');
for (const [groupName, dependencies] of Object.entries({
  dependencies: packageJson.dependencies,
  devDependencies: packageJson.devDependencies
})) {
  for (const [name, version] of Object.entries(dependencies ?? {})) {
    assert(typeof version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version), `${groupName}.${name} must use an exact pinned version`);
  }
}

const wrangler = await readFile(path.join(root, 'wrangler.jsonc'), 'utf8');
assert(wrangler.includes('beaufort-learning-harbor-v11-preview'), 'v11 must use the isolated preview Worker name');
assert(!wrangler.includes('"name": "beaufort-learning-harbor"'), 'v11 must not target the v10 production Worker');
assert(wrangler.includes('"APP_RELEASE": "11.0.0-beta.1"'), 'Worker release must match beta.1');
assert(wrangler.includes('"/api/*"'), 'Worker-first API routing is required');

const migrationDirectory = path.join(root, 'supabase/migrations');
const migrationNames = (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort();
const migrationText = (await Promise.all(migrationNames.map((name) => readFile(path.join(migrationDirectory, name), 'utf8')))).join('\n');
const rlsCount = (migrationText.match(/enable row level security/gi) ?? []).length;
assert(rlsCount >= 11, `Expected RLS on all shared tables; found ${rlsCount}`);
for (const requiredBoundary of [
  'current_org_role',
  'can_view_household',
  'can_manage_household',
  'can_view_family',
  'can_manage_family',
  'can_view_ticket',
  'organization_invites',
  'bootstrap_organization',
  'create_organization_invite',
  'redeem_organization_invite',
  'revoke_organization_invite',
  'shares_managed_organization',
  'learner_today_items',
  'transition_learner_today_item'
]) {
  assert(migrationText.includes(requiredBoundary), `Missing Supabase boundary: ${requiredBoundary}`);
}
assert(!/target_role\s+in\s*\([^)]*system-admin/i.test(migrationText), 'System Administrator must not be an invitable role');
assert(migrationText.includes("role in ('student', 'parent', 'teacher', 'director', 'group-admin')"), 'ordinary membership role allowlist is required');
assert(migrationText.includes('revoke insert on public.organizations from authenticated'), 'direct organization creation must be revoked');
assert(migrationText.includes("access_mode text not null default 'parent-assisted'"), 'learner access must remain parent-assisted in beta.1');
assert(migrationText.includes('revoke update, delete on public.learner_today_items from authenticated'), 'Today status must use the constrained transition RPC');
for (const forbiddenOutcome of [' grade ', ' xp ', ' attendance ', ' mastery ']) {
  const tableStart = migrationText.indexOf('create table public.learner_today_items');
  const tableEnd = migrationText.indexOf(');', tableStart);
  const tableDefinition = migrationText.slice(tableStart, tableEnd + 2).toLowerCase();
  assert(!tableDefinition.includes(forbiddenOutcome), `Today items must not contain automatic outcome column:${forbiddenOutcome}`);
}

const supabaseConfig = await readFile(path.join(root, 'supabase/config.toml'), 'utf8');
assert(supabaseConfig.includes('minimum_password_length = 12'), 'local auth must require at least 12-character passwords');
assert(supabaseConfig.includes('enable_anonymous_sign_ins = false'), 'anonymous Supabase sign-ins must remain disabled');
const identityDatabaseTest = await readFile(path.join(root, 'supabase/tests/identity_bootstrap_test.sql'), 'utf8');
assert(identityDatabaseTest.includes('System Administrator cannot be invited'), 'database tests must cover privileged invitation denial');
assert(identityDatabaseTest.includes('one-time invitation cannot be reused'), 'database tests must cover invitation replay denial');
const learningDatabaseTest = await readFile(path.join(root, 'supabase/tests/parent_managed_learning_test.sql'), 'utf8');
assert(learningDatabaseTest.includes('Director does not automatically see household learners'), 'database tests must cover Director family-record denial');
assert(learningDatabaseTest.includes('Unrelated parent cannot mutate another learner Today item'), 'database tests must cover cross-household mutation denial');
assert(learningDatabaseTest.includes('Today items do not award XP'), 'database tests must cover automatic-outcome absence');

const deployWorkflow = await readFile(path.join(repositoryRoot, '.github/workflows/deploy-v11-preview.yml'), 'utf8');
assert(deployWorkflow.includes('workflow_dispatch:'), 'preview deployment must be manually dispatched');
assert(!/\npush:\s*\n/.test(deployWorkflow), 'preview deployment must not run automatically on push');
assert(deployWorkflow.includes('environment: v11-preview'), 'preview deployment must use the protected v11-preview environment');
assert(deployWorkflow.includes('DEPLOY_V11_PREVIEW'), 'preview deployment must require an explicit confirmation phrase');
assert(deployWorkflow.includes('beaufort-learning-harbor-v11-preview'), 'deployment workflow must verify the isolated Worker target');
assert(deployWorkflow.includes('11.0.0-beta.1'), 'deployment workflow must verify the beta.1 release');

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
  for (const forbidden of forbiddenPatterns) {
    assert(!forbidden.pattern.test(content), `${forbidden.label} found in ${relative}`);
  }
}

console.log(`v11 beta.1 boundary checks passed: ${rlsCount} RLS tables, parent-managed learners, constrained Today transitions, manual preview gate, exact dependencies, and no committed secrets`);
