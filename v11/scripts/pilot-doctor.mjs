import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const reportPath = path.join(root, 'pilot-doctor-report.json');
const scope = process.argv[2] ?? 'deployment';
const requiredEnvironmentByScope = {
  deployment: [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'V11_PREVIEW_URL',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_API_TOKEN'
  ],
  browser: [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'V11_PREVIEW_URL'
  ]
};

if (!Object.hasOwn(requiredEnvironmentByScope, scope)) {
  throw new Error(`Unsupported hosted-pilot doctor scope: ${scope}`);
}

const requiredEnvironment = requiredEnvironmentByScope[scope];

function jwtRole(value) {
  try {
    const payload = value.split('.')[1];
    if (!payload) return '';
    return JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).role ?? '';
  } catch {
    return '';
  }
}

function present(name) {
  return String(process.env[name] ?? '').trim().length > 0;
}

function safeHost(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

const missing = requiredEnvironment.filter((name) => !present(name));
const unsafe = [];
const supabaseUrl = String(process.env.VITE_SUPABASE_URL ?? '').trim();
const browserKey = String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
const previewUrl = String(process.env.V11_PREVIEW_URL ?? '').trim();
const account = String(process.env.CLOUDFLARE_ACCOUNT_ID ?? '').trim();

if (browserKey.startsWith('sb_secret_') || jwtRole(browserKey) === 'service_role') unsafe.push('browser publishable key is privileged');
if (supabaseUrl && (!supabaseUrl.startsWith('https://') || !safeHost(supabaseUrl))) unsafe.push('Supabase URL must be hosted HTTPS');
if (previewUrl && (!previewUrl.startsWith('https://') || !safeHost(previewUrl))) unsafe.push('Preview URL must be HTTPS');
if (scope === 'deployment' && account && !/^[a-f0-9]{32}$/i.test(account)) unsafe.push('Cloudflare account ID format is unexpected');

const migrations = (await readdir(path.join(root, 'supabase/migrations')))
  .filter((name) => name.endsWith('.sql'))
  .sort();
const latest = migrations.at(-1) ?? '';
if (latest !== '202608050010_v11_hosted_acl_hardening.sql') unsafe.push(`latest migration is ${latest || 'missing'}, expected migration 010`);
if (!migrations.includes('202608040009_v11_migration_rehearsal.sql')) unsafe.push('migration 009 release-candidate rehearsal is missing');

const wrangler = await readFile(path.join(root, 'wrangler.jsonc'), 'utf8');
if (!wrangler.includes('"name": "beaufort-learning-harbor-v11-preview"')) unsafe.push('Wrangler target is not isolated');
if (!wrangler.includes('"APP_RELEASE": "11.0.0-rc.1"')) unsafe.push('Wrangler release does not match rc.1');

const report = {
  schema: 'beaufort-learning-harbor-hosted-pilot-doctor-v1',
  release: '11.0.0-rc.1',
  checkedAt: new Date().toISOString(),
  scope,
  ready: missing.length === 0 && unsafe.length === 0,
  providerConfiguration: Object.fromEntries(requiredEnvironment.map((name) => [name, present(name)])),
  hosts: {
    supabase: safeHost(supabaseUrl) || null,
    preview: safeHost(previewUrl) || null
  },
  migrations: {
    count: migrations.length,
    latest,
    releaseCandidate: '202608040009_v11_migration_rehearsal.sql',
    hostedAclHardening: '202608050010_v11_hosted_acl_hardening.sql'
  },
  migrationRehearsalRequired: true,
  productionCutoverApproved: false,
  missing,
  unsafe
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (unsafe.length) process.exitCode = 1;
else if (missing.length) process.exitCode = 2;
