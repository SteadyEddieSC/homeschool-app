import { expect, test, type Page } from '@playwright/test';

async function openDestination(page: Page, label: string): Promise<void> {
  const desktopNavigation = page.getByRole('navigation', { name: 'Main navigation' });
  if (await desktopNavigation.isVisible()) {
    await desktopNavigation.getByRole('button', { name: new RegExp(label) }).click();
    return;
  }
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: label }).click();
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth);
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

test.beforeEach(async ({ page }) => {
  await resetPreview(page);
});

test('beta.2 renders without credentials and exposes resilience readiness', async ({ page, request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  await expect(health.json()).resolves.toMatchObject({
    ok: true,
    service: 'beaufort-learning-harbor-v11-preview',
    release: '11.0.0-beta.2',
    environment: 'preview'
  });

  const config = await request.get('/api/config');
  expect(config.ok()).toBe(true);
  await expect(config.json()).resolves.toMatchObject({
    learning: {
      parentManagedLearners: true,
      explicitAdultReview: true,
      automaticGrades: false,
      automaticMastery: false,
      automaticAttendance: false,
      automaticXp: false
    },
    resilience: {
      localMirror: true,
      orderedMutationQueue: true,
      idempotentOperationReceipts: true,
      retryAndCancelControls: true,
      syncDisabledWhileSignedOut: true,
      encryptedPortableBackup: true,
      restorePreviewRequired: true,
      automaticCloudBackup: false
    }
  });

  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('runtime-mode')).toHaveText('Local preview');
  await expect(page.getByTestId('sync-indicator')).toHaveText('Local only');
});

test('Parent creates a learner, assigns work, uses handoff, and completes adult review', async ({ page }) => {
  await createSyntheticHouseholdAndLearner(page);
  await expect(page.getByText('Synthetic Learner', { exact: true })).toBeVisible();

  await openDestination(page, 'Today');
  await page.getByTestId('assignment-title').fill('Synthetic reading practice');
  await page.getByTestId('assignment-instructions').fill('Read the original synthetic passage and leave a short note.');
  await page.getByTestId('assignment-type').selectOption('practice');
  await page.getByTestId('create-assignment').click();
  await expect(page.getByText('The practice item was assigned to Synthetic Learner.')).toBeVisible();

  await page.getByRole('button', { name: 'Start learner mode' }).click();
  await expect(page.getByTestId('learner-handoff')).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByLabel('Note for the adult reviewer optional').fill('Synthetic learner note for review.');
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText('Waiting for an adult review.')).toBeVisible();
  await page.getByTestId('end-handoff').click();

  await page.getByLabel(/Adult feedback/).fill('Reviewed synthetic work.');
  await page.getByRole('button', { name: 'Mark complete after review' }).click();
  await expect(page.getByText('The adult review marked this item complete.')).toBeVisible();
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
});

test('offline household changes queue once, reject duplicates, and synchronize in order after reconnect', async ({ page, context }) => {
  await resetPreview(page, '/?sync-sim=1');
  await context.setOffline(true);
  await page.waitForFunction(() => navigator.onLine === false);

  await createSyntheticHouseholdAndLearner(page);

  await page.getByTestId('learner-name').fill('Synthetic Learner');
  await page.getByTestId('learner-pronouns').fill('they/them');
  await page.getByTestId('learner-grade').selectOption('4-6');
  await page.getByTestId('learner-avatar').selectOption('heron');
  await page.getByTestId('create-learner').click();
  await expect(page.getByText('This action is already waiting to synchronize.')).toBeVisible();
  await expect(page.getByText('Synthetic Learner', { exact: true })).toHaveCount(1);

  await openDestination(page, 'Today');
  await page.getByTestId('assignment-title').fill('Synthetic offline assignment');
  await page.getByTestId('create-assignment').click();
  await expect(page.getByText('The learn item was assigned to Synthetic Learner.')).toBeVisible();
  await page.getByTestId('assignment-title').fill('Synthetic offline assignment');
  await page.getByTestId('create-assignment').click();
  await expect(page.getByText('This action is already waiting to synchronize.')).toBeVisible();

  await openDestination(page, 'Sync');
  await expect(page.getByTestId('sync-mode')).toHaveText('Offline');
  await expect(page.getByTestId('sync-pending-count')).toHaveText('3');
  await expect(page.getByTestId('sync-failed-count')).toHaveText('0');

  await context.setOffline(false);
  await page.waitForFunction(() => navigator.onLine === true);
  await expect(page.getByTestId('sync-pending-count')).toHaveText('0', { timeout: 10_000 });
  await expect(page.getByTestId('sync-indicator')).toHaveText('Synced');
  await expect(page.getByText('Completed', { exact: true })).toHaveCount(3);
});

test('a pending operation can be cancelled explicitly while offline', async ({ page, context }) => {
  await resetPreview(page, '/?sync-sim=1');
  await context.setOffline(true);
  await page.waitForFunction(() => navigator.onLine === false);
  await openDestination(page, 'Learners');
  await page.getByTestId('household-name').fill('Synthetic Cancel Household');
  await page.getByTestId('create-household').click();
  await openDestination(page, 'Sync');
  await expect(page.getByTestId('sync-pending-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('sync-pending-count')).toHaveText('0');
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
});

test('encrypted backup verifies counts and requires confirmation before restore', async ({ page }) => {
  await createSyntheticHouseholdAndLearner(page);
  await openDestination(page, 'Sync');
  const passphrase = 'SyntheticBackupPassphrase123!';
  await page.getByTestId('backup-export-passphrase').fill(passphrase);
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('backup-export').click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).not.toBeNull();

  await openDestination(page, 'Learners');
  await page.getByTestId('household-name').fill('Synthetic Extra Household');
  await page.getByTestId('create-household').click();
  await expect(page.getByText('Synthetic Extra Household was created.')).toBeVisible();

  await openDestination(page, 'Sync');
  await page.getByTestId('backup-restore-file').setInputFiles(backupPath!);
  await page.getByTestId('backup-restore-passphrase').fill(passphrase);
  await page.getByTestId('backup-inspect').click();
  const preview = page.getByTestId('restore-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('Households1');
  await expect(preview).toContainText('Learners1');
  await expect(page.getByTestId('backup-apply')).toBeDisabled();
  await page.getByTestId('backup-confirm').check();
  await page.getByTestId('backup-apply').click();
  await page.waitForLoadState('domcontentloaded');
  await openDestination(page, 'Learners');
  const householdList = page.getByLabel('Households', { exact: true });
  await expect(householdList.getByText('Synthetic Harbor Household', { exact: true })).toBeVisible();
  await expect(householdList.getByText('Synthetic Extra Household', { exact: true })).toHaveCount(0);
});

test('an incorrect backup passphrase does not expose a restore preview', async ({ page }) => {
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

test('family learner administration stays hidden from unrelated roles', async ({ page }) => {
  const roleSelect = page.getByTestId('role-select');
  for (const role of ['student', 'teacher', 'director', 'system-admin']) {
    await roleSelect.selectOption(role);
    await expect(page.getByTestId('nav-learners')).toHaveCount(0);
  }
  await roleSelect.selectOption('parent');
  await expect(page.getByTestId('nav-learners')).toHaveCount(1);
});

test('student feedback stays private while administrators can add hidden notes', async ({ page }) => {
  const roleSelect = page.getByTestId('role-select');
  await roleSelect.selectOption('student');
  await openDestination(page, 'Help');
  await page.getByTestId('ticket-subject').fill('Synthetic student navigation problem');
  await page.getByTestId('ticket-description').fill('The synthetic learner could not tell which practice action came next.');
  await page.getByTestId('submit-ticket').click();

  await roleSelect.selectOption('group-admin');
  await page.getByTestId('ticket-reply').fill('PRIVATE INTERNAL SYNTHETIC NOTE');
  await page.locator('.check-row.compact input[type="checkbox"]').check();
  await page.getByTestId('submit-reply').click();
  await expect(page.getByTestId('ticket-detail')).toContainText('PRIVATE INTERNAL SYNTHETIC NOTE');

  await roleSelect.selectOption('student');
  await expect(page.getByTestId('ticket-detail')).not.toContainText('PRIVATE INTERNAL SYNTHETIC NOTE');
});

test('learner, Today, and Sync workspaces do not overflow the active viewport', async ({ page }) => {
  for (const destination of ['Learners', 'Today', 'Sync']) {
    await openDestination(page, destination);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  }
});
