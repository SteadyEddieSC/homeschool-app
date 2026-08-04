import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('rc.1 health and configuration remain blocked from production promotion', async ({ page, request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  await expect(health.json()).resolves.toMatchObject({ ok: true, release: '11.0.0-rc.1', environment: 'preview' });
  const config = await request.get('/api/config');
  expect(config.ok()).toBe(true);
  await expect(config.json()).resolves.toMatchObject({
    productionDataEnabled: false,
    migration: { syntheticV1043Rehearsal: true, deterministicSourceMapping: true, importReceipts: true, silentCoercion: false, productionWriteEnabled: false },
    readiness: { decision: 'not-ready', productionReady: false, automatedPromotionAllowed: false, productionCutover: false, ownerApprovalRequired: true },
    recovery: { encryptedVendorExitRehearsal: true, rtoRpoEvidence: true },
    learning: { automaticGrades: false, automaticMastery: false, automaticAttendance: false, automaticXp: false }
  });
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('runtime-mode')).toHaveText('Local preview');
});

test('existing parent-managed learner and Today workflow remains usable', async ({ page }) => {
  const mainNav = page.getByRole('navigation', { name: 'Main navigation' });
  const mobileNav = page.getByRole('navigation', { name: 'Mobile navigation' });
  const navigate = async (label: string) => {
    if (await mainNav.isVisible()) await mainNav.getByRole('button', { name: new RegExp(label) }).click();
    else await mobileNav.getByRole('button', { name: label, exact: true }).click();
  };
  await navigate('Learners');
  await page.getByTestId('household-name').fill('Synthetic RC Household');
  await page.getByTestId('create-household').click();
  await page.getByTestId('learner-name').fill('Synthetic RC Learner');
  await page.getByTestId('learner-grade').selectOption('4-6');
  await page.getByTestId('learner-avatar').selectOption('heron');
  await page.getByTestId('create-learner').click();
  await expect(page.getByText('Synthetic RC Learner was added without an email account.')).toBeVisible();
  await navigate('Today');
  await page.getByTestId('assignment-title').fill('Synthetic RC practice');
  await page.getByTestId('assignment-type').selectOption('practice');
  await page.getByTestId('create-assignment').click();
  await expect(page.getByText(/was assigned to Synthetic RC Learner/)).toBeVisible();
});

test('responsive shell has no material horizontal overflow', async ({ page }) => {
  const overflow = await page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

test('API rejects writes and unknown endpoints', async ({ request }) => {
  expect((await request.post('/api/config', { data: {} })).status()).toBe(405);
  expect((await request.get('/api/not-real')).status()).toBe(404);
});
