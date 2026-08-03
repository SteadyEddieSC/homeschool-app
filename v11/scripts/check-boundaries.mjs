import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set(['node_modules', 'dist', '.wrangler', 'playwright-report', 'test-results']);
const textExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.jsonc', '.md', '.sql', '.css', '.html', '.example']);

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
assert(wrangler.includes('"/api/*"'), 'Worker-first API routing is required');

const migration = await readFile(path.join(root, 'supabase/migrations/202608030001_v11_foundation.sql'), 'utf8');
const rlsCount = (migration.match(/enable row level security/gi) ?? []).length;
assert(rlsCount >= 9, `Expected RLS on all shared tables; found ${rlsCount}`);
for (const requiredBoundary of [
  'current_org_role',
  'can_view_household',
  'can_manage_household',
  'can_view_ticket',
  'support_messages_select_participant',
  'support_messages_insert_participant'
]) {
  assert(migration.includes(requiredBoundary), `Missing Supabase boundary: ${requiredBoundary}`);
}

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

console.log(`v11 boundary checks passed: ${rlsCount} RLS tables, isolated Worker, exact dependencies, no committed secrets`);
