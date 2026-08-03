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

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('alpha.2 renders without credentials and exposes identity readiness', async ({ page, request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  await expect(health.json()).resolves.toMatchObject({
    ok: true,
    service: 'beaufort-learning-harbor-v11-preview',
    release: '11.0.0-alpha.2',
    environment: 'preview'
  });

  const config = await request.get('/api/config');
  expect(config.ok()).toBe(true);
  await expect(config.json()).resolves.toMatchObject({
    identity: {
      signup: true,
      passwordRecovery: true,
      organizationBootstrap: true,
      oneTimeInvitations: true,
      systemAdminInvitations: false
    }
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
  await expect(page.getByTestId('nav-members')).toHaveCount(0);
  await openDestination(page, 'Help');

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

test('Group Administrator creates a one-time role-limited invitation', async ({ page }) => {
  const roleSelect = page.getByTestId('role-select');
  await roleSelect.selectOption('group-admin');
  await openDestination(page, 'Members');
  await expect(page.getByTestId('members-workspace')).toBeVisible();
  await expect(page.getByTestId('invite-role').locator('option[value="system-admin"]')).toHaveCount(0);

  await page.getByTestId('invite-role').selectOption('teacher');
  await page.getByTestId('create-invite').click();
  const oneTime = page.getByTestId('one-time-invite');
  await expect(oneTime).toBeVisible();
  await expect(oneTime.locator('code')).toHaveText(/^[a-f0-9]{64}$/);
  await expect(page.getByRole('table', { name: 'Organization invitations' })).toContainText('Teacher');
  await expect(page.getByRole('table', { name: 'Organization invitations' })).toContainText('Active');

  await roleSelect.selectOption('student');
  await expect(page.getByTestId('nav-members')).toHaveCount(0);
  await expect(page.getByTestId('members-workspace')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Know what to do next.' })).toBeVisible();
});

test('support and membership workspaces do not overflow the active viewport', async ({ page }) => {
  await openDestination(page, 'Help');
  await expect(page.getByTestId('support-workspace')).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

  await page.getByTestId('role-select').selectOption('group-admin');
  await openDestination(page, 'Members');
  await expect(page.getByTestId('members-workspace')).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
});
