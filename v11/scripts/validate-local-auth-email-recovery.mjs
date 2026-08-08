import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const inputPath = path.join(root, 'local-auth-email-recovery-report.json');
const outputDirectory = path.join(root, 'test-results', 'rc2');
const outputPath = path.join(outputDirectory, 'rc2-local-auth-email-recovery-evidence.json');

function fail(message) {
  throw new Error(`Local auth email/recovery evidence validation failed: ${message}`);
}

function requireTrue(value, label) {
  if (value !== true) fail(`${label} is not evidenced true`);
}

function requireFalse(value, label) {
  if (value !== false) fail(`${label} is not evidenced false`);
}

const report = JSON.parse(await readFile(inputPath, 'utf8'));
if (report.schema !== 'beaufort-learning-harbor-local-auth-email-recovery-v1') fail('unexpected report schema');
if (report.release !== '11.0.0-rc.1') fail('unexpected release');
if (report.state !== 'passed') fail('local auth email/recovery slice did not pass');
if (report.failure !== null) fail('passing report unexpectedly contains failure metadata');

for (const key of [
  'localMailCaptureAvailable',
  'signupConfirmationRequired',
  'confirmationEmailCaptured',
  'confirmationLinkRedeemed',
  'confirmedCredentialSignIn',
  'recoveryRequestAccepted',
  'duplicateRecoveryRateLimited',
  'recoveryEmailCaptured',
  'recoverySessionEstablished',
  'passwordUpdated',
  'priorPasswordRejected',
  'newPasswordSignIn'
]) requireTrue(report.coverage?.[key], `coverage.${key}`);

if (report.rateLimit?.duplicateRecoveryStatus !== 429) fail('duplicate recovery was not evidenced as HTTP 429');
if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(report.rateLimit?.duplicateRecoveryCode ?? ''))) fail('duplicate recovery safe code is missing or unsafe');

for (const key of ['mailboxCleared', 'syntheticUserDeleted', 'authenticatedClientsSignedOut']) {
  requireTrue(report.cleanup?.[key], `cleanup.${key}`);
}

requireTrue(report.boundaries?.localSupabaseOnly, 'boundaries.localSupabaseOnly');
requireTrue(report.boundaries?.localMailCaptureOnly, 'boundaries.localMailCaptureOnly');
for (const key of [
  'mailBodiesPersisted',
  'emailAddressesPersisted',
  'passwordsPersisted',
  'verificationLinksPersisted',
  'authTokensPersisted',
  'providerCredentialsPersisted',
  'hostedProviderDeliveryVerified',
  'customSmtpVerified',
  'productionDataEnabled',
  'productionCutoverApproved',
  'fullGateCComplete'
]) requireFalse(report.boundaries?.[key], `boundaries.${key}`);

const serialized = JSON.stringify(report);
if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized)) fail('evidence contains an email address');
if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(serialized)) fail('evidence contains a UUID');
if (/eyJ[A-Za-z0-9_-]{20,}\./.test(serialized)) fail('evidence contains a JWT-shaped value');
if (/\b(access_token|refresh_token|token_hash|verification_url|confirmation_url)\b/i.test(serialized)) fail('evidence contains an auth-link/token label');
if (/service[_-]?role|sb_secret_|supabase_service|smtp_pass|password\s*[:=]/i.test(serialized)) fail('evidence contains protected credential material');
if (/\/auth\/v1\/verify\?/i.test(serialized)) fail('evidence contains a verification URL');

const evidence = {
  schema: 'beaufort-learning-harbor-rc2-local-auth-email-recovery-evidence-v1',
  release: report.release,
  checkedAt: report.checkedAt,
  completedAt: report.completedAt,
  state: 'local-auth-confirmation-recovery-and-rate-limit-complete-hosted-mail-delivery-incomplete',
  coverage: report.coverage,
  rateLimit: report.rateLimit,
  cleanup: report.cleanup,
  boundaries: report.boundaries,
  exclusions: [
    'email addresses and passwords',
    'email bodies, subjects, recipients, and sender details',
    'confirmation and recovery URLs or tokens',
    'sessions, JWTs, refresh tokens, and provider credentials',
    'user identifiers and raw provider responses'
  ]
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log('Local Auth email/recovery evidence validated: confirmation, recovery, safe duplicate-request rate limiting, credential replacement, and exact cleanup are evidenced while hosted SMTP delivery remains explicitly incomplete.');
