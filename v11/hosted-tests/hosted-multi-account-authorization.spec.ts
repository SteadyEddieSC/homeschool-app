import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const reportPath = path.join(process.cwd(), 'hosted-multi-account-authorization-report.json');
const release = '11.0.0-rc.1';
const syntheticSlugPrefix = 'rc2-authz-';

type CredentialNames = {
  email: string;
  password: string;
};

type SessionActor = {
  client: SupabaseClient;
  user: User;
};

type Invitation = {
  id: string;
  token: string;
};

function required(name: string): string {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new Error(`${name} is required for the protected multi-account authorization pilot`);
  return value;
}

function safeProviderCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return 'unknown';
  const raw = String((error as { code?: unknown }).code ?? '').trim();
  return /^[A-Za-z0-9_-]{1,40}$/.test(raw) ? raw : 'unknown';
}

function providerFailure(label: string, error: unknown): never {
  throw new Error(`${label} failed with safe provider code ${safeProviderCode(error)}`);
}

function credentials(names: CredentialNames): { email: string; password: string } {
  return { email: required(names.email), password: required(names.password) };
}

function protectedClient(): SupabaseClient {
  return createClient(required('VITE_SUPABASE_URL'), required('VITE_SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

async function signInClient(names: CredentialNames, label: string): Promise<SessionActor> {
  const client = protectedClient();
  const result = await client.auth.signInWithPassword(credentials(names));
  if (result.error || !result.data.session?.user) providerFailure(`${label} authentication`, result.error);
  return { client, user: result.data.session.user };
}

async function countRows(client: SupabaseClient, table: string, filters: Record<string, string> = {}): Promise<number> {
  let query = client.from(table).select('id', { count: 'exact', head: true });
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const result = await query;
  if (result.error) providerFailure(`${table} count`, result.error);
  return result.count ?? 0;
}

async function deleteOwnedSyntheticOrganizations(actor: SessionActor): Promise<number> {
  const listed = await actor.client.from('organizations').select('id, slug, created_by');
  if (listed.error) providerFailure('synthetic organization preflight', listed.error);
  let deleted = 0;
  for (const row of listed.data ?? []) {
    const slug = String(row.slug ?? '');
    if (!slug.startsWith(syntheticSlugPrefix)) {
      throw new Error('Protected synthetic identity belongs to a non-synthetic organization; authorization pilot stopped without modifying it');
    }
    if (String(row.created_by ?? '') !== actor.user.id) continue;
    const removal = await actor.client.from('organizations').delete().eq('id', row.id);
    if (removal.error) providerFailure('synthetic organization preflight cleanup', removal.error);
    deleted += 1;
  }
  return deleted;
}

async function assertNoVisibleOrganizations(actor: SessionActor, label: string): Promise<void> {
  const count = await countRows(actor.client, 'organizations');
  if (count !== 0) throw new Error(`${label} still has a visible organization after bounded preflight cleanup`);
}

async function signInBrowser(page: Page, names: CredentialNames, expected: 'bootstrap' | 'app-shell'): Promise<void> {
  const login = credentials(names);
  await page.goto('/');
  await expect(page.getByTestId('account-access-panel')).toBeVisible();
  await page.getByLabel('Email').fill(login.email);
  await page.getByLabel('Password').fill(login.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByTestId(expected === 'bootstrap' ? 'identity-bootstrap' : 'app-shell')).toBeVisible();
}

async function createContext(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: required('V11_PREVIEW_URL') });
  return { context, page: await context.newPage() };
}

async function assertBrowserRole(page: Page, roleLabel: string): Promise<void> {
  await expect(page.locator('.identity-label').getByText(roleLabel, { exact: true })).toBeVisible();
}

async function assertMembershipWorkspaceDenied(page: Page): Promise<void> {
  await expect(page.getByTestId('nav-members')).toHaveCount(0);
  await page.goto('/#/members');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('members-workspace')).toHaveCount(0);
  await expect(page.getByTestId('nav-members')).toHaveCount(0);
}

async function signOutBrowser(page: Page): Promise<boolean> {
  const button = page.getByRole('button', { name: 'Sign out', exact: true });
  if (await button.count() === 0) return false;
  await button.click();
  await expect(page.getByTestId('account-access-panel')).toBeVisible();
  return true;
}

async function bootstrapOrganizationBrowser(page: Page): Promise<string> {
  const suffix = `${String(process.env.GITHUB_RUN_ID ?? Date.now())}-${Math.random().toString(16).slice(2, 10)}`;
  const slug = `${syntheticSlugPrefix}primary-${suffix}`.slice(0, 63);
  await page.getByTestId('organization-name').fill('Synthetic RC2 Authorization Group');
  await page.getByTestId('organization-slug').fill(slug);
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await assertBrowserRole(page, 'Group Administrator');
  return slug;
}

async function organizationIdBySlug(client: SupabaseClient, slug: string): Promise<string> {
  const result = await client.from('organizations').select('id').eq('slug', slug).maybeSingle();
  if (result.error) providerFailure('organization lookup', result.error);
  if (!result.data?.id) throw new Error('Synthetic authorization organization was not visible to its Group Administrator');
  return String(result.data.id);
}

async function createInvitation(client: SupabaseClient, organizationId: string, role: 'parent' | 'director'): Promise<Invitation> {
  const result = await client.rpc('create_organization_invite', {
    target_organization: organizationId,
    target_role: role,
    expires_in_hours: 24
  });
  if (result.error) providerFailure(`${role} invitation creation`, result.error);
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!row?.id || !row?.invite_token) throw new Error(`${role} invitation did not return the required one-time values`);
  return { id: String(row.id), token: String(row.invite_token) };
}

async function expectRpcDenied(client: SupabaseClient, name: string, args: Record<string, unknown>, label: string): Promise<string> {
  const result = await client.rpc(name, args);
  if (!result.error) throw new Error(`${label} was unexpectedly allowed`);
  return safeProviderCode(result.error);
}

async function redeemInvitationBrowser(page: Page, token: string): Promise<void> {
  await page.getByRole('tab', { name: 'Use invitation code', exact: true }).click();
  await page.getByTestId('redeem-invite-code').fill(token);
  await page.getByRole('button', { name: 'Join organization', exact: true }).click();
  await expect(page.getByTestId('app-shell')).toBeVisible();
}

async function expectInvitationDeniedBrowser(page: Page, token: string): Promise<void> {
  await page.getByRole('tab', { name: 'Use invitation code', exact: true }).click();
  await page.getByTestId('redeem-invite-code').fill(token);
  await page.getByRole('button', { name: 'Join organization', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('identity-bootstrap')).toBeVisible();
}

async function createHouseholdAndLearner(actor: SessionActor, organizationId: string, suffix: string): Promise<{ householdId: string; learnerId: string }> {
  const householdId = randomUUID();
  const learnerId = randomUUID();
  const householdWrite = await actor.client.from('households').insert({
    id: householdId,
    organization_id: organizationId,
    name: `Synthetic ${suffix} Household`,
    created_by: actor.user.id,
    client_operation_id: randomUUID()
  });
  if (householdWrite.error) providerFailure(`${suffix} household creation`, householdWrite.error);

  const learnerWrite = await actor.client.from('learners').insert({
    id: learnerId,
    organization_id: organizationId,
    household_id: householdId,
    preferred_name: `Synthetic ${suffix} Learner`,
    pronouns: 'they/them',
    grade_band: '4-6',
    avatar_key: 'heron',
    access_mode: 'parent-assisted',
    status: 'active',
    client_operation_id: randomUUID()
  });
  if (learnerWrite.error) providerFailure(`${suffix} learner creation`, learnerWrite.error);
  return { householdId, learnerId };
}

const report = {
  schema: 'beaufort-learning-harbor-hosted-multi-account-authorization-v1',
  release,
  checkedAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || null,
  workflowRun: process.env.GITHUB_RUN_ID || null,
  state: 'running',
  coverage: {
    separateDisposableAdultSessions: false,
    groupAdministratorBrowserSignIn: false,
    allowedInvitationCreation: false,
    systemAdministratorExcludedFromInvitationUi: false,
    systemAdministratorInvitationDenied: false,
    revokedInvitationDenied: false,
    parentInvitationRedeemed: false,
    invitationReplayDenied: false,
    parentMembershipAdministrationDenied: false,
    parentHouseholdCreationAllowed: false,
    parentLearnerCreationAllowed: false,
    parentCrossHouseholdLearnerDenied: false,
    directorInvitationRedeemed: false,
    directorMembershipAdministrationDenied: false,
    directorHouseholdReadDenied: false,
    directorLearnerReadDenied: false,
    directorHouseholdCreateDenied: false,
    crossOrganizationVisibilityDenied: false,
    allowedGroupAdministratorFamilyVisibility: false,
    browserSessionSeparationPreserved: false
  },
  counts: {
    ordinaryInvitationRolesVisible: 0,
    parentVisibleHouseholdsBeforeGroupChange: 0,
    parentVisibleLearnersBeforeGroupChange: 0,
    directorVisibleHouseholds: -1,
    directorVisibleLearners: -1,
    groupAdministratorVisibleLearnersPrimaryGroup: 0,
    parentVisibleLearnersSecondGroup: 0
  },
  denialCodes: {
    systemAdministratorInvitation: null as string | null,
    revokedInvitation: 'browser-visible-denial',
    replay: null as string | null,
    parentMembershipAdministration: null as string | null,
    directorMembershipAdministration: null as string | null,
    directorHouseholdCreate: null as string | null
  },
  cleanup: {
    primaryOrganizationDeleted: false,
    secondOrganizationDeleted: false,
    groupAdministratorBrowserSignedOut: false,
    parentBrowserSignedOut: false,
    directorBrowserSignedOut: false,
    groupAdministratorClientSignedOut: false,
    parentClientSignedOut: false,
    directorClientSignedOut: false
  },
  deferred: {
    emailConfirmationDelivery: true,
    passwordRecoveryDelivery: true,
    reason: 'separate-provider-mail-slice'
  },
  boundaries: {
    syntheticDataOnly: true,
    invitationCodesPersisted: false,
    emailAddressesPersisted: false,
    rawProviderRowsPersisted: false,
    realFamilyDataAuthorized: false,
    liveMigrationEnabled: false,
    productionDataEnabled: false,
    productionReady: false,
    productionCutoverApproved: false,
    automatedPromotionAllowed: false,
    fullGateCComplete: false
  },
  completedAt: null as string | null
};

test('hosted multi-account invitation redemption and browser authorization stay fail-closed', async ({ browser }) => {
  const adminNames = { email: 'PILOT_TEST_EMAIL', password: 'PILOT_TEST_PASSWORD' } as const;
  const parentNames = { email: 'PILOT_PARENT_EMAIL', password: 'PILOT_PARENT_PASSWORD' } as const;
  const directorNames = { email: 'PILOT_DIRECTOR_EMAIL', password: 'PILOT_DIRECTOR_PASSWORD' } as const;

  const distinctEmails = new Set([required(adminNames.email), required(parentNames.email), required(directorNames.email)]);
  if (distinctEmails.size !== 3) throw new Error('Protected multi-account pilot requires three distinct disposable adult identities');

  const admin = await signInClient(adminNames, 'Group Administrator');
  const parent = await signInClient(parentNames, 'Parent');
  const director = await signInClient(directorNames, 'Director');
  report.coverage.separateDisposableAdultSessions = true;

  let adminBrowser: Awaited<ReturnType<typeof createContext>> | null = null;
  let parentBrowser: Awaited<ReturnType<typeof createContext>> | null = null;
  let directorBrowser: Awaited<ReturnType<typeof createContext>> | null = null;
  let primaryOrganizationId: string | null = null;
  let secondOrganizationId: string | null = null;
  let primaryAdminLearnerId: string | null = null;
  let primaryParentLearnerId: string | null = null;
  let primaryFailure: unknown = null;

  try {
    await deleteOwnedSyntheticOrganizations(parent);
    await deleteOwnedSyntheticOrganizations(admin);
    await assertNoVisibleOrganizations(admin, 'Group Administrator');
    await assertNoVisibleOrganizations(parent, 'Parent');
    await assertNoVisibleOrganizations(director, 'Director');

    adminBrowser = await createContext(browser);
    parentBrowser = await createContext(browser);
    directorBrowser = await createContext(browser);

    await signInBrowser(adminBrowser.page, adminNames, 'bootstrap');
    report.coverage.groupAdministratorBrowserSignIn = true;
    const primarySlug = await bootstrapOrganizationBrowser(adminBrowser.page);
    primaryOrganizationId = await organizationIdBySlug(admin.client, primarySlug);

    const adminFamily = await createHouseholdAndLearner(admin, primaryOrganizationId, 'Administrator');
    primaryAdminLearnerId = adminFamily.learnerId;

    await adminBrowser.page.getByTestId('nav-members').click();
    await expect(adminBrowser.page.getByTestId('members-workspace')).toBeVisible();
    const invitationRoleValues = await adminBrowser.page.getByTestId('invite-role').locator('option').evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value)
    );
    report.counts.ordinaryInvitationRolesVisible = invitationRoleValues.length;
    if (invitationRoleValues.includes('system-admin')) throw new Error('System Administrator appeared in the ordinary invitation role selector');
    if (invitationRoleValues.length !== 5) throw new Error('Ordinary invitation role selector did not contain the expected bounded role set');
    report.coverage.systemAdministratorExcludedFromInvitationUi = true;

    await adminBrowser.page.getByTestId('invite-role').selectOption('parent');
    await adminBrowser.page.getByTestId('create-invite').click();
    await expect(adminBrowser.page.getByTestId('one-time-invite')).toBeVisible();
    const parentToken = String(await adminBrowser.page.getByTestId('one-time-invite').locator('code').textContent()).trim();
    if (parentToken.length < 32) throw new Error('Parent invitation did not produce a bounded one-time code');
    report.coverage.allowedInvitationCreation = true;

    report.denialCodes.systemAdministratorInvitation = await expectRpcDenied(
      admin.client,
      'create_organization_invite',
      { target_organization: primaryOrganizationId, target_role: 'system-admin', expires_in_hours: 24 },
      'System Administrator invitation'
    );
    report.coverage.systemAdministratorInvitationDenied = true;

    const revokedDirectorInvite = await createInvitation(admin.client, primaryOrganizationId, 'director');
    const revoked = await admin.client.rpc('revoke_organization_invite', {
      target_organization: primaryOrganizationId,
      target_invitation: revokedDirectorInvite.id
    });
    if (revoked.error) providerFailure('Director invitation revocation', revoked.error);

    await signInBrowser(parentBrowser.page, parentNames, 'bootstrap');
    await redeemInvitationBrowser(parentBrowser.page, parentToken);
    await assertBrowserRole(parentBrowser.page, 'Parent / Guardian');
    report.coverage.parentInvitationRedeemed = true;
    await assertMembershipWorkspaceDenied(parentBrowser.page);
    report.coverage.parentMembershipAdministrationDenied = true;
    report.denialCodes.parentMembershipAdministration = await expectRpcDenied(
      parent.client,
      'create_organization_invite',
      { target_organization: primaryOrganizationId, target_role: 'teacher', expires_in_hours: 24 },
      'Parent membership administration'
    );

    report.denialCodes.replay = await expectRpcDenied(
      parent.client,
      'redeem_organization_invite',
      { invite_token: parentToken },
      'Invitation replay'
    );
    report.coverage.invitationReplayDenied = true;

    const parentFamily = await createHouseholdAndLearner(parent, primaryOrganizationId, 'Parent');
    primaryParentLearnerId = parentFamily.learnerId;
    report.coverage.parentHouseholdCreationAllowed = true;
    report.coverage.parentLearnerCreationAllowed = true;
    report.counts.parentVisibleHouseholdsBeforeGroupChange = await countRows(parent.client, 'households', { organization_id: primaryOrganizationId });
    report.counts.parentVisibleLearnersBeforeGroupChange = await countRows(parent.client, 'learners', { organization_id: primaryOrganizationId });
    if (report.counts.parentVisibleHouseholdsBeforeGroupChange !== 1 || report.counts.parentVisibleLearnersBeforeGroupChange !== 1) {
      throw new Error('Parent did not see exactly its explicitly related household and learner');
    }
    if (await countRows(parent.client, 'learners', { id: primaryAdminLearnerId }) !== 0) {
      throw new Error('Parent could read an unrelated household learner');
    }
    report.coverage.parentCrossHouseholdLearnerDenied = true;

    await signInBrowser(directorBrowser.page, directorNames, 'bootstrap');
    await expectInvitationDeniedBrowser(directorBrowser.page, revokedDirectorInvite.token);
    report.coverage.revokedInvitationDenied = true;

    const directorInvite = await createInvitation(admin.client, primaryOrganizationId, 'director');
    await redeemInvitationBrowser(directorBrowser.page, directorInvite.token);
    await assertBrowserRole(directorBrowser.page, 'Director');
    report.coverage.directorInvitationRedeemed = true;
    await assertMembershipWorkspaceDenied(directorBrowser.page);
    report.coverage.directorMembershipAdministrationDenied = true;
    report.denialCodes.directorMembershipAdministration = await expectRpcDenied(
      director.client,
      'create_organization_invite',
      { target_organization: primaryOrganizationId, target_role: 'teacher', expires_in_hours: 24 },
      'Director membership administration'
    );

    report.counts.directorVisibleHouseholds = await countRows(director.client, 'households', { organization_id: primaryOrganizationId });
    report.counts.directorVisibleLearners = await countRows(director.client, 'learners', { organization_id: primaryOrganizationId });
    if (report.counts.directorVisibleHouseholds !== 0 || report.counts.directorVisibleLearners !== 0) {
      throw new Error('Director received household or learner visibility from organization membership alone');
    }
    report.coverage.directorHouseholdReadDenied = true;
    report.coverage.directorLearnerReadDenied = true;

    const directorHouseholdAttempt = await director.client.from('households').insert({
      id: randomUUID(),
      organization_id: primaryOrganizationId,
      name: 'Synthetic Director Denied Household',
      created_by: director.user.id,
      client_operation_id: randomUUID()
    });
    if (!directorHouseholdAttempt.error) throw new Error('Director household creation was unexpectedly allowed');
    report.denialCodes.directorHouseholdCreate = safeProviderCode(directorHouseholdAttempt.error);
    report.coverage.directorHouseholdCreateDenied = true;

    report.counts.groupAdministratorVisibleLearnersPrimaryGroup = await countRows(admin.client, 'learners', { organization_id: primaryOrganizationId });
    if (report.counts.groupAdministratorVisibleLearnersPrimaryGroup !== 2) {
      throw new Error('Group Administrator did not retain the expected explicitly authorized family visibility');
    }
    report.coverage.allowedGroupAdministratorFamilyVisibility = true;

    await assertBrowserRole(adminBrowser.page, 'Group Administrator');
    await assertBrowserRole(parentBrowser.page, 'Parent / Guardian');
    await assertBrowserRole(directorBrowser.page, 'Director');
    report.coverage.browserSessionSeparationPreserved = true;

    report.cleanup.parentBrowserSignedOut = await signOutBrowser(parentBrowser.page);

    const leaveParent = await admin.client
      .from('organization_memberships')
      .update({ status: 'left' })
      .eq('organization_id', primaryOrganizationId)
      .eq('user_id', parent.user.id);
    if (leaveParent.error) providerFailure('Parent membership boundary transition', leaveParent.error);

    const secondSlug = `${syntheticSlugPrefix}second-${String(process.env.GITHUB_RUN_ID ?? Date.now())}-${Math.random().toString(16).slice(2, 8)}`.slice(0, 63);
    const secondBootstrap = await parent.client.rpc('bootstrap_organization', {
      requested_name: 'Synthetic RC2 Separate Organization',
      requested_slug: secondSlug
    });
    if (secondBootstrap.error) providerFailure('Second organization bootstrap', secondBootstrap.error);
    const secondRow = Array.isArray(secondBootstrap.data) ? secondBootstrap.data[0] : secondBootstrap.data;
    if (!secondRow?.organization_id) throw new Error('Second synthetic organization bootstrap did not return an organization');
    secondOrganizationId = String(secondRow.organization_id);
    await createHouseholdAndLearner(parent, secondOrganizationId, 'Separate Group');

    if (await countRows(admin.client, 'organizations', { id: secondOrganizationId }) !== 0) {
      throw new Error('Primary Group Administrator could see an unrelated organization');
    }
    if (await countRows(parent.client, 'organizations', { id: primaryOrganizationId }) !== 0) {
      throw new Error('Second Group Administrator could see the prior organization after leaving it');
    }
    if (await countRows(admin.client, 'learners', { organization_id: secondOrganizationId }) !== 0) {
      throw new Error('Primary Group Administrator could read a learner from an unrelated organization');
    }
    // Household membership is intentionally separate from organization role membership.
    // The Parent may retain its own prior household relationship, but must not gain
    // visibility into an unrelated learner merely because it now administers another group.
    if (primaryAdminLearnerId && await countRows(parent.client, 'learners', { id: primaryAdminLearnerId }) !== 0) {
      throw new Error('Second Group Administrator could read an unrelated learner in the prior organization');
    }
    report.counts.parentVisibleLearnersSecondGroup = await countRows(parent.client, 'learners', { organization_id: secondOrganizationId });
    if (report.counts.parentVisibleLearnersSecondGroup !== 1) throw new Error('Second organization Group Administrator could not see its own synthetic learner');
    report.coverage.crossOrganizationVisibilityDenied = true;

    report.state = 'passed';
    report.completedAt = new Date().toISOString();
  } catch (error) {
    primaryFailure = error;
    report.state = 'failed';
    report.completedAt = new Date().toISOString();
  } finally {
    if (adminBrowser?.page) {
      try { report.cleanup.groupAdministratorBrowserSignedOut = await signOutBrowser(adminBrowser.page); } catch { /* bounded cleanup continues */ }
    }
    if (parentBrowser?.page && !report.cleanup.parentBrowserSignedOut) {
      try { report.cleanup.parentBrowserSignedOut = await signOutBrowser(parentBrowser.page); } catch { /* bounded cleanup continues */ }
    }
    if (directorBrowser?.page) {
      try { report.cleanup.directorBrowserSignedOut = await signOutBrowser(directorBrowser.page); } catch { /* bounded cleanup continues */ }
    }

    if (secondOrganizationId) {
      try {
        const removal = await parent.client.from('organizations').delete().eq('id', secondOrganizationId);
        if (!removal.error && await countRows(parent.client, 'organizations', { id: secondOrganizationId }) === 0) report.cleanup.secondOrganizationDeleted = true;
      } catch { /* evidence records cleanup failure */ }
    }
    if (primaryOrganizationId) {
      try {
        const removal = await admin.client.from('organizations').delete().eq('id', primaryOrganizationId);
        if (!removal.error && await countRows(admin.client, 'organizations', { id: primaryOrganizationId }) === 0) report.cleanup.primaryOrganizationDeleted = true;
      } catch { /* evidence records cleanup failure */ }
    }

    try { const result = await admin.client.auth.signOut({ scope: 'local' }); report.cleanup.groupAdministratorClientSignedOut = !result.error; } catch { /* evidence records cleanup failure */ }
    try { const result = await parent.client.auth.signOut({ scope: 'local' }); report.cleanup.parentClientSignedOut = !result.error; } catch { /* evidence records cleanup failure */ }
    try { const result = await director.client.auth.signOut({ scope: 'local' }); report.cleanup.directorClientSignedOut = !result.error; } catch { /* evidence records cleanup failure */ }

    try { await adminBrowser?.context.close(); } catch { /* no-op */ }
    try { await parentBrowser?.context.close(); } catch { /* no-op */ }
    try { await directorBrowser?.context.close(); } catch { /* no-op */ }

    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (primaryFailure) throw primaryFailure;
});
