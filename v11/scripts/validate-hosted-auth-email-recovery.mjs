import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const inputPath = path.join(root, 'hosted-auth-email-recovery-report.json');
const outputDirectory = path.join(root, 'test-results', 'rc2');
const outputPath = path.join(outputDirectory, 'rc2-hosted-auth-email-recovery-evidence.json');

function fail(message) {
  throw new Error(`Hosted auth email/recovery evidence validation failed: ${message}`);
}

function requireTrue(value, label) {
  if (value !== true) fail(`${label} is not evidenced true`);
}

function requireFalse(value, label) {
  if (value !== false) fail(`${label} is not evidenced false`);
}

function requireCommit(value, label) {
  if (!/^[0-9a-f]{40}$/i.test(String(value ?? ''))) fail(`${label} is not an exact Git commit`);
}

const report = JSON.parse(await readFile(inputPath, 'utf8'));
if (report.schema !== 'beaufort-learning-harbor-hosted-auth-email-recovery-v1') fail('unexpected report schema');
if (report.release !== '11.0.0-rc.1') fail('unexpected release');
if (report.state !== 'passed') fail('hosted auth email/recovery slice did not pass');
if (report.failure !== null) fail('passing report unexpectedly contains failure metadata');

requireCommit(report.repositoryCommit, 'repositoryCommit');
requireCommit(report.deployedRuntimeCommit, 'deployedRuntimeCommit');
if (report.deployedRuntimeCommit !== report.repositoryCommit) fail('hosted mail evidence was not collected against the same exact commit as the workflow source');
if (process.env.GITHUB_SHA && report.repositoryCommit !== process.env.GITHUB_SHA) fail('report repository commit does not match the exact workflow head');
if (!/^\d+$/.test(String(report.workflowRun ?? ''))) fail('workflowRun is not a bounded workflow identifier');

for (const key of [
  'mailSandboxReadable',
  'signupSubmittedThroughHostedUi',
  'confirmationDeliveredThroughCustomSmtp',
  'confirmationLinkBoundedToPreview',
  'confirmationBrowserCallbackEstablishedSession',
  'confirmedSessionSignedOut',
  'recoverySubmittedThroughHostedUi',
  'duplicateRecoveryRateLimited',
  'recoveryDeliveredThroughCustomSmtp',
  'recoveryLinkBoundedToPreview',
  'recoveryBrowserCallbackEstablishedSession',
  'passwordUpdatedThroughHostedUi',
  'priorPasswordRejected',
  'replacementPasswordSignIn',
  'finalBrowserSignOut'
]) requireTrue(report.coverage?.[key], `coverage.${key}`);

if (report.rateLimit?.duplicateRecoveryStatus !== 429) fail('duplicate recovery was not evidenced as HTTP 429');
if (!/^[A-Za-z0-9_-]{1,48}$/.test(String(report.rateLimit?.duplicateRecoveryCode ?? ''))) fail('duplicate recovery safe code is missing or unsafe');

for (const key of [
  'syntheticAuthUserDeleted',
  'sandboxMessagesProviderRetained',
  'confirmationLinkConsumed',
  'recoveryLinkConsumed'
]) requireTrue(report.cleanup?.[key], `cleanup.${key}`);

for (const key of [
  'syntheticDataOnly',
  'mailtrapSandboxOnly',
  'customSmtpVerified',
  'hostedProviderDeliveryVerified'
]) requireTrue(report.boundaries?.[key], `boundaries.${key}`);

for (const key of [
  'realRecipientDeliveryVerified',
  'mailBodiesPersisted',
  'emailAddressesPersisted',
  'passwordsPersisted',
  'verificationLinksPersisted',
  'authTokensPersisted',
  'providerCredentialsPersisted',
  'secretKeyExposedToBrowser',
  'rawProviderResponsesPersisted',
  'productionDataEnabled',
  'realFamilyDataAuthorized',
  'productionReady',
  'productionCutoverApproved',
  'automatedPromotionAllowed',
  'fullGateCComplete'
]) requireFalse(report.boundaries?.[key], `boundaries.${key}`);

const serialized = JSON.stringify(report);
if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized)) fail('evidence contains an email address');
if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(serialized)) fail('evidence contains a UUID');
if (/eyJ[A-Za-z0-9_-]{20,}\./.test(serialized)) fail('evidence contains a JWT-shaped value');
if (/\/auth\/v1\/verify\?/i.test(serialized)) fail('evidence contains a verification URL');
if (/\bsb_secret_[A-Za-z0-9_-]+\b|\bservice[_-]?role\b/i.test(serialized)) fail('evidence contains privileged Supabase credential material');
if (/\bApi-Token\b\s*[:=]\s*["']?[A-Za-z0-9_-]{8,}/i.test(serialized)) fail('evidence contains Mailtrap credential material');
if (/"(?:password|access_token|refresh_token|token_hash|verification_url|confirmation_url|api_token|secret_key)"\s*:\s*"[^\"]+"/i.test(serialized)) fail('evidence contains a sensitive value');
if (/"(?:mailtrapAccountId|mailtrapSandboxId|recipient|email)"\s*:/i.test(serialized)) fail('evidence contains a provider identifier or recipient field');

const evidence = {
  schema: 'beaufort-learning-harbor-rc2-hosted-auth-email-recovery-evidence-v1',
  release: report.release,
  checkedAt: report.checkedAt,
  completedAt: report.completedAt,
  repositoryCommit: report.repositoryCommit,
  deployedRuntimeCommit: report.deployedRuntimeCommit,
  workflowRun: report.workflowRun,
  state: 'hosted-custom-smtp-confirmation-recovery-complete-real-recipient-delivery-not-tested',
  coverage: report.coverage,
  rateLimit: report.rateLimit,
  cleanup: report.cleanup,
  boundaries: report.boundaries,
  exclusions: [
    'email addresses and passwords',
    'mail subjects, bodies, recipient details, and sender details',
    'confirmation and recovery URLs or tokens',
    'sessions, JWTs, refresh tokens, and provider credentials',
    'Mailtrap account and sandbox identifiers',
    'Supabase user identifiers and raw provider responses',
    'real-recipient delivery; this evidence is sandbox-only'
  ]
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log('Hosted Auth email/recovery evidence validated: exact-head preview identity, custom-SMTP sandbox delivery, hosted confirmation/recovery callbacks, password replacement, duplicate-request rate limiting, and synthetic-user cleanup are evidenced without persisting private mail or credential material; real-recipient delivery and full Gate C remain explicitly incomplete.');
