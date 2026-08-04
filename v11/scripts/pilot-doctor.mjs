import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const reportPath = path.join(root, 'pilot-doctor-report.json');
const requiredEnvironment = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'V11_PREVIEW_URL',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN'
];

function jwtRole(value) {
  try {
    const payload = value.split('.')[1];
    if (!payload) return '';
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8')).role ?? '';
  } catch {
    return '';
  }
}

function present(name) {
  return String(process.env[name] ?? '').trim().length > 0;
}

function safeHost(value) {
  try { return new URL(value).hostname; } catch { return ''; }
}

const missing = requiredEnvironment.filter((name) => !present(name));
const unsafe = [];
const supabaseUrl = String(process.env.VITE_SUPABASE_URL ?? '').trim();
const browserKey = String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
const previewUrl = String(process.env.V11_PREVIEW_URL ?? '').trim();
const cloudflareAccountId = String(process.env.CLOUDFLARE_ACCOUNT_ID ?? '').trim();

if (browserKey.startsWith('sb_secret_') || jwtRole(browserKey) === 'service_role') {
  unsafe.push('VITE_SUPABASE_PUBLISHABLE_KEY is privileged and must never be used in browser configuration');
}
if (supabaseUrl && (safeHost(supabaseUrl) === '' || !supabaseUrl.startsWith('https://'))) {
  unsafe.push('VITE_SUPABASE_URL must be an HTTPS hosted project URL');
}
if (previewUrl && (safeHost(previewUrl) === '' || !previewUrl.startsWith('https://'))) {
  unsafe.push('V11_PREVIEW_URL must be an HTTPS origin');
}
if (cloudflareAccountId && !/^[a-f0-9]{32}$/i.test(cloudflareAccountId)) {
  unsafe.push('CLOUDFLARE_ACCOUNT_ID has an unexpected format');
}

const migrations = (await readdir(path.join(root, 'supabase/migrations')))
  .filter((name) => name.endsWith('.sql'))
  .sort();
const latestMigration = migrations.at(-1) ?? '';
if (latestMigration !== '202608040008_v11_hosted_pilot.sql') {
  unsafe.push(`latest migration is ${latestMigration || 'missing'}, expected beta.4 migration 008`);
}

const wrangler = await readFile(path.join(root, 'wrangler.jsonc'), 'utf8');
if (!wrangler.includes('"name": "beaufort-learning-harbor-v11-preview"')) {
  unsafe.push('Wrangler is not targeting the isolated v11 preview Worker');
}
if (!wrangler.includes('"APP_RELEASE": "11.0.0-beta.4"')) {
  unsafe.push('Wrangler release does not match beta.4');
}
if (wrangler.includes('"name": "beaufort-learning-harbor"')) {
  unsafe.push('Wrangler unexpectedly targets the stable v10 Worker');
}

const report = {
  schema: 'beaufort-learning-harbor-hosted-pilot-doctor-v1',
  release: '11.0.0-beta.4',
  checkedAt: new Date().toISOString(),
  ready: missing.length === 0 && unsafe.length === 0,
  providerConfiguration: Object.fromEntries(requiredEnvironment.map((name) => [name, present(name)])),
  hosts: {
    supabase: safeHost(supabaseUrl) || null,
    preview: safeHost(previewUrl) || null
  },
  migrations: {
    count: migrations.length,
    latest: latestMigration
  },
  missing,
  unsafe
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (unsafe.length > 0) {
  console.error('Hosted pilot doctor found unsafe configuration. No deployment or migration was attempted.');
  process.exitCode = 1;
} else if (missing.length > 0) {
  console.error('Hosted pilot is not activated. Add the missing values only in the protected provider or GitHub environment settings.');
  process.exitCode = 2;
} else {
  console.log('Hosted pilot configuration is ready for explicit dry-run and schema verification.');
}
