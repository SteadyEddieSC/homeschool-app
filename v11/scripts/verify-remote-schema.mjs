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
    return JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).role ?? '';
  } catch { return ''; }
}

const supabaseUrl = required('VITE_SUPABASE_URL');
const publishableKey = required('VITE_SUPABASE_PUBLISHABLE_KEY');
const pilotEmail = required('PILOT_TEST_EMAIL');
const pilotPassword = required('PILOT_TEST_PASSWORD');
if (!supabaseUrl.startsWith('https://') || !new URL(supabaseUrl).hostname.endsWith('.supabase.co')) throw new Error('VITE_SUPABASE_URL must identify an HTTPS Supabase-hosted project');
if (publishableKey.startsWith('sb_secret_') || jwtRole(publishableKey) === 'service_role') throw new Error('The browser key is privileged; remote verification stopped before authentication');

const client = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const signIn = await client.auth.signInWithPassword({ email: pilotEmail, password: pilotPassword });
if (signIn.error || !signIn.data.user) throw new Error(`Pilot test account could not authenticate: ${signIn.error?.message ?? 'unknown error'}`);

try {
  const hosted = await client.rpc('hosted_pilot_schema_status');
  if (hosted.error) throw hosted.error;
  const hostedValue = hosted.data;
  if (!hostedValue || typeof hostedValue !== 'object') throw new Error('Hosted pilot schema status returned an invalid payload');
  if (hostedValue.release !== '11.0.0-beta.4' || hostedValue.migration !== '202608040008') throw new Error('Hosted pilot schema baseline is not beta.4 migration 008');
  if (hostedValue.production_data_enabled !== false) throw new Error('Hosted pilot schema unexpectedly enables production data');
  if (hostedValue.idempotent_studio_rpc !== true || hostedValue.subjective_proof_review_rpc !== true) throw new Error('Hosted studio idempotency or proof review capability is missing');

  const rc = await client.rpc('release_candidate_readiness_status');
  if (rc.error) throw rc.error;
  const value = rc.data;
  if (!value || typeof value !== 'object') throw new Error('Release-candidate status returned an invalid payload');
  if (value.release !== '11.0.0-rc.1' || value.migration !== '202608040009') throw new Error('Remote release candidate is not rc.1 migration 009');
  if (value.synthetic_migration_rehearsal !== true) throw new Error('Synthetic migration rehearsal capability is missing');
  if (value.live_migration_enabled !== false || value.production_data_enabled !== false || value.production_cutover_approved !== false) throw new Error('Remote rc.1 unexpectedly enables live migration, production data, or cutover');
  if (value.owner_approval_required !== true) throw new Error('Owner approval boundary is missing');

  const acl = await client.rpc('hosted_acl_status');
  if (acl.error) throw acl.error;
  const aclValue = acl.data;
  if (!aclValue || typeof aclValue !== 'object') throw new Error('Hosted ACL status returned an invalid payload');
  if (aclValue.release !== '11.0.0-rc.1' || aclValue.migration !== '202608050010') throw new Error('Remote hosted ACL hardening is not migration 010');
  if (aclValue.anonymous_security_definer_executable !== 0) throw new Error('Anonymous security-definer RPC execution remains enabled');
  if (aclValue.authenticated_trigger_functions_executable !== 0) throw new Error('Trigger-only functions remain browser-callable');
  if (aclValue.legacy_scoring_rpc_executable !== false) throw new Error('Superseded scoring RPC remains enabled');
  if (aclValue.current_scoring_rpc_executable !== true) throw new Error('Current client-ID-preserving scoring RPC is unavailable');
  if (aclValue.production_data_enabled !== false || aclValue.production_cutover_approved !== false) throw new Error('ACL status unexpectedly enables production data or cutover');

  const report = {
    schema: 'beaufort-learning-harbor-remote-schema-report-v3',
    release: value.release,
    migration: value.migration,
    checkedAt: new Date().toISOString(),
    supabaseHost: new URL(supabaseUrl).hostname,
    authenticated: true,
    hostedPilotBaseline: { release: hostedValue.release, migration: hostedValue.migration, productionDataEnabled: false },
    releaseCandidate: {
      syntheticMigrationRehearsal: true,
      liveMigrationEnabled: false,
      productionDataEnabled: false,
      productionCutoverApproved: false,
      ownerApprovalRequired: true
    },
    aclHardening: {
      migration: aclValue.migration,
      anonymousSecurityDefinerExecutable: 0,
      authenticatedTriggerFunctionsExecutable: 0,
      legacyScoringRpcExecutable: false,
      currentScoringRpcExecutable: true
    }
  };
  await writeFile(path.join(process.cwd(), 'remote-schema-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await client.auth.signOut();
}
