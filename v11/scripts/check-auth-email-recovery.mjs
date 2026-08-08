import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const repositoryRoot = path.resolve(root, '..');

function assert(condition, message) {
  if (!condition) throw new Error(`Auth email/recovery guard failed: ${message}`);
}

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
assert(pkg.scripts?.['check:auth-email-recovery'] === 'node scripts/check-auth-email-recovery.mjs', 'repository guard is not wired exactly');
assert(pkg.scripts?.['pilot:test-local-auth-email-recovery'] === 'node scripts/run-local-auth-email-recovery.mjs', 'local Auth email test is not wired exactly');
assert(pkg.scripts?.['pilot:validate-local-auth-email-recovery'] === 'node scripts/validate-local-auth-email-recovery.mjs', 'local Auth evidence validator is not wired exactly');
assert(String(pkg.scripts?.verify ?? '').includes('npm run check:auth-email-recovery'), 'npm run verify must include the Auth email/recovery guard');

const config = await readFile(path.join(root, 'supabase/config.toml'), 'utf8');
for (const marker of [
  '[inbucket]',
  'enabled = true',
  '[auth.email]',
  'enable_confirmations = true',
  'max_frequency = "5s"',
  'minimum_password_length = 12'
]) assert(config.includes(marker), `local Supabase Auth test config is missing ${marker}`);

const cloudIdentity = await readFile(path.join(root, 'src/lib/use-cloud-identity.ts'), 'utf8');
for (const marker of [
  'supabase.auth.signUp',
  'emailRedirectTo: window.location.origin',
  "event === 'PASSWORD_RECOVERY'",
  'supabase.auth.resetPasswordForEmail',
  'redirectTo: window.location.origin',
  'supabase.auth.updateUser({ password })',
  'supabase.auth.signInWithPassword'
]) assert(cloudIdentity.includes(marker), `cloud Auth contract is missing ${marker}`);
assert(!cloudIdentity.includes('/#/welcome') && !cloudIdentity.includes('/#/recover'), 'Auth callbacks must not compete with implicit-flow URL fragments');

const signInPanel = await readFile(path.join(root, 'src/components/SignInPanel.tsx'), 'utf8');
for (const marker of [
  'Check your email to confirm the address before signing in.',
  'If an account matches that address, a password recovery email has been sent.',
  'minLength={mode === \'sign-up\' ? 12 : undefined}'
]) assert(signInPanel.includes(marker), `sign-in recovery contract is missing ${marker}`);

const passwordPanel = await readFile(path.join(root, 'src/components/PasswordUpdatePanel.tsx'), 'utf8');
for (const marker of [
  'Use at least 12 characters for the new password.',
  'The password confirmation does not match.',
  'Password updated. Sign in again with the new password.'
]) assert(passwordPanel.includes(marker), `password recovery UI contract is missing ${marker}`);

const localFlow = await readFile(path.join(root, 'scripts/run-local-auth-email-recovery.mjs'), 'utf8');
for (const marker of [
  '/api/v1/message/latest',
  'signupConfirmationRequired',
  'duplicateRecoveryRateLimited',
  'duplicateStatus === 429',
  'recoverySessionEstablished',
  'priorPasswordRejected',
  'syntheticUserDeleted',
  'mailBodiesPersisted: false',
  'hostedProviderDeliveryVerified: false',
  'fullGateCComplete: false'
]) assert(localFlow.includes(marker), `local Auth mail test is missing ${marker}`);
assert(!localFlow.includes('console.log(email') && !localFlow.includes('console.log(message') && !localFlow.includes('console.log(tokens'), 'local Auth mail test must never log sensitive values');

const localValidator = await readFile(path.join(root, 'scripts/validate-local-auth-email-recovery.mjs'), 'utf8');
for (const marker of [
  'local-auth-confirmation-recovery-and-rate-limit-complete-hosted-mail-delivery-incomplete',
  'evidence contains an email address',
  'evidence contains a JWT-shaped value',
  'evidence contains a verification URL',
  'hostedProviderDeliveryVerified',
  'customSmtpVerified',
  'fullGateCComplete'
]) assert(localValidator.includes(marker), `local Auth evidence validator is missing ${marker}`);

const hostedFlow = await readFile(path.join(root, 'hosted-tests/hosted-auth-email-recovery.spec.ts'), 'utf8');
for (const marker of [
  '/messages/${id}/body.html',
  'confirmationDeliveredThroughCustomSmtp',
  'duplicateRecoveryRateLimited',
  'password-recovery-panel',
  'syntheticAuthUserDeleted',
  'sandboxMessagesProviderRetained: true',
  'realRecipientDeliveryVerified: false',
  'mailBodiesPersisted: false',
  'providerCredentialsPersisted: false',
  'secretKeyExposedToBrowser: false',
  'fullGateCComplete: false'
]) assert(hostedFlow.includes(marker), `hosted Auth mail test is missing ${marker}`);
assert(!hostedFlow.includes('console.log(email') && !hostedFlow.includes('console.log(html') && !hostedFlow.includes('console.log(mailtrapApiToken') && !hostedFlow.includes('console.log(supabaseSecretKey'), 'hosted Auth mail test must never log protected mail or credential values');

const hostedValidator = await readFile(path.join(root, 'scripts/validate-hosted-auth-email-recovery.mjs'), 'utf8');
for (const marker of [
  'hosted-custom-smtp-confirmation-recovery-complete-real-recipient-delivery-not-tested',
  'evidence contains an email address',
  'evidence contains a UUID',
  'evidence contains a JWT-shaped value',
  'evidence contains a verification URL',
  'evidence contains privileged Supabase credential material',
  'evidence contains Mailtrap credential material',
  'sandboxMessagesProviderRetained',
  'realRecipientDeliveryVerified',
  'fullGateCComplete'
]) assert(hostedValidator.includes(marker), `hosted Auth evidence validator is missing ${marker}`);

const validationWorkflow = await readFile(path.join(repositoryRoot, '.github/workflows/validate-v11.yml'), 'utf8');
for (const marker of [
  'Run local Auth confirmation, recovery, and rate-limit pilot',
  'npm run pilot:test-local-auth-email-recovery',
  'npm run pilot:validate-local-auth-email-recovery',
  'rc2-local-auth-email-recovery-evidence.json',
  '.github/workflows/run-v11-hosted-mail-pilot.yml'
]) assert(validationWorkflow.includes(marker), `v11 validation workflow is missing ${marker}`);

const hostedWorkflow = await readFile(path.join(repositoryRoot, '.github/workflows/run-v11-hosted-mail-pilot.yml'), 'utf8');
for (const marker of [
  'RUN_V11_HOSTED_MAIL_PILOT',
  'environment: v11-preview',
  'PILOT_SUPABASE_SECRET_KEY: ${{ secrets.PILOT_SUPABASE_SECRET_KEY }}',
  'PILOT_MAILTRAP_API_TOKEN: ${{ secrets.PILOT_MAILTRAP_API_TOKEN }}',
  'PILOT_MAILTRAP_ACCOUNT_ID: ${{ vars.PILOT_MAILTRAP_ACCOUNT_ID }}',
  'PILOT_MAILTRAP_SANDBOX_ID: ${{ vars.PILOT_MAILTRAP_SANDBOX_ID }}',
  'V11_DEPLOYED_APP_COMMIT: 138a33fe7703ce0c9729392f26f42d90bdb022df',
  'git diff --quiet "${V11_DEPLOYED_APP_COMMIT}..${GITHUB_SHA}"',
  'npx playwright test hosted-tests/hosted-auth-email-recovery.spec.ts --config=playwright.hosted.config.ts',
  'node scripts/validate-hosted-auth-email-recovery.mjs',
  'rc2-hosted-auth-email-recovery-evidence.json'
]) assert(hostedWorkflow.includes(marker), `protected hosted Auth mail workflow is missing ${marker}`);
for (const forbidden of ['SMTP_PASSWORD', 'SMTP_USERNAME', 'MAILTRAP_SMTP_PASSWORD', 'MAILTRAP_SMTP_USERNAME']) {
  assert(!hostedWorkflow.includes(forbidden), `protected hosted Auth mail workflow must not copy provider SMTP credentials: ${forbidden}`);
}

const hostedRunbook = await readFile(path.join(repositoryRoot, 'docs/v11/rc2-hosted-mail-pilot.md'), 'utf8');
for (const marker of [
  'sandboxMessagesProviderRetained: true',
  'real-recipient delivery',
  'Gate C remains incomplete',
  'Gate D remains blocked',
  'v10.43 remains the stable production/downloadable fallback'
]) assert(hostedRunbook.includes(marker), `hosted Auth mail runbook is missing ${marker}`);

console.log('Gate C Auth mail/recovery guard passed: local capture/recovery and protected hosted custom-SMTP sandbox contracts are structurally enforced, implicit-flow callbacks remain safe, sensitive values remain excluded from persisted evidence, and hosted execution stays manual with full Gate C and Gate D blocked.');
