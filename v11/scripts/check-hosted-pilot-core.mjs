import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const repositoryRoot = path.resolve(root, '..');

function assert(condition, message) {
  if (!condition) throw new Error(`Hosted pilot core guard failed: ${message}`);
}

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
assert(pkg.scripts?.['pilot:run-core'] === 'node scripts/run-hosted-pilot-core.mjs', 'pilot:run-core script is not wired exactly');
assert(pkg.scripts?.['pilot:validate-core'] === 'node scripts/validate-hosted-pilot-core.mjs', 'pilot:validate-core script is not wired exactly');
assert(pkg.scripts?.['check:hosted-pilot-core'] === 'node scripts/check-hosted-pilot-core.mjs', 'check:hosted-pilot-core script is not wired exactly');
assert(String(pkg.scripts?.verify ?? '').includes('npm run check:hosted-pilot-core'), 'npm run verify must include the hosted pilot core guard');

const runner = await readFile(path.join(root, 'scripts/run-hosted-pilot-core.mjs'), 'utf8');
for (const marker of [
  "syntheticSlugPrefix = 'rc2-pilot-'",
  'invalid password sign-in',
  'System Administrator invitation',
  'revoked invitation redemption',
  'transition_learner_today_item',
  'submit_knowledge_attempt_v2',
  'review_evidence_submission',
  'eighth-day plan item',
  'synthetic organization cleanup',
  'realFamilyDataAuthorized: false',
  'productionCutoverApproved: false'
]) assert(runner.includes(marker), `core pilot runner is missing ${marker}`);
assert(runner.includes("client.from('organizations').delete()"), 'core pilot must delete its synthetic organization');
assert(runner.includes('client.auth.signOut()'), 'core pilot must sign out the verifier');
assert(!runner.includes('service_role'), 'core pilot must not use a service-role credential');
assert(!runner.includes('console.log(pilotEmail)') && !runner.includes('console.log(pilotPassword)'), 'core pilot must not log verifier credentials');

const validator = await readFile(path.join(root, 'scripts/validate-hosted-pilot-core.mjs'), 'utf8');
for (const marker of [
  'beaufort-learning-harbor-hosted-pilot-core-v1',
  'core-synthetic-pilot-evidenced-full-gate-c-incomplete',
  'invalidPasswordDenied',
  'systemAdministratorDenied',
  'clientRecordIdPreserved',
  'automaticCompletion === false',
  'automaticAcceptance === false',
  'eighthDayDenied',
  'syntheticOrganizationDeleted',
  'full-gate-c-incomplete'
]) assert(validator.includes(marker), `core pilot validator is missing ${marker}`);
for (const secretMarker of ['email address', 'Supabase key', 'Cloudflare token', 'JWT-like value', 'private key']) {
  assert(validator.includes(secretMarker), `core pilot sanitizer is missing ${secretMarker}`);
}

const workflow = await readFile(path.join(repositoryRoot, '.github/workflows/run-v11-hosted-pilot.yml'), 'utf8');
assert(workflow.includes('workflow_dispatch:'), 'hosted pilot workflow must be manual');
assert(!/\npush:\s*\n/.test(workflow), 'hosted pilot workflow must not run on push');
for (const marker of [
  'RUN_V11_SYNTHETIC_PILOT',
  'environment: v11-preview',
  'npm run pilot:doctor',
  'npm run pilot:verify-schema',
  'npm run pilot:run-core',
  'npm run pilot:validate-core',
  'rc2-hosted-pilot-core-evidence.json',
  'if: always()'
]) assert(workflow.includes(marker), `hosted pilot workflow is missing ${marker}`);
assert(!workflow.includes('wrangler deploy'), 'Gate C core workflow must not redeploy Cloudflare');
assert(!workflow.includes('supabase db push'), 'Gate C core workflow must not mutate provider schema');

console.log('Gate C core hosted-pilot guard passed: manual protected execution, synthetic-only transactions, idempotency and authority checks, sanitized evidence, exact cleanup, no schema push, and no deployment.');
