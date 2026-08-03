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

test('beta.1 renders without credentials and exposes reviewed-learning readiness', async ({ page, request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  await expect(health.json()).resolves.toMatchObject({
    ok: true,
    service: 'beaufort-learning-harbor-v11-preview',
    release: '11.0.0-beta.1',
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
    },
    learning: {
      parentManagedLearners: true,
      learnerEmailRequired: false,
      parentAssistedHandoff: true,
      independentLearnerAuthentication: false,
      explicitAdultReview: true,
      automaticGrades: false,
      automaticMastery: false,
      automaticAttendance: false,
      automaticXp: false
    }
  });

  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('runtime-mode')).toHaveText('Local preview');
  await expect(page.getByRole('heading', { name: 'Assign, hand off, and review without hidden outcomes.' })).toBeVisible();
});

test('Parent creates a learner, assigns work, uses handoff, and completes adult review', async ({ page }) => {
  await openDestination(page, 'Learners');
  await expect(page.getByTestId('learners-workspace')).toBeVisible();

  await page.getByTestId('household-name').fill('Synthetic Harbor Household');
  await page.getByTestId('create-household').click();
  await expect(page.getByText('Synthetic Harbor Household was created.')).toBeVisible();

  await page.getByTestId('learner-name').fill('Synthetic Learner');
  await page.getByTestId('learner-pronouns').fill('they/them');
  await page.getByTestId('learner-grade').selectOption('4-6');
  await page.getByTestId('learner-avatar').selectOption('heron');
  await page.getByTestId('create-learner').click();
  await expect(page.getByText('Synthetic Learner was added without an email account.')).toBeVisible();
  await expect(page.getByText('Synthetic Learner', { exact: true })).toBeVisible();

  await openDestination(page, 'Today');
  await page.getByTestId('assignment-title').fill('Synthetic reading practice');
  await page.getByTestId('assignment-instructions').fill('Read the original synthetic passage and leave a short note.');
  await page.getByTestId('assignment-type').selectOption('practice');
  await page.getByTestId('create-assignment').click();
  await expect(page.getByText('The practice item was assigned to Synthetic Learner.')).toBeVisible();

  await page.getByRole('button', { name: 'Start learner mode' }).click();
  await expect(page.getByTestId('learner-handoff')).toBeVisible();
  await expect(page.getByText('Focused device handoff')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Synthetic Learner’s Today' })).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByLabel('Note for the adult reviewer optional').fill('Synthetic learner note for review.');
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText('Waiting for an adult review.')).toBeVisible();
  await page.getByTestId('end-handoff').click();

  await expect(page.getByText('Synthetic learner note for review.')).toBeVisible();
  await page.getByLabel(/Adult feedback/).fill('Reviewed synthetic work.');
  await page.getByRole('button', { name: 'Mark complete after review' }).click();
  await expect(page.getByText('The adult review marked this item complete.')).toBeVisible();
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  await expect(page.getByText(/No grade, mastery, attendance, or XP is awarded automatically/)).toHaveCount(0);
});

test('family learner administration stays hidden from Student, Teacher, Director, and System Administrator roles', async ({ page }) => {
  const roleSelect = page.getByTestId('role-select');
  for (const role of ['student', 'teacher', 'director', 'system-admin']) {
    await roleSelect.selectOption(role);
    await expect(page.getByTestId('nav-learners')).toHaveCount(0);
  }
  await roleSelect.selectOption('parent');
  await expect(page.getByTestId('nav-learners')).toHaveCount(1);
  await roleSelect.selectOption('group-admin');
  await expect(page.getByTestId('nav-learners')).toHaveCount(1);
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
});

test('learner and Today workspaces do not overflow the active viewport', async ({ page }) => {
  await openDestination(page, 'Learners');
  await expect(page.getByTestId('learners-workspace')).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

  await openDestination(page, 'Today');
  await expect(page.getByTestId('today-workspace')).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
});
