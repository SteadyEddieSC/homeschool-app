import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

const reportPath = path.join(process.cwd(), 'hosted-auth-email-recovery-report.json');
const release = '11.0.0-rc.1';
const deployedRuntimeCommit = required('V11_DEPLOYED_APP_COMMIT');
const previewOrigin = new URL(required('V11_PREVIEW_URL')).origin;
const supabaseOrigin = new URL(required('VITE_SUPABASE_URL')).origin;
const mailtrapAccountId = requiredNumeric('PILOT_MAILTRAP_ACCOUNT_ID');
const mailtrapSandboxId = requiredNumeric('PILOT_MAILTRAP_SANDBOX_ID');
const mailtrapApiToken = required('PILOT_MAILTRAP_API_TOKEN');
const supabaseSecretKey = required('PILOT_SUPABASE_SECRET_KEY');

function required(name: string): string {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new Error(`${name} is required for the protected hosted Auth mail pilot`);
  return value;
}

function requiredNumeric(name: string): string {
  const value = required(name);
  if (!/^\d{1,20}$/.test(value)) throw new Error(`${name} must be a numeric provider identifier`);
  return value;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null;
  const status = Number((error as { status?: unknown }).status ?? 0);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}

function safeCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return 'test-assertion';
  const raw = String((error as { code?: unknown }).code ?? '').trim();
  return /^[A-Za-z0-9_-]{1,48}$/.test(raw) ? raw : 'provider-error';
}

function publicClient(): SupabaseClient {
  return createClient(required('VITE_SUPABASE_URL'), required('VITE_SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

function adminClient(): SupabaseClient {
  return createClient(required('VITE_SUPABASE_URL'), supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

type MailtrapMessage = {
  id?: number | string;
  to_email?: string;
  sent_at?: string;
  created_at?: string;
};

async function mailtrapFetch(pathname: string): Promise<Response> {
  const response = await fetch(`https://mailtrap.io${pathname}`, {
    headers: {
      'Api-Token': mailtrapApiToken,
      accept: 'application/json, text/html;q=0.9, text/plain;q=0.8'
    }
  });
  if (!response.ok) throw Object.assign(new Error('Mail sandbox API request failed safely'), { status: response.status, code: 'mailtrap_api' });
  return response;
}

async function verifySandboxReadAccess(): Promise<void> {
  const response = await mailtrapFetch(`/api/accounts/${mailtrapAccountId}/inboxes/${mailtrapSandboxId}`);
  const payload = await response.json() as { permissions?: { can_read?: boolean } };
  if (payload.permissions?.can_read !== true) throw new Error('Mail sandbox token does not have read access');
}

async function listSandboxMessages(): Promise<MailtrapMessage[]> {
  const response = await mailtrapFetch(`/api/accounts/${mailtrapAccountId}/inboxes/${mailtrapSandboxId}/messages`);
  const payload = await response.json() as unknown;
  if (Array.isArray(payload)) return payload as MailtrapMessage[];
  if (payload && typeof payload === 'object') {
    const candidate = payload as { messages?: unknown; data?: unknown };
    if (Array.isArray(candidate.messages)) return candidate.messages as MailtrapMessage[];
    if (Array.isArray(candidate.data)) return candidate.data as MailtrapMessage[];
  }
  throw new Error('Mail sandbox message list returned an unexpected shape');
}

function messageTimestamp(message: MailtrapMessage): number {
  const value = message.sent_at || message.created_at || '';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function waitForMessage(recipient: string, after: number, excluded: Set<string>, timeoutMs = 60_000): Promise<MailtrapMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const messages = await listSandboxMessages();
    const matches = messages
      .filter((message) => String(message.to_email ?? '').toLowerCase() === recipient.toLowerCase())
      .filter((message) => !excluded.has(String(message.id ?? '')))
      .filter((message) => messageTimestamp(message) >= after - 10_000)
      .sort((a, b) => messageTimestamp(b) - messageTimestamp(a));
    if (matches[0]?.id !== undefined) return matches[0];
    await delay(1_000);
  }
  throw new Error('Hosted Auth email was not captured in the sandbox before timeout');
}

async function messageHtml(message: MailtrapMessage): Promise<string> {
  const id = String(message.id ?? '');
  if (!/^\d+$/.test(id)) throw new Error('Mail sandbox message identifier was not numeric');
  const response = await mailtrapFetch(`/api/accounts/${mailtrapAccountId}/inboxes/${mailtrapSandboxId}/messages/${id}/body.html`);
  return response.text();
}

function decodeHtml(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&#38;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function verificationLink(html: string, expectedType: 'signup' | 'recovery'): URL {
  const href = html.match(/href=["']([^"']*\/auth\/v1\/verify\?[^"']+)["']/i)?.[1];
  const plain = html.match(/https?:\/\/[^\s<>"']+\/auth\/v1\/verify\?[^\s<>"']+/i)?.[0];
  const raw = href || plain;
  if (!raw) throw new Error('Sandboxed Auth email did not contain a verification link');
  const link = new URL(decodeHtml(raw));
  if (link.origin !== supabaseOrigin || link.pathname !== '/auth/v1/verify') throw new Error('Auth email verification link left the protected Supabase origin');
  const type = link.searchParams.get('type');
  const accepted = expectedType === 'signup' ? new Set(['signup', 'email']) : new Set(['recovery']);
  if (!type || !accepted.has(type)) throw new Error('Auth email verification link had an unexpected type');
  const redirect = link.searchParams.get('redirect_to');
  if (!redirect || new URL(redirect).origin !== previewOrigin) throw new Error('Auth email verification link did not return to the isolated preview origin');
  return link;
}

async function signOutIfPossible(page: Page): Promise<boolean> {
  const button = page.getByRole('button', { name: 'Sign out', exact: true });
  if (await button.count() === 0) return false;
  await button.click();
  await expect(page.getByTestId('account-access-panel')).toBeVisible();
  return true;
}

async function deleteSyntheticUser(admin: SupabaseClient, email: string): Promise<boolean> {
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) return false;
  const user = listed.data.users.find((candidate) => String(candidate.email ?? '').toLowerCase() === email.toLowerCase());
  if (!user) return true;
  const deletion = await admin.auth.admin.deleteUser(user.id);
  return !deletion.error;
}

const report = {
  schema: 'beaufort-learning-harbor-hosted-auth-email-recovery-v1',
  release,
  checkedAt: new Date().toISOString(),
  repositoryCommit: process.env.GITHUB_SHA || null,
  deployedRuntimeCommit,
  workflowRun: process.env.GITHUB_RUN_ID || null,
  state: 'running',
  coverage: {
    mailSandboxReadable: false,
    signupSubmittedThroughHostedUi: false,
    confirmationDeliveredThroughCustomSmtp: false,
    confirmationLinkBoundedToPreview: false,
    confirmationBrowserCallbackEstablishedSession: false,
    confirmedSessionSignedOut: false,
    recoverySubmittedThroughHostedUi: false,
    duplicateRecoveryRateLimited: false,
    recoveryDeliveredThroughCustomSmtp: false,
    recoveryLinkBoundedToPreview: false,
    recoveryBrowserCallbackEstablishedSession: false,
    passwordUpdatedThroughHostedUi: false,
    priorPasswordRejected: false,
    replacementPasswordSignIn: false,
    finalBrowserSignOut: false
  },
  rateLimit: {
    duplicateRecoveryStatus: null as number | null,
    duplicateRecoveryCode: null as string | null
  },
  cleanup: {
    syntheticAuthUserDeleted: false,
    sandboxMessagesProviderRetained: true,
    confirmationLinkConsumed: false,
    recoveryLinkConsumed: false
  },
  boundaries: {
    syntheticDataOnly: true,
    mailtrapSandboxOnly: true,
    customSmtpVerified: false,
    hostedProviderDeliveryVerified: false,
    realRecipientDeliveryVerified: false,
    mailBodiesPersisted: false,
    emailAddressesPersisted: false,
    passwordsPersisted: false,
    verificationLinksPersisted: false,
    authTokensPersisted: false,
    providerCredentialsPersisted: false,
    secretKeyExposedToBrowser: false,
    rawProviderResponsesPersisted: false,
    productionDataEnabled: false,
    realFamilyDataAuthorized: false,
    productionReady: false,
    productionCutoverApproved: false,
    automatedPromotionAllowed: false,
    fullGateCComplete: false
  },
  failure: null as null | { stage: string; code: string; status: number | null },
  completedAt: null as string | null
};

test('hosted custom-SMTP confirmation and recovery remain synthetic, bounded, and fail-closed', async ({ page }) => {
  const email = `rc2-hosted-mail-${Date.now()}-${randomBytes(4).toString('hex')}@example.test`;
  const initialPassword = `Hosted-${randomBytes(24).toString('base64url')}!Aa1`;
  const replacementPassword = `Changed-${randomBytes(24).toString('base64url')}!Bb2`;
  const admin = adminClient();
  const client = publicClient();
  const seenMessages = new Set<string>();
  let stage = 'sandbox-read-access';
  let primaryFailure: unknown = null;

  try {
    await verifySandboxReadAccess();
    report.coverage.mailSandboxReadable = true;

    stage = 'hosted-signup-ui';
    const signupStartedAt = Date.now();
    await page.goto('/');
    await expect(page.getByTestId('account-access-panel')).toBeVisible();
    await page.getByRole('tab', { name: 'Create account', exact: true }).click();
    await page.getByLabel('Display name').fill('Synthetic Hosted Mail Adult');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(initialPassword);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Check your email to confirm the address before signing in.');
    report.coverage.signupSubmittedThroughHostedUi = true;

    stage = 'confirmation-delivery';
    const confirmationMessage = await waitForMessage(email, signupStartedAt, seenMessages);
    seenMessages.add(String(confirmationMessage.id));
    const confirmation = verificationLink(await messageHtml(confirmationMessage), 'signup');
    report.coverage.confirmationDeliveredThroughCustomSmtp = true;
    report.coverage.confirmationLinkBoundedToPreview = true;

    stage = 'confirmation-browser-callback';
    await page.goto(confirmation.toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => url.origin === previewOrigin, { timeout: 30_000 });
    await expect(page.getByTestId('identity-bootstrap')).toBeVisible();
    report.coverage.confirmationBrowserCallbackEstablishedSession = true;
    report.cleanup.confirmationLinkConsumed = true;
    report.coverage.confirmedSessionSignedOut = await signOutIfPossible(page);
    if (!report.coverage.confirmedSessionSignedOut) throw new Error('Confirmed hosted session could not be signed out');

    stage = 'hosted-recovery-ui';
    const recoveryStartedAt = Date.now();
    await page.getByRole('tab', { name: 'Reset password', exact: true }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Send recovery email', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('If an account matches that address, a password recovery email has been sent.');
    report.coverage.recoverySubmittedThroughHostedUi = true;

    stage = 'hosted-recovery-rate-limit';
    const duplicate = await client.auth.resetPasswordForEmail(email, { redirectTo: previewOrigin });
    if (!duplicate.error) throw new Error('Immediate duplicate hosted recovery request was unexpectedly accepted');
    report.rateLimit.duplicateRecoveryStatus = safeStatus(duplicate.error);
    report.rateLimit.duplicateRecoveryCode = safeCode(duplicate.error);
    if (report.rateLimit.duplicateRecoveryStatus !== 429) throw new Error('Immediate duplicate hosted recovery request was not rate limited with HTTP 429');
    report.coverage.duplicateRecoveryRateLimited = true;

    stage = 'recovery-delivery';
    const recoveryMessage = await waitForMessage(email, recoveryStartedAt, seenMessages);
    seenMessages.add(String(recoveryMessage.id));
    const recovery = verificationLink(await messageHtml(recoveryMessage), 'recovery');
    report.coverage.recoveryDeliveredThroughCustomSmtp = true;
    report.coverage.recoveryLinkBoundedToPreview = true;

    stage = 'recovery-browser-callback';
    await page.goto(recovery.toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => url.origin === previewOrigin, { timeout: 30_000 });
    await expect(page.getByTestId('password-recovery-panel')).toBeVisible();
    report.coverage.recoveryBrowserCallbackEstablishedSession = true;
    report.cleanup.recoveryLinkConsumed = true;

    stage = 'hosted-password-update-ui';
    await page.getByLabel('New password').fill(replacementPassword);
    await page.getByLabel('Confirm new password').fill(replacementPassword);
    await page.getByRole('button', { name: 'Update password', exact: true }).click();
    await expect(page.getByText('Password updated. Sign in again with the new password.', { exact: true })).toBeVisible();
    report.coverage.passwordUpdatedThroughHostedUi = true;
    await page.getByRole('button', { name: 'Return to sign in', exact: true }).click();
    await expect(page.getByTestId('account-access-panel')).toBeVisible();

    stage = 'prior-password-rejection';
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(initialPassword);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    report.coverage.priorPasswordRejected = true;

    stage = 'replacement-password-signin';
    await page.getByLabel('Password').fill(replacementPassword);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByTestId('identity-bootstrap')).toBeVisible();
    report.coverage.replacementPasswordSignIn = true;
    report.coverage.finalBrowserSignOut = await signOutIfPossible(page);
    if (!report.coverage.finalBrowserSignOut) throw new Error('Replacement-password hosted session could not be signed out');

    report.boundaries.customSmtpVerified = true;
    report.boundaries.hostedProviderDeliveryVerified = true;
    report.state = 'passed';
    report.completedAt = new Date().toISOString();
  } catch (error) {
    primaryFailure = error;
    report.state = 'failed';
    report.failure = { stage, code: safeCode(error), status: safeStatus(error) };
    report.completedAt = new Date().toISOString();
  } finally {
    try {
      if (!report.coverage.finalBrowserSignOut) report.coverage.finalBrowserSignOut = await signOutIfPossible(page);
    } catch {
      report.coverage.finalBrowserSignOut = false;
    }
    report.cleanup.syntheticAuthUserDeleted = await deleteSyntheticUser(admin, email);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (primaryFailure) {
    throw new Error(`Hosted Auth mail pilot failed safely at ${report.failure?.stage ?? 'unknown'} (${report.failure?.code ?? 'test-assertion'})`);
  }
});
