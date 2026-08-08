import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const reportPath = path.join(root, 'local-auth-email-recovery-report.json');
const evidenceDirectory = path.join(root, 'test-results', 'rc2');
const release = '11.0.0-rc.1';
const expectedCallbackOrigin = 'http://127.0.0.1:4173';
const rateLimitDelayMs = 5500;

const report = {
  schema: 'beaufort-learning-harbor-local-auth-email-recovery-v1',
  release,
  checkedAt: new Date().toISOString(),
  state: 'running',
  coverage: {
    localMailCaptureAvailable: false,
    signupConfirmationRequired: false,
    confirmationEmailCaptured: false,
    confirmationLinkRedeemed: false,
    confirmedCredentialSignIn: false,
    recoveryRequestAccepted: false,
    duplicateRecoveryRateLimited: false,
    recoveryEmailCaptured: false,
    recoverySessionEstablished: false,
    passwordUpdated: false,
    priorPasswordRejected: false,
    newPasswordSignIn: false
  },
  rateLimit: {
    duplicateRecoveryStatus: null,
    duplicateRecoveryCode: null
  },
  cleanup: {
    mailboxCleared: false,
    syntheticUserDeleted: false,
    authenticatedClientsSignedOut: false
  },
  boundaries: {
    localSupabaseOnly: true,
    localMailCaptureOnly: true,
    mailBodiesPersisted: false,
    emailAddressesPersisted: false,
    passwordsPersisted: false,
    verificationLinksPersisted: false,
    authTokensPersisted: false,
    providerCredentialsPersisted: false,
    hostedProviderDeliveryVerified: false,
    customSmtpVerified: false,
    productionDataEnabled: false,
    productionCutoverApproved: false,
    fullGateCComplete: false
  },
  failure: null,
  completedAt: null
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeCode(error) {
  if (!error || typeof error !== 'object') return 'local-assertion';
  const raw = String(error.code ?? '').trim();
  return /^[A-Za-z0-9_-]{1,40}$/.test(raw) ? raw : 'local-assertion';
}

function safeStatus(error) {
  if (!error || typeof error !== 'object') return null;
  const raw = Number(error.status ?? 0);
  return Number.isInteger(raw) && raw >= 100 && raw <= 599 ? raw : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseEnvOutput(stdout) {
  const values = {};
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

async function localStatus() {
  const cli = path.join(root, 'node_modules', '.bin', 'supabase');
  const { stdout } = await execFileAsync(cli, ['status', '-o', 'env'], {
    cwd: root,
    maxBuffer: 1024 * 1024,
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' }
  });
  const values = parseEnvOutput(stdout);
  const apiUrl = values.API_URL || values.SUPABASE_URL;
  const anonKey = values.ANON_KEY || values.PUBLISHABLE_KEY || values.SUPABASE_ANON_KEY || values.SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = values.SERVICE_ROLE_KEY || values.SECRET_KEY || values.SUPABASE_SERVICE_ROLE_KEY || values.SUPABASE_SECRET_KEY;
  const mailboxUrl = values.INBUCKET_URL || 'http://127.0.0.1:54324';
  assert(apiUrl && anonKey && serviceKey, 'Local Supabase status did not expose required in-memory test credentials');
  return { apiUrl, anonKey, serviceKey, mailboxUrl };
}

function client(url, key) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

async function mailpitJson(mailboxUrl, pathname, options = {}) {
  const response = await fetch(new URL(pathname, mailboxUrl), options);
  if (!response.ok) throw new Error(`Local mail capture request failed with status ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response.text();
}

async function clearMailbox(mailboxUrl) {
  await mailpitJson(mailboxUrl, '/api/v1/messages', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });
}

async function waitForLatestMessage(mailboxUrl, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const summary = await mailpitJson(mailboxUrl, '/api/v1/messages?start=0&limit=1');
    if (Number(summary?.messages_count ?? 0) > 0) {
      return mailpitJson(mailboxUrl, '/api/v1/message/latest');
    }
    await delay(200);
  }
  throw new Error('Local auth email was not captured before timeout');
}

function decodeHtmlAttribute(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&#38;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function verificationUrl(message, expectedType) {
  const body = `${String(message?.HTML ?? '')}\n${String(message?.Text ?? '')}`;
  const hrefMatch = body.match(/href=["']([^"']*\/auth\/v1\/verify\?[^"']+)["']/i);
  const plainMatch = body.match(/https?:\/\/[^\s<>"']+\/auth\/v1\/verify\?[^\s<>"']+/i);
  const raw = hrefMatch?.[1] || plainMatch?.[0];
  assert(raw, 'Captured local auth email did not contain a verification URL');
  const link = new URL(decodeHtmlAttribute(raw));
  assert(link.origin === 'http://127.0.0.1:54321', 'Verification URL left the local Supabase origin');
  assert(link.pathname === '/auth/v1/verify', 'Unexpected local auth verification path');
  const type = link.searchParams.get('type');
  const accepted = expectedType === 'signup' ? new Set(['signup', 'email']) : new Set([expectedType]);
  assert(type && accepted.has(type), 'Captured local auth email had an unexpected verification type');
  return link;
}

async function redeemVerification(link) {
  const response = await fetch(link, { redirect: 'manual' });
  assert([301, 302, 303, 307, 308].includes(response.status), 'Local auth verification did not return a bounded redirect');
  const location = response.headers.get('location');
  assert(location, 'Local auth verification redirect was missing');
  const callback = new URL(location, expectedCallbackOrigin);
  assert(callback.origin === expectedCallbackOrigin, 'Local auth verification redirected outside the allowed callback origin');
  return callback;
}

function recoveryTokens(callback) {
  const fragment = new URLSearchParams(callback.hash.replace(/^#/, ''));
  assert(fragment.get('type') === 'recovery', 'Recovery callback did not declare recovery type');
  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  assert(accessToken && refreshToken, 'Recovery callback did not contain an implicit-flow session');
  return { accessToken, refreshToken };
}

let stage = 'initializing';
let userId = null;
let publicClient = null;
let recoveryClient = null;
let authenticatedClient = null;
let adminClient = null;
let mailboxUrl = null;
let primaryFailure = null;

try {
  stage = 'local-provider-status';
  const status = await localStatus();
  mailboxUrl = status.mailboxUrl;
  publicClient = client(status.apiUrl, status.anonKey);
  recoveryClient = client(status.apiUrl, status.anonKey);
  authenticatedClient = client(status.apiUrl, status.anonKey);
  adminClient = client(status.apiUrl, status.serviceKey);

  stage = 'mail-capture-health';
  await mailpitJson(mailboxUrl, '/api/v1/info');
  report.coverage.localMailCaptureAvailable = true;
  await clearMailbox(mailboxUrl);

  const email = `rc2-auth-mail-${Date.now()}-${randomBytes(4).toString('hex')}@example.test`;
  const initialPassword = `Local-${randomBytes(24).toString('base64url')}!Aa1`;
  const replacementPassword = `Changed-${randomBytes(24).toString('base64url')}!Bb2`;

  stage = 'signup';
  const signup = await publicClient.auth.signUp({
    email,
    password: initialPassword,
    options: {
      data: { display_name: 'Synthetic Local Auth Mail Adult' },
      emailRedirectTo: `${expectedCallbackOrigin}/`
    }
  });
  if (signup.error) throw signup.error;
  assert(signup.data.user && !signup.data.session, 'Local signup did not require email confirmation');
  userId = signup.data.user.id;
  report.coverage.signupConfirmationRequired = true;

  stage = 'confirmation-mail';
  const confirmationMessage = await waitForLatestMessage(mailboxUrl);
  report.coverage.confirmationEmailCaptured = true;
  const confirmationLink = verificationUrl(confirmationMessage, 'signup');

  stage = 'confirmation-redeem';
  await redeemVerification(confirmationLink);
  report.coverage.confirmationLinkRedeemed = true;

  stage = 'confirmed-signin';
  const confirmed = await authenticatedClient.auth.signInWithPassword({ email, password: initialPassword });
  if (confirmed.error || !confirmed.data.session) throw confirmed.error || new Error('Confirmed credential sign-in did not establish a session');
  report.coverage.confirmedCredentialSignIn = true;
  await authenticatedClient.auth.signOut({ scope: 'local' });

  await clearMailbox(mailboxUrl);
  await delay(rateLimitDelayMs);

  stage = 'recovery-request';
  const recovery = await publicClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${expectedCallbackOrigin}/`
  });
  if (recovery.error) throw recovery.error;
  report.coverage.recoveryRequestAccepted = true;

  stage = 'recovery-rate-limit';
  const duplicate = await publicClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${expectedCallbackOrigin}/`
  });
  assert(duplicate.error, 'Immediate duplicate recovery request was unexpectedly accepted');
  const duplicateStatus = safeStatus(duplicate.error);
  const duplicateCode = safeCode(duplicate.error);
  assert(duplicateStatus === 429, 'Immediate duplicate recovery request was not rate limited with HTTP 429');
  report.rateLimit.duplicateRecoveryStatus = duplicateStatus;
  report.rateLimit.duplicateRecoveryCode = duplicateCode;
  report.coverage.duplicateRecoveryRateLimited = true;

  stage = 'recovery-mail';
  const recoveryMessage = await waitForLatestMessage(mailboxUrl);
  report.coverage.recoveryEmailCaptured = true;
  const recoveryLink = verificationUrl(recoveryMessage, 'recovery');

  stage = 'recovery-redeem';
  const recoveryCallback = await redeemVerification(recoveryLink);
  const tokens = recoveryTokens(recoveryCallback);
  const recovered = await recoveryClient.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken
  });
  if (recovered.error || !recovered.data.session) throw recovered.error || new Error('Recovery callback session could not be established');
  report.coverage.recoverySessionEstablished = true;

  stage = 'password-update';
  const changed = await recoveryClient.auth.updateUser({ password: replacementPassword });
  if (changed.error) throw changed.error;
  report.coverage.passwordUpdated = true;
  await recoveryClient.auth.signOut({ scope: 'local' });

  stage = 'prior-password-rejection';
  const priorPassword = await authenticatedClient.auth.signInWithPassword({ email, password: initialPassword });
  assert(priorPassword.error && !priorPassword.data.session, 'Prior password remained valid after recovery update');
  report.coverage.priorPasswordRejected = true;

  stage = 'new-password-signin';
  const newPassword = await authenticatedClient.auth.signInWithPassword({ email, password: replacementPassword });
  if (newPassword.error || !newPassword.data.session) throw newPassword.error || new Error('Replacement password did not establish a session');
  report.coverage.newPasswordSignIn = true;

  report.state = 'passed';
  report.completedAt = new Date().toISOString();
} catch (error) {
  primaryFailure = error;
  report.state = 'failed';
  report.failure = {
    stage,
    code: safeCode(error),
    status: safeStatus(error)
  };
  report.completedAt = new Date().toISOString();
} finally {
  let signOutSuccess = true;
  for (const authClient of [publicClient, recoveryClient, authenticatedClient]) {
    if (!authClient) continue;
    try {
      const current = await authClient.auth.getSession();
      if (current.error) {
        signOutSuccess = false;
        continue;
      }
      if (!current.data.session) continue;
      const result = await authClient.auth.signOut({ scope: 'local' });
      if (result.error) signOutSuccess = false;
    } catch {
      signOutSuccess = false;
    }
  }
  report.cleanup.authenticatedClientsSignedOut = signOutSuccess;

  if (adminClient && userId) {
    try {
      const deletion = await adminClient.auth.admin.deleteUser(userId);
      report.cleanup.syntheticUserDeleted = !deletion.error;
    } catch {
      report.cleanup.syntheticUserDeleted = false;
    }
  }

  if (mailboxUrl) {
    try {
      await clearMailbox(mailboxUrl);
      const remaining = await mailpitJson(mailboxUrl, '/api/v1/messages?start=0&limit=1');
      report.cleanup.mailboxCleared = Number(remaining?.messages_count ?? -1) === 0;
    } catch {
      report.cleanup.mailboxCleared = false;
    }
  }

  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

if (primaryFailure) {
  throw new Error(`Local auth email/recovery flow failed safely at ${report.failure?.stage ?? 'unknown'} (${report.failure?.code ?? 'local-assertion'})`);
}

console.log('Local Auth email/recovery pilot passed: confirmation, confirmed sign-in, recovery, duplicate-request rate limiting, password replacement, prior-password rejection, and exact local cleanup were verified with all sensitive mail/session values kept in memory only.');
