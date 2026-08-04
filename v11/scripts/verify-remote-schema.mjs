import { createClient } from '@supabase/supabase-js';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

function required(name) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new Error(`${name} is required in the protected hosted-pilot environment`);
  return value;
}

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

const supabaseUrl = required('VITE_SUPABASE_URL');
const publishableKey = required('VITE_SUPABASE_PUBLISHABLE_KEY');
const pilotEmail = required('PILOT_TEST_EMAIL');
const pilotPassword = required('PILOT_TEST_PASSWORD');

if (!supabaseUrl.startsWith('https://') || !new URL(supabaseUrl).hostname.endsWith('.supabase.co')) {
  throw new Error('VITE_SUPABASE_URL must identify an HTTPS Supabase-hosted project');
}
if (publishableKey.startsWith('sb_secret_') || jwtRole(publishableKey) === 'service_role') {
  throw new Error('The browser key is privileged; remote verification stopped before authentication');
}

const client = createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const signIn = await client.auth.signInWithPassword({ email: pilotEmail, password: pilotPassword });
if (signIn.error || !signIn.data.user) {
  throw new Error(`Pilot test account could not authenticate: ${signIn.error?.message ?? 'unknown error'}`);
}

try {
  const status = await client.rpc('hosted_pilot_schema_status');
  if (status.error) throw status.error;
  const value = status.data;
  if (!value || typeof value !== 'object') throw new Error('Hosted schema status returned an invalid payload');
  if (value.release !== '11.0.0-beta.4') throw new Error(`Unexpected hosted release ${String(value.release)}`);
  if (value.migration !== '202608040008') throw new Error(`Unexpected hosted migration ${String(value.migration)}`);
  if (value.production_data_enabled !== false) throw new Error('Hosted pilot schema unexpectedly enables production data');
  if (value.idempotent_studio_rpc !== true || value.subjective_proof_review_rpc !== true) {
    throw new Error('Hosted studio idempotency or proof review capability is missing');
  }

  const report = {
    schema: 'beaufort-learning-harbor-remote-schema-report-v1',
    release: value.release,
    migration: value.migration,
    checkedAt: new Date().toISOString(),
    supabaseHost: new URL(supabaseUrl).hostname,
    authenticated: true,
    capabilities: {
      identityTables: value.identity_tables === true,
      householdLearningTables: value.household_learning_tables === true,
      studioTables: value.studio_tables === true,
      idempotentTodayRpc: value.idempotent_today_rpc === true,
      idempotentStudioRpc: value.idempotent_studio_rpc === true,
      subjectiveProofReviewRpc: value.subjective_proof_review_rpc === true
    },
    productionDataEnabled: value.production_data_enabled === true
  };
  await writeFile(path.join(process.cwd(), 'remote-schema-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await client.auth.signOut();
}
