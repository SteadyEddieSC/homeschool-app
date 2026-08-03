import { expect, test, type Page } from '@playwright/test';

async function openSupport(page: Page): Promise<void> {
  const desktopNavigation = page.getByRole('navigation', { name: 'Main navigation' });
  if (await desktopNavigation.isVisible()) {
    await desktopNavigation.getByRole('button', { name: /Help/ }).click();
    return;
  }
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'Help' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('foundation renders without credentials and exposes a healthy Worker API', async ({ page, request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  await expect(health.json()).resolves.toMatchObject({
    ok: true,
    release: '11.0.0-alpha.1',
    environment: 'preview'
  });

  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('runtime-mode')).toHaveText('Local preview');
  await expect(page.getByRole('heading', { name: 'One calm place to coordinate learning.' })).toBeVisible();
  await expect(page.getByText('v10.43 preserved')).toBeVisible();
});

test('student feedback stays private while administrators can respond and add hidden notes', async ({ page }) => {
  const roleSelect = page.getByTestId('role-select');
  await roleSelect.selectOption('student');
  await expect(page.getByTestId('nav-group')).toHaveCount(0);
  await openSupport(page);

  await page.getByTestId('ticket-subject').fill('Synthetic student navigation problem');
  await page.getByTestId('ticket-description').fill('The synthetic learner could not tell which practice action came next.');
  await page.getByTestId('submit-ticket').click();
  await expect(page.getByTestId('ticket-detail')).toContainText('Synthetic student navigation problem');
  await expect(page.getByText('Ticket #1001 was submitted.')).toBeVisible();

  await roleSelect.selectOption('group-admin');
  await expect(page.getByTestId('ticket-status')).toBeVisible();
  await page.getByTestId('ticket-reply').fill('A public support response for the student.');
  await page.getByTestId('submit-reply').click();
  await expect(page.getByTestId('ticket-detail')).toContainText('A public support response for the student.');

  await page.getByTestId('ticket-reply').fill('PRIVATE INTERNAL SYNTHETIC NOTE');
  await page.locator('.check-row.compact input[type="checkbox"]').check();
  await page.getByTestId('submit-reply').click();
  await expect(page.getByTestId('ticket-detail')).toContainText('PRIVATE INTERNAL SYNTHETIC NOTE');

  await roleSelect.selectOption('student');
  await expect(page.getByTestId('ticket-detail')).toContainText('A public support response for the student.');
  await expect(page.getByTestId('ticket-detail')).not.toContainText('PRIVATE INTERNAL SYNTHETIC NOTE');
  await expect(page.getByTestId('ticket-status')).toHaveCount(0);
});

test('shell and support workflow do not overflow the active viewport', async ({ page }) => {
  await openSupport(page);
  await expect(page.getByTestId('support-workspace')).toBeVisible();
  const overflow = await page.evaluate(() => {
    const width = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
    return width - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
});
