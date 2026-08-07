import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const repositoryRoot = path.resolve(root, '..');

function assert(condition, message) {
  if (!condition) throw new Error(`Hosted multi-account authorization guard failed: ${message}`);
}

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
assert(pkg.scripts?.['check:hosted-multi-account-authorization'] === 'node scripts/check-hosted-multi-account-authorization.mjs', 'repository guard is not wired exactly');
assert(pkg.scripts?.['pilot:test-multi-account-authorization'] === 'playwright test hosted-tests/hosted-multi-account-authorization.spec.ts --config=playwright.hosted.config.ts', 'protected Playwright script is not wired exactly');
assert(pkg.scripts?.['pilot:validate-multi-account-authorization'] === 'node scripts/validate-hosted-multi-account-authorization.mjs', 'evidence validator is not wired exactly');
assert(String(pkg.scripts?.verify ?? '').includes('npm run check:hosted-multi-account-authorization'), 'npm run verify must include the authorization guard');

const testSource = await readFile(path.join(root, 'hosted-tests/hosted-multi-account-authorization.spec.ts'), 'utf8');
for (const marker of [
  'PILOT_PARENT_EMAIL',
  'PILOT_PARENT_PASSWORD',
  'PILOT_DIRECTOR_EMAIL',
  'PILOT_DIRECTOR_PASSWORD',
  "target_role: 'system-admin'",
  'System Administrator appeared in the ordinary invitation role selector',
  'revokedDirectorInvite',
  'Invitation replay',
  'Parent membership administration',
  'Director membership administration',
  'Parent could read an unrelated household learner',
  'Director received household or learner visibility from organization membership alone',
  'Primary Group Administrator could see an unrelated organization',
  'Second Group Administrator retained learner visibility into the prior organization',
  'browserSessionSeparationPreserved',
  'primaryOrganizationDeleted',
  'secondOrganizationDeleted',
  "reason: 'separate-provider-mail-slice'",
  'invitationCodesPersisted: false',
  'emailAddressesPersisted: false',
  'fullGateCComplete: false'
]) assert(testSource.includes(marker), `protected test is missing ${marker}`);
assert(!testSource.includes('console.log('), 'protected multi-account test must not log credentials, invitations, or raw provider values');
assert(!testSource.includes('screenshot(') && !testSource.includes('trace:'), 'protected multi-account test must not persist screenshots or traces');

const validator = await readFile(path.join(root, 'scripts/validate-hosted-multi-account-authorization.mjs'), 'utf8');
for (const marker of [
  'beaufort-learning-harbor-hosted-multi-account-authorization-v1',
  'multi-account-invitation-and-browser-authorization-complete-full-gate-c-incomplete',
  'evidence contains an email address',
  'evidence contains a UUID',
  'possible raw invitation token',
  'separate-provider-mail-slice',
  'fullGateCComplete'
]) assert(validator.includes(marker), `evidence validator is missing ${marker}`);

const identityBootstrap = await readFile(path.join(root, 'src/components/IdentityBootstrap.tsx'), 'utf8');
for (const marker of [
  'Use invitation code',
  'redeem-invite-code',
  'A code cannot grant System Administrator access.'
]) assert(identityBootstrap.includes(marker), `identity bootstrap contract is missing ${marker}`);

const membersWorkspace = await readFile(path.join(root, 'src/components/MembersWorkspace.tsx'), 'utf8');
for (const marker of [
  'INVITABLE_ROLES',
  'invite-role',
  'create-invite',
  'one-time-invite',
  'System Administrator access is never available through an invitation.'
]) assert(membersWorkspace.includes(marker), `membership workspace contract is missing ${marker}`);

const membership = await readFile(path.join(root, 'src/domain/membership.ts'), 'utf8');
assert(membership.includes("['student', 'parent', 'teacher', 'director', 'group-admin']"), 'ordinary invitation roles changed');
assert(!membership.match(/INVITABLE_ROLES[^\n]*system-admin/), 'System Administrator entered the ordinary invitation role set');

const identityMigration = await readFile(path.join(root, 'supabase/migrations/202608030003_v11_identity_bootstrap.sql'), 'utf8');
for (const marker of [
  "role text not null check (role in ('student', 'parent', 'teacher', 'director', 'group-admin'))",
  'Invitation is invalid, expired, revoked, or already used',
  'System Administrator access cannot be granted by invitation',
  "role in ('student', 'parent', 'teacher', 'director', 'group-admin')"
]) assert(identityMigration.includes(marker), `identity migration is missing ${marker}`);

const familyMigration = await readFile(path.join(root, 'supabase/migrations/202608030005_v11_parent_managed_learning.sql'), 'utf8');
for (const marker of [
  "public.current_org_role(household.organization_id) = 'group-admin'",
  'Director, Teacher, Student, and System',
  'Administrator roles do not receive family records merely from org membership.',
  'create policy learners_select_family',
  'create policy households_select_family'
]) assert(familyMigration.includes(marker), `family authorization migration is missing ${marker}`);

const familyTest = await readFile(path.join(root, 'supabase/tests/parent_managed_learning_test.sql'), 'utf8');
for (const marker of [
  'Director does not automatically see household learners',
  'Unrelated parent cannot read another household learner'
]) assert(familyTest.includes(marker), `family pgTAP regression is missing ${marker}`);

const systemAdminTest = await readFile(path.join(root, 'supabase/tests/system_admin_family_boundary_test.sql'), 'utf8');
for (const marker of [
  "'system-admin', 'active'",
  'System Administrator does not automatically see household records',
  'System Administrator does not automatically see household learners'
]) assert(systemAdminTest.includes(marker), `System Administrator pgTAP regression is missing ${marker}`);

const workflow = await readFile(path.join(repositoryRoot, '.github/workflows/run-v11-hosted-pilot.yml'), 'utf8');
for (const marker of [
  'hosted-multi-account-authorization:',
  'needs: hosted-browser-resilience',
  'PILOT_PARENT_EMAIL: ${{ secrets.PILOT_PARENT_EMAIL }}',
  'PILOT_PARENT_PASSWORD: ${{ secrets.PILOT_PARENT_PASSWORD }}',
  'PILOT_DIRECTOR_EMAIL: ${{ secrets.PILOT_DIRECTOR_EMAIL }}',
  'PILOT_DIRECTOR_PASSWORD: ${{ secrets.PILOT_DIRECTOR_PASSWORD }}',
  'npm run pilot:test-multi-account-authorization',
  'npm run pilot:validate-multi-account-authorization',
  'rc2-hosted-multi-account-authorization-evidence.json'
]) assert(workflow.includes(marker), `protected workflow is missing ${marker}`);
const authorizationJob = workflow.split('  hosted-multi-account-authorization:')[1] ?? '';
assert(authorizationJob.length > 0, 'protected authorization workflow job is missing');
assert(!authorizationJob.includes('CLOUDFLARE_ACCOUNT_ID'), 'authorization job must not receive the Cloudflare account ID');
assert(!authorizationJob.includes('CLOUDFLARE_API_TOKEN'), 'authorization job must not receive the Cloudflare API token');
assert(!authorizationJob.includes('wrangler deploy'), 'authorization job must not deploy Cloudflare');
assert(!authorizationJob.includes('supabase db push'), 'authorization job must not mutate provider schema');

console.log('Gate C multi-account authorization guard passed: separate protected adult identities, one-time invitation and replay boundaries, revoked denial, ordinary-role-only membership administration, parent family scope, Director/System Administrator family denial, cross-organization isolation, session separation, sanitized evidence, exact synthetic cleanup, and explicit mail-slice deferral are structurally enforced without application or deployment changes.');
