import { readFile } from 'node:fs/promises';
import path from 'node:path';

function fail(message) {
  throw new Error(`Preview deployment blocked: ${message}`);
}

function required(name) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) fail(`${name} is not configured in the v11-preview GitHub environment`);
  return value;
}

function jwtRole(value) {
  try {
    const payload = value.split('.')[1];
    if (!payload) return '';
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
    return typeof decoded.role === 'string' ? decoded.role : '';
  } catch {
    return '';
  }
}

const accountId = required('CLOUDFLARE_ACCOUNT_ID');
const apiToken = required('CLOUDFLARE_API_TOKEN');
const supabaseUrl = required('VITE_SUPABASE_URL');
const publishableKey = required('VITE_SUPABASE_PUBLISHABLE_KEY');
const previewUrl = required('V11_PREVIEW_URL');

if (!/^[a-f0-9]{32}$/i.test(accountId)) fail('CLOUDFLARE_ACCOUNT_ID has an unexpected format');
if (apiToken.length < 20) fail('CLOUDFLARE_API_TOKEN has an unexpected format');
if (jwtRole(publishableKey) === 'service_role') fail('a Supabase service-role key was supplied as a browser key');

const parsedSupabase = new URL(supabaseUrl);
if (parsedSupabase.protocol !== 'https:' || !parsedSupabase.hostname.endsWith('.supabase.co')) {
  fail('VITE_SUPABASE_URL must be an HTTPS Supabase-hosted project URL');
}
const parsedPreview = new URL(previewUrl);
if (parsedPreview.protocol !== 'https:') fail('V11_PREVIEW_URL must use HTTPS');
if (parsedPreview.pathname !== '/' && parsedPreview.pathname !== '') fail('V11_PREVIEW_URL must identify the preview origin, not an application path');

const wrangler = await readFile(path.join(process.cwd(), 'wrangler.jsonc'), 'utf8');
if (!wrangler.includes('"name": "beaufort-learning-harbor-v11-preview"')) fail('Wrangler is not targeting the isolated v11 preview Worker');
if (wrangler.includes('"name": "beaufort-learning-harbor"')) fail('Wrangler unexpectedly targets the v10 production Worker');
if (!wrangler.includes('"APP_RELEASE": "11.0.0-beta.1"')) fail('Wrangler release does not match beta.1');

console.log('Preview deployment readiness passed: isolated Worker, hosted Supabase URL, publishable browser key, and scoped CI credentials are present for beta.1.');
