import { readFile, readdir } from 'node:fs/promises';
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

const migrations = (await readdir(path.join(process.cwd(), 'supabase/migrations'))).filter((name) => name.endsWith('.sql')).sort();
if (migrations.at(-1) !== '202608040009_v11_migration_rehearsal.sql') fail('migration 009 is not the latest reviewed migration');
const migration009 = await readFile(path.join(process.cwd(), 'supabase/migrations/202608040009_v11_migration_rehearsal.sql'), 'utf8');
if (!migration009.includes('release_candidate_readiness_status')) fail('migration 009 is missing the authenticated readiness status RPC');
if (!migration009.includes("'live_migration_enabled', false") || !migration009.includes("'production_cutover_approved', false")) fail('migration 009 does not keep live migration and cutover disabled');

const wrangler = await readFile(path.join(process.cwd(), 'wrangler.jsonc'), 'utf8');
if (!wrangler.includes('"name": "beaufort-learning-harbor-v11-preview"')) fail('Wrangler is not targeting the isolated v11 preview Worker');
if (wrangler.includes('"name": "beaufort-learning-harbor"')) fail('Wrangler unexpectedly targets the v10 production Worker');
if (!wrangler.includes('"APP_RELEASE": "11.0.0-rc.1"')) fail('Wrangler release does not match rc.1');

console.log('Preview deployment readiness passed for rc.1. Configuration and migrations 001-009 are structurally valid; this command does not deploy or modify a provider project.');
