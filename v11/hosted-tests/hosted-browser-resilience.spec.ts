import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page, type Route } from '@playwright/test';

const reportPath = path.join(process.cwd(), 'hosted-browser-resilience-report.json');
const release = '11.0.0-rc.1';
const syntheticSlugPrefix = 'rc2-browser-';
const queueStorageKey = 'beaufortLearningHarbor.v11.beta2.syncQueue';
const studioStorageKey = 'beaufortLearningHarbor.v11.beta3.studio';

function required(name: string): string {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new Error(`${name} is required for the protected hosted browser pilot`);
  return value;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function createProtectedClient(): SupabaseClient {
  return createClient(required('VITE_SUPABASE_URL'), required('VITE_SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

async function signInClient(client: SupabaseClient): Promise<void> {
  const result = await client.auth.signInWithPassword({
    email: required('PILOT_TEST_EMAIL'),
    password: required('PILOT_TEST_PASSWORD')
  });
  if (result.error || !result.data.session) throw new Error('Protected observer could not authenticate');
}

async function deleteSyntheticOrganizations(client: SupabaseClient): Promise<number> {
  const listed = await client.from('organizations').select('id, slug');
  if (listed.error) throw listed.error;
  let deleted = 0;
  for (const organization of listed.data ?? []) {
    if (!String(organization.slug).startsWith(syntheticSlugPrefix)) {
      throw new Error('Protected verifier belongs to a non-synthetic organization; browser pilot stopped without modifying it');
    }
    const removal = await client.from('organizations').delete().eq('id', organization.id);
    if (removal.error) throw removal.error;
    deleted += 1;
  }
  return deleted;
}

async function openDestination(page: Page, label: string): Promise<void> {
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await navigation.getByRole('button', { name: new RegExp(label) }).click();
}

async function signInBrowser(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('account-access-panel')).toBeVisible();
  await page.getByLabel('Email').fill(required('PILOT_TEST_EMAIL'));
  await page.getByLabel('Password').fill(required('PILOT_TEST_PASSWORD'));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByTestId('identity-bootstrap')).toBeVisible();
}

async function createOrganization(page: Page): Promise<void> {
  const suffix = `${String(process.env.GITHUB_RUN_ID ?? Date.now())}-${Math.random().toString(16).slice(2, 10)}`;
  await page.getByTestId('organization-name').fill('Synthetic RC2 Browser Organization');
  await page.getByTestId('organization-slug').fill(`${syntheticSlugPrefix}${suffix}`.slice(0, 63));
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('runtime-mode')).toHaveText('Cloud connected');
}

async function createHouseholdAndLearnerOffline(page: Page): Promise<void> {
  await openDestination(page, 'Learners');
  await page.getByTestId('household-name').fill('Synthetic Browser Household');
  await page.getByTestId('create-household').click();
  await expect(page.getByText('Synthetic Browser Household was created.')).toBeVisible();

  await page.getByTestId('household-name').fill('Synthetic Browser Household');
  await page.getByTestId('create-household').click();
  await expect(page.getByRole('alert')).toContainText('already waiting to synchronize');

  await page.getByTestId('learner-name').fill('Synthetic Browser Learner');
  await page.getByTestId('learner-pronouns').fill('they/them');
  await page.getByTestId('learner-grade').selectOption('4-6');
  await page.getByTestId('learner-avatar').selectOption('heron');
  await page.getByTestId('create-learner').click();
  await expect(page.getByText('Synthetic Browser Learner was added without an email account.')).toBeVisible();
}

async function assign(page: Page, title: string, type: 'learn' | 'practice' | 'quiz' | 'proof'): Promise<void> {
  await openDestination(page, 'Today');
  await page.getByTestId('assignment-title').fill(title);
  await page.getByTestId('assignment-type').selectOption(type);
  await page.getByTestId('create-assignment').click();
  await expect(page.getByText(/was assigned to Synthetic Browser Learner/)).toBeVisible();
}

async function createKnowledgeCheckOffline(page: Page): Promise<void> {
  await openDestination(page, 'Plan');
  await page.getByTestId('check-title').fill('Synthetic Browser Check');
  await page.getByTestId('question-type-0').selectOption('true-false');
  await page.getByTestId('question-prompt-0').fill('The hosted browser queue preserves operation order.');
  await page.getByTestId('question-correct-0').selectOption('0');
  await page.getByTestId('create-check').click();
  await expect(page.getByText('Knowledge check attached')).toBeVisible();
}

type QueueMetadata = Array<{ id: string; kind: string; status: string; attempts: number; title: string }>;

async function queueMetadata(page: Page): Promise<QueueMetadata> {
  return page.evaluate((storageKey) => {
    const state = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as {
      operations?: Array<{ id: string; kind: string; status: string; attempts: number; payload?: { title?: string } }>;
    };
    return (state.operations ?? []).map((operation) => ({
      id: operation.id,
      kind: operation.kind,
      status: operation.status,
      attempts: operation.attempts,
      title: String(operation.payload?.title ?? '')
    }));
  }, queueStorageKey);
}

async function exactCount(client: SupabaseClient, table: string, organizationId: string): Promise<number> {
  const result = await client.from(table).select('*', { count: 'exact', head: true }).eq('organization_id', organizationId);
  if (result.error) throw result.error;
  return result.count ?? 0;
}

const report = {
  schema: 'beaufort-learning-harbor-hosted-browser-resilience-v1',
  release,
  checkedAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || null,
  workflowRun: process.env.GITHUB_RUN_ID || null,
  state: 'running',
  coverage: {
    cloudBrowserSignIn: false,
    organizationBootstrap: false,
    offlineQueueVisible: false,
    activeDuplicateDenied: false,
    cancellationPreventedHostedWrite: false,
    firstWriteFailureVisible: false,
    explicitRetryCompleted: false,
    orderedReconnect: false,
    duplicateHostedRecordsPrevented: false,
    conflictVisible: false,
    silentOverwritePrevented: false,
    conflictAcknowledged: false,
    diagnosticsSanitized: false
  },
  counts: {
    activeOperations: 0,
    cancelledOperations: 0,
    hostedHouseholds: 0,
    hostedLearners: 0,
    hostedTodayItems: 0,
    hostedKnowledgeChecks: 0,
    openConflictsBeforeAcknowledgement: 0
  },
  attempts: {
    firstOperation: 0,
    subsequentOperations: [] as number[]
  },
  diagnosticsDigest: null as string | null,
  cleanup: {
    syntheticOrganizationDeleted: false,
    browserSignedOut: false,
    observerSignedOut: false
  },
  boundaries: {
    syntheticDataOnly: true,
    realFamilyDataAuthorized: false,
    liveMigrationEnabled: false,
    productionDataEnabled: false,
    productionReady: false,
    productionCutoverApproved: false,
    automatedPromotionAllowed: false
  }
};

test('hosted browser queue retries in order and surfaces conflicts without leaking diagnostics', async ({ page, context }) => {
  const preflight = createProtectedClient();
  let observer: SupabaseClient | null = null;
  let organizationId: string | null = null;
  let primaryFailure: unknown = null;

  try {
    await signInClient(preflight);
    await deleteSyntheticOrganizations(preflight);
    await preflight.auth.signOut({ scope: 'local' });

    await signInBrowser(page);
    report.coverage.cloudBrowserSignIn = true;
    await createOrganization(page);
    report.coverage.organizationBootstrap = true;

    observer = createProtectedClient();
    await signInClient(observer);
    const organizations = await observer.from('organizations').select('id, slug');
    if (organizations.error) throw organizations.error;
    expect(organizations.data).toHaveLength(1);
    expect(String(organizations.data?.[0]?.slug)).toMatch(/^rc2-browser-/);
    organizationId = String(organizations.data?.[0]?.id);

    await context.setOffline(true);
    await page.waitForFunction(() => navigator.onLine === false);
    await createHouseholdAndLearnerOffline(page);
    report.coverage.activeDuplicateDenied = true;
    await assign(page, 'Synthetic Hosted Queue Quiz', 'quiz');
    await assign(page, 'Synthetic Cancelled Queue Item', 'learn');
    await createKnowledgeCheckOffline(page);

    await openDestination(page, 'Sync');
    await expect(page.getByTestId('sync-pending-count')).toHaveText('5');
    report.coverage.offlineQueueVisible = true;

    const beforeCancel = await queueMetadata(page);
    const cancelled = beforeCancel.find((operation) => operation.kind === 'create-today-item' && operation.title === 'Synthetic Cancelled Queue Item');
    expect(cancelled).toBeTruthy();
    await page.getByTestId(`cancel-operation-${cancelled!.id}`).click();
    await expect(page.getByTestId('sync-pending-count')).toHaveText('4');

    let failedHouseholdWrite = false;
    const householdPattern = '**/rest/v1/households*';
    const failFirstHouseholdWrite = async (route: Route) => {
      const request = route.request();
      if (!failedHouseholdWrite && request.method() !== 'GET' && request.method() !== 'HEAD') {
        failedHouseholdWrite = true;
        await route.abort('internetdisconnected');
        return;
      }
      await route.continue();
    };
    await context.route(householdPattern, failFirstHouseholdWrite);
    await context.setOffline(false);
    await page.waitForFunction(() => navigator.onLine === true);
    await expect(page.getByTestId('sync-failed-count')).toHaveText('1', { timeout: 20_000 });
    report.coverage.firstWriteFailureVisible = true;

    await context.unroute(householdPattern, failFirstHouseholdWrite);
    const failedQueue = await queueMetadata(page);
    const householdOperation = failedQueue.find((operation) => operation.kind === 'create-household');
    expect(householdOperation?.status).toBe('failed');
    await page.getByTestId(`sync-operation-${householdOperation!.id}`).getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByTestId('sync-failed-count')).toHaveText('0', { timeout: 30_000 });
    await expect(page.getByTestId('sync-pending-count')).toHaveText('0', { timeout: 30_000 });
    await expect(page.getByTestId('sync-indicator')).toHaveText('Synced');
    report.coverage.explicitRetryCompleted = true;

    const completedQueue = await queueMetadata(page);
    const active = completedQueue.filter((operation) => operation.status !== 'cancelled');
    const cancelledOperations = completedQueue.filter((operation) => operation.status === 'cancelled');
    expect(active.map((operation) => operation.kind)).toEqual([
      'create-household',
      'create-learner',
      'create-today-item',
      'create-knowledge-check'
    ]);
    expect(active.every((operation) => operation.status === 'completed')).toBe(true);
    expect(active[0]?.attempts).toBe(2);
    expect(active.slice(1).every((operation) => operation.attempts === 1)).toBe(true);
    expect(cancelledOperations).toHaveLength(1);
    expect(cancelledOperations[0]?.attempts).toBe(0);
    report.coverage.orderedReconnect = true;
    report.counts.activeOperations = active.length;
    report.counts.cancelledOperations = cancelledOperations.length;
    report.attempts.firstOperation = active[0]?.attempts ?? 0;
    report.attempts.subsequentOperations = active.slice(1).map((operation) => operation.attempts);

    report.counts.hostedHouseholds = await exactCount(observer, 'households', organizationId);
    report.counts.hostedLearners = await exactCount(observer, 'learners', organizationId);
    report.counts.hostedTodayItems = await exactCount(observer, 'learner_today_items', organizationId);
    report.counts.hostedKnowledgeChecks = await exactCount(observer, 'knowledge_checks', organizationId);
    expect(report.counts).toMatchObject({ hostedHouseholds: 1, hostedLearners: 1, hostedTodayItems: 1, hostedKnowledgeChecks: 1 });
    const cancelledRemote = await observer
      .from('learner_today_items')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('title', 'Synthetic Cancelled Queue Item');
    if (cancelledRemote.error) throw cancelledRemote.error;
    expect(cancelledRemote.count ?? 0).toBe(0);
    report.coverage.cancellationPreventedHostedWrite = true;
    report.coverage.duplicateHostedRecordsPrevented = true;

    await page.evaluate((storageKey) => {
      const state = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as { knowledgeChecks?: Array<{ title: string }> };
      if (!state.knowledgeChecks?.[0]) throw new Error('Synthetic local knowledge check was not found');
      state.knowledgeChecks[0].title = 'Synthetic Local Divergence';
      localStorage.setItem(storageKey, JSON.stringify(state));
    }, studioStorageKey);
    await openDestination(page, 'Today');
    await openDestination(page, 'Plan');
    await openDestination(page, 'Sync');
    await expect(page.getByTestId('pilot-conflict-count')).toHaveText('1', { timeout: 20_000 });
    report.coverage.conflictVisible = true;
    report.counts.openConflictsBeforeAcknowledgement = 1;

    const retainedLocalTitle = await page.evaluate((storageKey) => {
      const state = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as { knowledgeChecks?: Array<{ title: string }> };
      return state.knowledgeChecks?.[0]?.title ?? '';
    }, studioStorageKey);
    expect(retainedLocalTitle).toBe('Synthetic Local Divergence');
    report.coverage.silentOverwritePrevented = true;

    await page.getByRole('button', { name: 'Acknowledge', exact: true }).click();
    await expect(page.getByTestId('pilot-conflict-count')).toHaveText('0');
    report.coverage.conflictAcknowledged = true;

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-pilot-diagnostics').click();
    const downloaded = await downloadPromise;
    const downloadedPath = await downloaded.path();
    if (!downloadedPath) throw new Error('Sanitized diagnostics download was unavailable');
    const diagnosticsText = await readFile(downloadedPath, 'utf8');
    const diagnostics = JSON.parse(diagnosticsText) as {
      schema?: string;
      queue?: { operations?: Array<Record<string, unknown>> };
      reconciliation?: { conflicts?: Array<Record<string, unknown>> };
    };
    expect(diagnostics.schema).toBe('beaufort-learning-harbor-hosted-pilot-diagnostics-v2');
    expect(diagnosticsText).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
    expect(diagnosticsText).not.toMatch(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
    expect(diagnosticsText).not.toContain('Synthetic Browser Learner');
    for (const operation of diagnostics.queue?.operations ?? []) {
      expect(operation).toHaveProperty('operationDigest');
      expect(operation).not.toHaveProperty('id');
      expect(operation).not.toHaveProperty('payload');
      expect(operation).not.toHaveProperty('lastError');
    }
    for (const conflict of diagnostics.reconciliation?.conflicts ?? []) {
      expect(conflict).toHaveProperty('conflictDigest');
      expect(conflict).toHaveProperty('recordDigest');
      expect(conflict).not.toHaveProperty('id');
      expect(conflict).not.toHaveProperty('recordId');
    }
    report.coverage.diagnosticsSanitized = true;
    report.diagnosticsDigest = sha256(diagnosticsText);
    report.state = 'hosted-browser-resilience-complete-additional-gate-c-evidence-required';
  } catch (error) {
    primaryFailure = error;
    report.state = 'stopped';
  } finally {
    try {
      const signOut = page.getByRole('button', { name: 'Sign out', exact: true });
      if (await signOut.isVisible()) {
        await signOut.click();
        await expect(page.getByTestId('account-access-panel')).toBeVisible();
      }
      report.cleanup.browserSignedOut = true;
    } catch {
      // Cleanup state remains false and the protected run fails below.
    }

    if (observer) {
      try {
        await deleteSyntheticOrganizations(observer);
        report.cleanup.syntheticOrganizationDeleted = true;
      } catch {
        // Cleanup state remains false and the protected run fails below.
      }
      try {
        const signOut = await observer.auth.signOut({ scope: 'local' });
        report.cleanup.observerSignedOut = !signOut.error;
      } catch {
        // Cleanup state remains false and the protected run fails below.
      }
    }

    report.completedAt = new Date().toISOString();
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (primaryFailure) throw primaryFailure;
  expect(report.cleanup).toEqual({ syntheticOrganizationDeleted: true, browserSignedOut: true, observerSignedOut: true });
});
