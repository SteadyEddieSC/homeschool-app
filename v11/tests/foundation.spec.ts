import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function openDestination(page: Page, label: string): Promise<void> {
  const desktopNavigation = page.getByRole('navigation', { name: 'Main navigation' });
  if (await desktopNavigation.isVisible()) {
    await desktopNavigation.getByRole('button', { name: new RegExp(label) }).click();
    return;
  }
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: label, exact: true }).click();
}

async function resetPreview(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function createSyntheticHouseholdAndLearner(page: Page): Promise<void> {
  await openDestination(page, 'Learners');
  await page.getByTestId('household-name').fill('Synthetic Harbor Household');
  await page.getByTestId('create-household').click();
  await expect(page.getByText('Synthetic Harbor Household was created.')).toBeVisible();
  await page.getByTestId('learner-name').fill('Synthetic Learner');
  await page.getByTestId('learner-pronouns').fill('they/them');
  await page.getByTestId('learner-grade').selectOption('4-6');
  await page.getByTestId('learner-avatar').selectOption('heron');
  await page.getByTestId('create-learner').click();
  await expect(page.getByText('Synthetic Learner was added without an email account.')).toBeVisible();
}

async function assignItem(page: Page, title: string, type: 'learn' | 'practice' | 'quiz' | 'proof'): Promise<string> {
  await openDestination(page, 'Today');
  await page.getByTestId('assignment-title').fill(title);
  await page.getByTestId('assignment-type').selectOption(type);
  await page.getByTestId('create-assignment').click();
  await expect(page.getByText(new RegExp('was assigned to Synthetic Learner'))).toBeVisible();
  return page.evaluate((itemTitle) => {
    const state = JSON.parse(localStorage.getItem('beaufortLearningHarbor.v11.beta1.learning') ?? '{}') as {
      todayItems?: Array<{ id: string; title: string }>;
    };
    const item = state.todayItems?.find((candidate) => candidate.title === itemTitle);
    if (!item) throw new Error(`Missing synthetic Today item: ${itemTitle}`);
    return item.id;
  }, title);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth);
}

test.beforeEach(async ({ page }) => {
  await resetPreview(page);
});

test('beta.4 renders without credentials and exposes hosted-pilot safety boundaries', async ({ page, request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  await expect(health.json()).resolves.toMatchObject({
    ok: true,
    service: 'beaufort-learning-harbor-v11-preview',
    release: '11.0.0-beta.4',
    environment: 'preview'
  });

  const config = await request.get('/api/config');
  expect(config.ok()).toBe(true);
  await expect(config.json()).resolves.toMatchObject({
    productionDataEnabled: false,
    learning: {
      parentManagedLearners: true,
      deterministicObjectiveScoring: true,
      explicitEvidenceReview: true,
      evidenceRevisionHistory: true,
      weeklyHouseholdPlanning: true,
      automaticGrades: false,
      automaticMastery: false,
      automaticAttendance: false,
      automaticXp: false
    },
    resilience: {
      localMirror: true,
      orderedMutationQueue: true,
      clientRecordIdsPreserved: true,
      conflictAwareStudioReconciliation: true,
      silentConflictOverwrite: false,
      encryptedPortableBackup: true,
      beta2AndBeta3BackupImport: true,
      restorePreviewRequired: true,
      sanitizedPilotDiagnostics: true
    },
    hostedPilot: {
      studioRepositories: true,
      schemaStatusRpc: true,
      providerActivationRequired: true,
      automaticDeployment: false,
      productionCutover: false
    }
  });

  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('runtime-mode')).toHaveText('Local preview');
  await expect(page.getByTestId('sync-indicator')).toHaveText('Local only');
});

test('general Today work still uses supervised handoff and explicit adult review', async ({ page }) => {
  await createSyntheticHouseholdAndLearner(page);
  const itemId = await assignItem(page, 'Synthetic reading practice', 'practice');
  await page.getByRole('button', { name: 'Start learner mode' }).click();
  const card = page.getByTestId(`handoff-item-${itemId}`);
  await card.getByRole('button', { name: 'Start', exact: true }).click();
  await card.getByTestId(`learner-note-${itemId}`).fill('Synthetic learner note for review.');
  await card.getByTestId(`submit-review-${itemId}`).click();
  await expect(card.getByText('Waiting for an adult review.')).toBeVisible();
  await page.getByTestId('end-handoff').click();
  await page.getByTestId(`review-note-${itemId}`).fill('Reviewed synthetic work.');
  await page.getByTestId(`complete-item-${itemId}`).click();
  await expect(page.getByText('The adult review marked this item complete.')).toBeVisible();
});

test('objective checks, proof revisions, adult decisions, and weekly plans form one family workflow', async ({ page }) => {
  await createSyntheticHouseholdAndLearner(page);
  const quizId = await assignItem(page, 'Synthetic harbor knowledge check', 'quiz');
  const proofId = await assignItem(page, 'Synthetic harbor model proof', 'proof');

  await openDestination(page, 'Plan');
  await page.getByTestId('check-title').fill('Synthetic harbor check');
  await page.getByTestId('question-type-0').selectOption('true-false');
  await page.getByTestId('question-prompt-0').fill('The synthetic harbor uses an explicit answer key.');
  await page.getByTestId('question-correct-0').selectOption('0');
  await page.getByTestId('create-check').click();
  await expect(page.getByText('Knowledge check attached')).toBeVisible();

  await page.getByTestId('plan-title').fill('Synthetic family week');
  await page.getByTestId('create-weekly-plan').click();
  await expect(page.getByText('Synthetic family week was created.')).toBeVisible();
  await page.getByTestId('plan-item-title').fill('Synthetic Monday reading');
  await page.getByTestId('add-plan-item').click();
  await expect(page.getByText('Synthetic Monday reading was added')).toBeVisible();

  await openDestination(page, 'Today');
  await page.getByRole('button', { name: 'Start learner mode' }).click();
  await page.getByTestId(`handoff-item-${quizId}`).getByRole('button', { name: 'Start', exact: true }).click();
  const studioState = await page.evaluate(() => JSON.parse(localStorage.getItem('beaufortLearningHarbor.v11.beta3.studio') ?? '{}') as {
    knowledgeChecks?: Array<{ id: string; questions: Array<{ id: string }> }>;
  });
  const check = studioState.knowledgeChecks?.[0];
  if (!check) throw new Error('Synthetic knowledge check was not persisted.');
  await page.getByTestId(`answer-${check.id}-${check.questions[0]!.id}-0`).check();
  await page.getByTestId(`submit-check-${check.id}`).click();
  await expect(page.getByText('Check scored 1 of 1.')).toBeVisible();
  await expect(page.getByText('100% tool score')).toBeVisible();

  await page.getByTestId(`handoff-item-${proofId}`).getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByTestId(`evidence-content-${proofId}`).fill('Synthetic first proof revision.');
  await page.getByTestId(`submit-evidence-${proofId}`).click();
  await expect(page.getByText('Proof revision 1 was sent for adult review.')).toBeVisible();
  await expect(page.getByText('Synthetic Monday reading', { exact: true })).toBeVisible();
  await page.getByTestId('end-handoff').click();

  await openDestination(page, 'Plan');
  const firstEvidenceState = await page.evaluate(() => JSON.parse(localStorage.getItem('beaufortLearningHarbor.v11.beta3.studio') ?? '{}') as {
    evidenceSubmissions?: Array<{ id: string; revision: number }>;
  });
  const firstSubmission = firstEvidenceState.evidenceSubmissions?.[0];
  if (!firstSubmission) throw new Error('Synthetic evidence was not persisted.');
  await page.getByTestId(`evidence-feedback-${firstSubmission.id}`).fill('Add one more synthetic detail.');
  await page.getByTestId(`return-evidence-${firstSubmission.id}`).click();
  await expect(page.getByText('Proof was returned with feedback and can be revised.')).toBeVisible();

  await openDestination(page, 'Today');
  await page.getByRole('button', { name: 'Start learner mode' }).click();
  await page.getByTestId(`handoff-item-${proofId}`).getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByTestId(`proof-item-${proofId}`).getByText('Add one more synthetic detail.')).toBeVisible();
  await page.getByTestId(`evidence-content-${proofId}`).fill('Synthetic second proof revision with another detail.');
  await page.getByTestId(`submit-evidence-${proofId}`).click();
  await expect(page.getByText('Proof revision 2 was sent for adult review.')).toBeVisible();
  await page.getByTestId('end-handoff').click();

  await openDestination(page, 'Plan');
  const secondEvidenceState = await page.evaluate(() => JSON.parse(localStorage.getItem('beaufortLearningHarbor.v11.beta3.studio') ?? '{}') as {
    evidenceSubmissions?: Array<{ id: string; revision: number }>;
  });
  const secondSubmission = secondEvidenceState.evidenceSubmissions?.find((submission) => submission.revision === 2);
  if (!secondSubmission) throw new Error('Synthetic evidence revision 2 was not persisted.');
  await page.getByTestId(`evidence-feedback-${secondSubmission.id}`).fill('Accepted after explicit adult review.');
  await page.getByTestId(`accept-evidence-${secondSubmission.id}`).click();
  await expect(page.getByText('Proof was explicitly accepted and the reviewed Today item was completed.')).toBeVisible();

  await openDestination(page, 'Today');
  await expect(page.getByText('Synthetic harbor model proof').locator('..').locator('..')).toContainText('Completed');
  await expect(page.getByText('Tool-scored result: 1/1 (100%).')).toBeVisible();
});

test('beta.4 cloud simulation queues studio operations once and reconnects in order', async ({ page, context }) => {
  await resetPreview(page, '/?sync-sim=1');
  await context.setOffline(true);
  await page.waitForFunction(() => navigator.onLine === false);
  await createSyntheticHouseholdAndLearner(page);
  await assignItem(page, 'Synthetic queued quiz', 'quiz');
  await openDestination(page, 'Plan');
  await page.getByTestId('question-type-0').selectOption('true-false');
  await page.getByTestId('question-prompt-0').fill('Queued scoring is deterministic.');
  await page.getByTestId('create-check').click();
  await page.getByTestId('question-type-0').selectOption('true-false');
  await page.getByTestId('question-prompt-0').fill('A second check must be rejected.');
  await page.getByTestId('create-check').click();
  await expect(page.getByText('already has a knowledge check')).toBeVisible();
  await openDestination(page, 'Sync');
  await expect(page.getByTestId('sync-pending-count')).toHaveText('4');
  await context.setOffline(false);
  await page.waitForFunction(() => navigator.onLine === true);
  await expect(page.getByTestId('sync-pending-count')).toHaveText('0', { timeout: 10_000 });
  await expect(page.getByTestId('sync-indicator')).toHaveText('Synced');
});

test('hosted pilot remains explicitly deferred without provider configuration and diagnostics are sanitized', async ({ page }) => {
  await openDestination(page, 'Sync');
  await expect(page.getByTestId('hosted-pilot-workspace')).toBeVisible();
  await expect(page.getByTestId('pilot-overall-status')).toHaveText('Activation deferred');
  await expect(page.getByTestId('pilot-provider-status')).toHaveText('Not configured');
  await expect(page.getByTestId('pilot-conflict-count')).toHaveText('0');

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('download-pilot-diagnostics').click();
  const download = await downloadPromise;
  const diagnosticsPath = await download.path();
  expect(diagnosticsPath).not.toBeNull();
  const report = JSON.parse(await readFile(diagnosticsPath!, 'utf8')) as {
    release?: string;
    queue?: { operations?: Array<Record<string, unknown>> };
    reconciliation?: unknown;
  };
  expect(report.release).toBe('11.0.0-beta.4');
  expect(report.queue).toBeDefined();
  expect(report.reconciliation).toBeDefined();
  for (const operation of report.queue?.operations ?? []) {
    expect(operation).not.toHaveProperty('payload');
    expect(operation).not.toHaveProperty('lastError');
  }
  const serialized = JSON.stringify(report);
  expect(serialized).not.toContain('Synthetic Learner');
  expect(serialized).not.toContain('PRIVATE INTERNAL SYNTHETIC NOTE');
});

test('divergent hosted records are visible and acknowledgeable without exposing record content', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('beaufortLearningHarbor.v11.beta4.studioConflicts', JSON.stringify({
      schema: 'beaufort-learning-harbor-hosted-pilot-state-v1',
      conflicts: [{
        id: 'knowledge-check:synthetic-check:11111111:22222222',
        organizationId: 'preview-organization',
        entityType: 'knowledge-check',
        recordId: 'synthetic-check-record',
        summary: 'Knowledge check synthetic-',
        localDigest: '11111111',
        remoteDigest: '22222222',
        detectedAt: '2026-08-04T12:00:00.000Z',
        status: 'open'
      }],
      refreshes: {}
    }));
  });
  await page.reload();
  await openDestination(page, 'Sync');
  await expect(page.getByTestId('pilot-conflict-count')).toHaveText('1');
  const conflict = page.getByTestId('pilot-conflict-knowledge-check:synthetic-check:11111111:22222222');
  await expect(conflict).toContainText('local 11111111 / hosted 22222222');
  await expect(conflict).not.toContainText('question');
  await page.getByTestId('acknowledge-conflict-knowledge-check:synthetic-check:11111111:22222222').click();
  await expect(conflict).toContainText('acknowledged');
  await expect(page.getByTestId('pilot-conflict-count')).toHaveText('0');
});

test('encrypted backup includes beta.4 learning records and requires preview confirmation', async ({ page }) => {
  await createSyntheticHouseholdAndLearner(page);
  await assignItem(page, 'Synthetic backup quiz', 'quiz');
  await openDestination(page, 'Plan');
  await page.getByTestId('question-type-0').selectOption('true-false');
  await page.getByTestId('question-prompt-0').fill('Backup records include knowledge checks.');
  await page.getByTestId('create-check').click();

  await openDestination(page, 'Sync');
  const passphrase = 'SyntheticBackupPassphrase123!';
  await page.getByTestId('backup-export-passphrase').fill(passphrase);
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('backup-export').click();
  const backupPath = await (await downloadPromise).path();
  expect(backupPath).not.toBeNull();
  await page.getByTestId('backup-restore-file').setInputFiles(backupPath!);
  await page.getByTestId('backup-restore-passphrase').fill(passphrase);
  await page.getByTestId('backup-inspect').click();
  const preview = page.getByTestId('restore-preview');
  await expect(preview).toContainText('11.0.0-beta.4 backup');
  await expect(preview).toContainText('Knowledge checks1');
  await expect(preview).toContainText('Households1');
  await expect(page.getByTestId('backup-apply')).toBeDisabled();
  await page.getByTestId('backup-confirm').check();
  await expect(page.getByTestId('backup-apply')).toBeEnabled();
});

test('incorrect backup passphrase does not expose restore contents', async ({ page }) => {
  await createSyntheticHouseholdAndLearner(page);
  await openDestination(page, 'Sync');
  await page.getByTestId('backup-export-passphrase').fill('SyntheticBackupPassphrase123!');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('backup-export').click();
  const backupPath = await (await downloadPromise).path();
  await page.getByTestId('backup-restore-file').setInputFiles(backupPath!);
  await page.getByTestId('backup-restore-passphrase').fill('IncorrectPassphrase123!');
  await page.getByTestId('backup-inspect').click();
  await expect(page.getByText('Backup could not be decrypted.')).toBeVisible();
  await expect(page.getByTestId('restore-preview')).toHaveCount(0);
});

test('family and planning administration stay hidden from unrelated roles', async ({ page }) => {
  const roleSelect = page.getByTestId('role-select');
  for (const role of ['student', 'teacher', 'director', 'system-admin']) {
    await roleSelect.selectOption(role);
    await expect(page.getByTestId('nav-learners')).toHaveCount(0);
    await expect(page.getByTestId('nav-studio')).toHaveCount(0);
  }
  await roleSelect.selectOption('parent');
  await expect(page.getByTestId('nav-learners')).toHaveCount(1);
  await expect(page.getByTestId('nav-studio')).toHaveCount(1);
});

test('student support notes remain private from internal administrator notes', async ({ page }) => {
  const roleSelect = page.getByTestId('role-select');
  await roleSelect.selectOption('student');
  await openDestination(page, 'Help');
  await page.getByTestId('ticket-subject').fill('Synthetic student navigation problem');
  await page.getByTestId('ticket-description').fill('The synthetic learner could not tell which action came next.');
  await page.getByTestId('submit-ticket').click();
  await roleSelect.selectOption('group-admin');
  await page.getByTestId('ticket-reply').fill('PRIVATE INTERNAL SYNTHETIC NOTE');
  await page.locator('.check-row.compact input[type="checkbox"]').check();
  await page.getByTestId('submit-reply').click();
  await roleSelect.selectOption('student');
  await expect(page.getByTestId('ticket-detail')).not.toContainText('PRIVATE INTERNAL SYNTHETIC NOTE');
});

test('Today, Plan, Learners, and Sync do not overflow the active viewport', async ({ page }) => {
  for (const destination of ['Today', 'Plan', 'Learners', 'Sync']) {
    await openDestination(page, destination);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  }
});
