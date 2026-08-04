import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function openDestination(page: Page, label: string): Promise<void> {
  const desktop = page.getByRole('navigation', { name: 'Main navigation' });
  if (await desktop.isVisible()) await desktop.getByRole('button', { name: new RegExp(label) }).click();
  else await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: label, exact: true }).click();
}

async function resetPreview(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function createHouseholdAndLearner(page: Page): Promise<void> {
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

async function assign(page: Page, title: string, type: 'learn' | 'practice' | 'quiz' | 'proof'): Promise<string> {
  await openDestination(page, 'Today');
  await page.getByTestId('assignment-title').fill(title);
  await page.getByTestId('assignment-type').selectOption(type);
  await page.getByTestId('create-assignment').click();
  await expect(page.getByText(/was assigned to Synthetic Learner/)).toBeVisible();
  return page.evaluate((itemTitle) => {
    const state = JSON.parse(localStorage.getItem('beaufortLearningHarbor.v11.beta1.learning') ?? '{}') as { todayItems?: Array<{ id: string; title: string }> };
    const item = state.todayItems?.find((candidate) => candidate.title === itemTitle);
    if (!item) throw new Error(`Missing item ${itemTitle}`);
    return item.id;
  }, title);
}

test.beforeEach(async ({ page }) => {
  await resetPreview(page);
});

test('rc.1 config preserves beta.4 identity, learning, sync, and privacy boundaries', async ({ page, request }) => {
  const config = await (await request.get('/api/config')).json();
  expect(config).toMatchObject({
    release: '11.0.0-rc.1',
    productionDataEnabled: false,
    identity: { systemAdminInvitations: false },
    learning: {
      parentManagedLearners: true,
      parentAssistedHandoff: true,
      deterministicObjectiveScoring: true,
      explicitEvidenceReview: true,
      weeklyHouseholdPlanning: true,
      automaticGrades: false,
      automaticMastery: false,
      automaticAttendance: false,
      automaticXp: false,
      automaticPortfolioApproval: false
    },
    resilience: {
      orderedMutationQueue: true,
      clientRecordIdsPreserved: true,
      conflictAwareStudioReconciliation: true,
      silentConflictOverwrite: false,
      encryptedPortableBackup: true,
      restorePreviewRequired: true,
      sanitizedPilotDiagnostics: true
    },
    readiness: { decision: 'not-ready', productionReady: false, automatedPromotionAllowed: false, productionCutover: false }
  });
  await expect(page.getByTestId('app-shell')).toBeVisible();
});

test('general work still requires learner handoff and explicit adult completion', async ({ page }) => {
  await createHouseholdAndLearner(page);
  const itemId = await assign(page, 'Synthetic reading practice', 'practice');
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

test('objective scoring, proof revisions, adult review, and weekly planning remain cohesive', async ({ page }) => {
  await createHouseholdAndLearner(page);
  const quizId = await assign(page, 'Synthetic harbor knowledge check', 'quiz');
  const proofId = await assign(page, 'Synthetic harbor model proof', 'proof');
  await openDestination(page, 'Plan');
  await page.getByTestId('check-title').fill('Synthetic harbor check');
  await page.getByTestId('question-type-0').selectOption('true-false');
  await page.getByTestId('question-prompt-0').fill('The synthetic harbor uses an explicit answer key.');
  await page.getByTestId('question-correct-0').selectOption('0');
  await page.getByTestId('create-check').click();
  await expect(page.getByText('Knowledge check attached')).toBeVisible();
  await page.getByTestId('plan-title').fill('Synthetic family week');
  await page.getByTestId('create-weekly-plan').click();
  await page.getByTestId('plan-item-title').fill('Synthetic Monday reading');
  await page.getByTestId('add-plan-item').click();
  await expect(page.getByText('Synthetic Monday reading was added')).toBeVisible();

  await openDestination(page, 'Today');
  await page.getByRole('button', { name: 'Start learner mode' }).click();
  await page.getByTestId(`handoff-item-${quizId}`).getByRole('button', { name: 'Start', exact: true }).click();
  const check = await page.evaluate(() => JSON.parse(localStorage.getItem('beaufortLearningHarbor.v11.beta3.studio') ?? '{}').knowledgeChecks?.[0]);
  expect(check).toBeTruthy();
  await page.getByTestId(`answer-${check.id}-${check.questions[0].id}-0`).check();
  await page.getByTestId(`submit-check-${check.id}`).click();
  await expect(page.getByText('100% tool score')).toBeVisible();
  await page.getByTestId(`handoff-item-${proofId}`).getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByTestId(`evidence-content-${proofId}`).fill('Synthetic first proof revision.');
  await page.getByTestId(`submit-evidence-${proofId}`).click();
  await page.getByTestId('end-handoff').click();
  await openDestination(page, 'Plan');
  const submission = await page.evaluate(() => JSON.parse(localStorage.getItem('beaufortLearningHarbor.v11.beta3.studio') ?? '{}').evidenceSubmissions?.[0]);
  await page.getByTestId(`evidence-feedback-${submission.id}`).fill('Accepted after explicit adult review.');
  await page.getByTestId(`accept-evidence-${submission.id}`).click();
  await expect(page.getByText('Proof was explicitly accepted and the reviewed Today item was completed.')).toBeVisible();
});

test('offline simulation queues once and reconnects in order', async ({ page, context }) => {
  await resetPreview(page, '/?sync-sim=1');
  await context.setOffline(true);
  await page.waitForFunction(() => navigator.onLine === false);
  await createHouseholdAndLearner(page);
  await assign(page, 'Synthetic queued quiz', 'quiz');
  await openDestination(page, 'Plan');
  await page.getByTestId('question-type-0').selectOption('true-false');
  await page.getByTestId('question-prompt-0').fill('Queued scoring is deterministic.');
  await page.getByTestId('create-check').click();
  await openDestination(page, 'Sync');
  await expect(page.getByTestId('sync-pending-count')).toHaveText('4');
  await context.setOffline(false);
  await page.waitForFunction(() => navigator.onLine === true);
  await expect(page.getByTestId('sync-pending-count')).toHaveText('0', { timeout: 10_000 });
  await expect(page.getByTestId('sync-indicator')).toHaveText('Synced');
});

test('hosted diagnostics and conflicts remain sanitized and explicit', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('beaufortLearningHarbor.v11.beta4.studioConflicts', JSON.stringify({
    schema: 'beaufort-learning-harbor-hosted-pilot-state-v1',
    conflicts: [{ id: 'knowledge-check:synthetic-check:11111111:22222222', organizationId: 'preview-organization', entityType: 'knowledge-check', recordId: 'synthetic-check-record', summary: 'Knowledge check synthetic-', localDigest: '11111111', remoteDigest: '22222222', detectedAt: '2026-08-04T12:00:00.000Z', status: 'open' }],
    refreshes: {}
  })));
  await page.reload();
  await openDestination(page, 'Sync');
  await expect(page.getByTestId('pilot-conflict-count')).toHaveText('1');
  const conflict = page.getByTestId('pilot-conflict-knowledge-check:synthetic-check:11111111:22222222');
  await expect(conflict).toContainText('local 11111111 / hosted 22222222');
  await page.getByTestId('acknowledge-conflict-knowledge-check:synthetic-check:11111111:22222222').click();
  await expect(page.getByTestId('pilot-conflict-count')).toHaveText('0');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('download-pilot-diagnostics').click();
  const reportPath = await (await downloadPromise).path();
  const report = JSON.parse(await readFile(reportPath!, 'utf8')) as { queue?: { operations?: Array<Record<string, unknown>> } };
  for (const operation of report.queue?.operations ?? []) {
    expect(operation).not.toHaveProperty('payload');
    expect(operation).not.toHaveProperty('lastError');
  }
  expect(JSON.stringify(report)).not.toContain('Synthetic Learner');
});

test('encrypted portable backup still requires inspection and explicit restore confirmation', async ({ page }) => {
  await createHouseholdAndLearner(page);
  await assign(page, 'Synthetic backup quiz', 'quiz');
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
  await page.getByTestId('backup-restore-file').setInputFiles(backupPath!);
  await page.getByTestId('backup-restore-passphrase').fill(passphrase);
  await page.getByTestId('backup-inspect').click();
  await expect(page.getByTestId('restore-preview')).toContainText('Knowledge checks1');
  await expect(page.getByTestId('backup-apply')).toBeDisabled();
  await page.getByTestId('backup-confirm').check();
  await expect(page.getByTestId('backup-apply')).toBeEnabled();
});

test('family administration, planning, and internal support notes remain role-bounded', async ({ page }) => {
  const roles = page.getByTestId('role-select');
  for (const role of ['student', 'teacher', 'director', 'system-admin']) {
    await roles.selectOption(role);
    await expect(page.getByTestId('nav-learners')).toHaveCount(0);
    await expect(page.getByTestId('nav-studio')).toHaveCount(0);
  }
  await roles.selectOption('student');
  await openDestination(page, 'Help');
  await page.getByTestId('ticket-subject').fill('Synthetic student navigation problem');
  await page.getByTestId('ticket-description').fill('The synthetic learner could not tell which action came next.');
  await page.getByTestId('submit-ticket').click();
  await roles.selectOption('group-admin');
  await page.getByTestId('ticket-reply').fill('PRIVATE INTERNAL SYNTHETIC NOTE');
  await page.locator('.check-row.compact input[type="checkbox"]').check();
  await page.getByTestId('submit-reply').click();
  await roles.selectOption('student');
  await expect(page.getByTestId('ticket-detail')).not.toContainText('PRIVATE INTERNAL SYNTHETIC NOTE');
});

test('normal Today, Plan, Learners, and Sync screens do not overflow the viewport', async ({ page }) => {
  for (const destination of ['Today', 'Plan', 'Learners', 'Sync']) {
    await openDestination(page, destination);
    const overflow = await page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  }
});
