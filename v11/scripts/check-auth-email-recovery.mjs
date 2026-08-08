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
  "import '../signin-access.css';",
  'Check your email to confirm the address before signing in.',
  'If an account matches that address, a password recovery email has been sent.',
  'minLength={mode === \'sign-up\' ? 12 : undefined}',
  'className="segmented-control"',
  "aria-selected={mode === 'sign-in'}"
]) assert(signInPanel.includes(marker), `sign-in recovery contract is missing ${marker}`);

const signInStyles = await readFile(path.join(root, 'src/signin-access.css'), 'utf8');
for (const marker of [
  'min-height: 100dvh',
  'width: min(520px, 100%)',
  '.segmented-control {',
  '.segmented-control button.active',
  "button[aria-selected='true']",
  '.signin-card .button.primary',
  '@media (max-height: 820px) and (min-width: 681px)'
]) assert(signInStyles.includes(marker), `scoped account-access styling is missing ${marker}`);
assert(!signInStyles.includes('position: fixed'), 'account-access styling must not solve viewport fit with a fixed-position card');

const signInLayoutTest = await readFile(path.join(root, 'tests/signin-access-layout.spec.ts'), 'utf8');
for (const marker of [
  'width: 900, height: 800',
  'document.documentElement.scrollHeight <= window.innerHeight',
  "expect(segmentedDisplay).toBe('grid')",
  'expect(activeBackground).not.toBe(inactiveBackground)'
]) assert(signInLayoutTest.includes(marker), `account-access browser regression is missing ${marker}`);

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
  'report.deployedRuntimeCommit !== report.repositoryCommit',
  'report.repositoryCommit !== process.env.GITHUB_SHA',
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
assert(!hostedValidator.includes('138a33fe7703ce0c9729392f26f42d90bdb022df'), 'hosted mail validator must not remain pinned to a stale deployed commit');

const worker = await readFile(path.join(root, 'worker/index.ts'), 'utf8');
for (const marker of ['APP_COMMIT?: string', 'commit: env.APP_COMMIT ?? null']) {
  assert(worker.includes(marker), `preview Worker exact-head marker is missing ${marker}`);
}

const validationWorkflow = await readFile(path.join(repositoryRoot, '.github/workflows/validate-v11.yml'), 'utf8');
for (const marker of [
  'Run local Auth confirmation, recovery, and rate-limit pilot',
  'npm run pilot:test-local-auth-email-recovery',
  'npm run pilot:validate-local-auth-email-recovery',
  'rc2-local-auth-email-recovery-evidence.json',
  '.github/workflows/run-v11-hosted-pilot.yml'
]) assert(validationWorkflow.includes(marker), `v11 validation workflow is missing ${marker}`);
assert(!validationWorkflow.includes('run-v11-hosted-mail-pilot.yml'), 'ordinary CI must not reference a branch-only hidden hosted-mail workflow');

const deployWorkflow = await readFile(path.join(repositoryRoot, '.github/workflows/deploy-v11-preview.yml'), 'utf8');
for (const marker of [
  'Stamp exact Git commit into generated Cloudflare deployment config',
  ".wrangler/deploy/config.json",
  "relative.startsWith('../') || !relative.startsWith('dist/')",
  'config.vars.APP_COMMIT = sha',
  'Verify deployed health and exact-head boundary',
  'for (let attempt = 1; attempt <= 24; attempt += 1)',
  "health?.commit === expectedCommit",
  'await sleep(2500)',
  'did not converge to the exact workflow head within 60 seconds'
]) assert(deployWorkflow.includes(marker), `protected preview deployment exact-head proof is missing ${marker}`);
assert(!deployWorkflow.includes("curl --fail --silent --show-error --retry 12 --retry-all-errors --retry-delay 5 --connect-timeout 10 --max-time 20 \"${DEPLOYED_PREVIEW_URL%/}/api/health\""), 'exact-head verification must not use a one-shot successful HTTP response as convergence proof');

const hostedWorkflow = await readFile(path.join(repositoryRoot, '.github/workflows/run-v11-hosted-pilot.yml'), 'utf8');
for (const marker of [
  'name: Run v11 Hosted Pilot',
  'RUN_V11_SYNTHETIC_PILOT',
  'hosted-auth-email-recovery:',
  'needs: hosted-multi-account-authorization',
  'environment: v11-preview',
  'PILOT_SUPABASE_SECRET_KEY: ${{ secrets.PILOT_SUPABASE_SECRET_KEY }}',
  'PILOT_MAILTRAP_API_TOKEN: ${{ secrets.PILOT_MAILTRAP_API_TOKEN }}',
  'PILOT_MAILTRAP_ACCOUNT_ID: ${{ vars.PILOT_MAILTRAP_ACCOUNT_ID }}',
  'PILOT_MAILTRAP_SANDBOX_ID: ${{ vars.PILOT_MAILTRAP_SANDBOX_ID }}',
  'V11_DEPLOYED_APP_COMMIT: ${{ github.sha }}',
  'Verify preview serves the exact workflow head',
  "health.commit !== process.env.GITHUB_SHA",
  'npx playwright test hosted-tests/hosted-auth-email-recovery.spec.ts --config=playwright.hosted.config.ts',
  'node scripts/validate-hosted-auth-email-recovery.mjs',
  'rc2-hosted-auth-email-recovery-evidence.json'
]) assert(hostedWorkflow.includes(marker), `visible protected hosted pilot workflow is missing ${marker}`);
for (const forbidden of ['SMTP_PASSWORD', 'SMTP_USERNAME', 'MAILTRAP_SMTP_PASSWORD', 'MAILTRAP_SMTP_USERNAME']) {
  assert(!hostedWorkflow.includes(forbidden), `protected hosted pilot workflow must not copy provider SMTP credentials: ${forbidden}`);
}

const hostedRunbook = await readFile(path.join(repositoryRoot, 'docs/v11/rc2-hosted-mail-pilot.md'), 'utf8');
for (const marker of [
  'Run v11 Hosted Pilot',
  'RUN_V11_SYNTHETIC_PILOT',
  'sandboxMessagesProviderRetained: true',
  'Real-recipient delivery',
  'Gate C remains incomplete',
  'Gate D remains blocked',
  'v10.43 remains the stable production/downloadable fallback'
]) assert(hostedRunbook.includes(marker), `hosted Auth mail runbook is missing ${marker}`);

console.log('Gate C Auth mail/recovery guard passed: compact themed account access, viewport regression coverage, exact-head generated Cloudflare deployment stamping with propagation-aware convergence, local capture/recovery, and the protected hosted custom-SMTP sandbox job are structurally enforced through the visible hosted-pilot workflow; sensitive values remain excluded from persisted evidence and full Gate C/Gate D remain blocked.');
