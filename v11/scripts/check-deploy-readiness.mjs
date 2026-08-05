import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

function fail(message) { throw new Error(`Preview deployment blocked: ${message}`); }
function required(name) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) fail(`${name} is not configured in the v11-preview GitHub environment`);
  return value;
}
function jwtRole(value) {
  try {
    const payload = value.split('.')[1];
    if (!payload) return '';
    return JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).role ?? '';
  } catch { return ''; }
}

const root = process.cwd();
const expectedWorker = 'beaufort-learning-harbor-v11-preview';
const expectedRelease = '11.0.0-rc.1';
const accountId = required('CLOUDFLARE_ACCOUNT_ID');
const apiToken = required('CLOUDFLARE_API_TOKEN');
const supabaseUrl = required('VITE_SUPABASE_URL');
const publishableKey = required('VITE_SUPABASE_PUBLISHABLE_KEY');
const previewUrl = required('V11_PREVIEW_URL');
if (!/^[a-f0-9]{32}$/i.test(accountId)) fail('CLOUDFLARE_ACCOUNT_ID has an unexpected format');
if (apiToken.length < 20) fail('CLOUDFLARE_API_TOKEN has an unexpected format');
if (publishableKey.startsWith('sb_secret_') || jwtRole(publishableKey) === 'service_role') fail('a Supabase secret or service-role key was supplied as a browser key');

let parsedSupabase;
let parsedPreview;
try { parsedSupabase = new URL(supabaseUrl); parsedPreview = new URL(previewUrl); }
catch { fail('Supabase and preview URLs must be valid absolute URLs'); }
if (parsedSupabase.protocol !== 'https:' || !parsedSupabase.hostname.endsWith('.supabase.co')) fail('VITE_SUPABASE_URL must be an HTTPS Supabase-hosted project URL');
if (parsedPreview.protocol !== 'https:') fail('V11_PREVIEW_URL must use HTTPS');
if (parsedPreview.pathname !== '/' && parsedPreview.pathname !== '') fail('V11_PREVIEW_URL must identify the preview origin, not an application path');
if (parsedPreview.hostname === parsedSupabase.hostname) fail('Preview and Supabase origins must remain separate');

const migrations = (await readdir(path.join(root, 'supabase/migrations'))).filter((name) => name.endsWith('.sql')).sort();
const migration009Name = '202608040009_v11_migration_rehearsal.sql';
const migration010Name = '202608050010_v11_hosted_acl_hardening.sql';
if (migrations.at(-1) !== migration010Name) fail('migration 010 hosted ACL hardening is not the latest reviewed migration');
if (!migrations.includes(migration009Name)) fail('migration 009 release-candidate rehearsal is missing');

const migration009 = await readFile(path.join(root, 'supabase/migrations', migration009Name), 'utf8');
if (!migration009.includes('release_candidate_readiness_status')) fail('migration 009 is missing the authenticated readiness status RPC');
if (!migration009.includes("'live_migration_enabled', false") || !migration009.includes("'production_cutover_approved', false")) fail('migration 009 does not keep live migration and cutover disabled');

const migration010 = await readFile(path.join(root, 'supabase/migrations', migration010Name), 'utf8');
if (!migration010.includes('hosted_acl_status')) fail('migration 010 is missing the authenticated hosted ACL status RPC');
if (!migration010.includes("execute format('revoke execute on function %s from public'")) fail('migration 010 does not revoke inherited PUBLIC function execution');
if (!migration010.includes("execute format('revoke execute on function %s from anon'")) fail('migration 010 does not revoke direct anonymous function execution');
if (!migration010.includes('revoke execute on function public.submit_knowledge_attempt(uuid, jsonb, uuid) from authenticated')) fail('migration 010 does not disable the superseded scoring RPC');

const wrangler = await readFile(path.join(root, 'wrangler.jsonc'), 'utf8');
if (!wrangler.includes(`"name": "${expectedWorker}"`)) fail('Wrangler is not targeting the isolated v11 preview Worker');
if (wrangler.includes('"name": "beaufort-learning-harbor"')) fail('Wrangler unexpectedly targets the v10 production Worker');
if (!wrangler.includes(`"APP_RELEASE": "${expectedRelease}"`)) fail('Wrangler release does not match rc.1');

const redirectPath = path.join(root, '.wrangler/deploy/config.json');
let redirect;
try { redirect = JSON.parse(await readFile(redirectPath, 'utf8')); }
catch { fail('Cloudflare Vite generated deployment redirect is missing or invalid; run the production build first'); }
if (!redirect || typeof redirect.configPath !== 'string' || Object.keys(redirect).length !== 1) fail('Cloudflare Vite deployment redirect has an unexpected shape');

const generatedConfigPath = path.resolve(path.dirname(redirectPath), redirect.configPath);
const generatedRelative = path.relative(root, generatedConfigPath).replaceAll('\\', '/');
if (generatedRelative.startsWith('../') || !generatedRelative.startsWith('dist/')) fail('Cloudflare Vite deployment redirect escapes the reviewed dist output');

let generated;
try { generated = JSON.parse(await readFile(generatedConfigPath, 'utf8')); }
catch { fail('Cloudflare Vite generated Worker configuration is missing or invalid'); }
if (generated.name !== expectedWorker) fail('generated Worker configuration targets the wrong service');
if (generated.vars?.APP_RELEASE !== expectedRelease || generated.vars?.APP_ENV !== 'preview') fail('generated Worker configuration has unexpected release or environment variables');
if (typeof generated.main !== 'string' || !generated.main) fail('generated Worker configuration is missing its built entry point');
if (typeof generated.assets?.directory !== 'string' || !generated.assets.directory) fail('generated Worker configuration is missing its built assets directory');
if (generated.assets?.binding !== 'ASSETS') fail('generated Worker configuration is missing the reviewed ASSETS binding');
if (!Array.isArray(generated.assets?.run_worker_first) || !generated.assets.run_worker_first.includes('/api/*')) fail('generated Worker configuration is missing Worker-first API routing');

const generatedMainPath = path.resolve(path.dirname(generatedConfigPath), generated.main);
const generatedAssetsPath = path.resolve(path.dirname(generatedConfigPath), generated.assets.directory);
const expectedAssetsPath = path.join(root, 'dist/client');
if (generatedAssetsPath !== expectedAssetsPath) fail('generated Worker configuration does not point to the reviewed client build output');
try { await access(generatedMainPath); await access(path.join(generatedAssetsPath, 'index.html')); }
catch { fail('generated Worker code or client index is missing from the production build output'); }

console.log('Preview deployment readiness passed for rc.1. Configuration and migrations 001-010 are structurally valid; the authenticated hosted schema is isolated; and Wrangler will deploy the Cloudflare Vite generated Worker and client assets rather than the input configuration.');
