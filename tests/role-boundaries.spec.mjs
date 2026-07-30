import { test, expect } from '@playwright/test';

const stateKey = 'beaufortLearningHarbor.v10.19.state';

async function loadDemo(page) {
  await page.goto('/');
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('load-demo-family').click();
  await expect(page.getByTestId('demo-scenario-status')).toHaveText('Active sample progress');
}

async function setRole(page, role) {
  await page.evaluate(({ key, role }) => {
    const state = JSON.parse(localStorage.getItem(key));
    state.ui ||= {};
    state.authSettings ||= {};
    state.ui.role = role;
    state.ui.adultUnlocked = role !== 'student';
    state.authSettings.lastAdultRole = role === 'student' ? 'parent' : role;
    state.authSettings.adultUnlockExpiresAt = role === 'student'
      ? ''
      : new Date(Date.now() + 60 * 60 * 1000).toISOString();
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: stateKey, role });
  await page.reload();
}

async function expectActiveScreen(page, screen) {
  await expect(page.locator(`#screen-${screen}`)).toHaveClass(/\bactive\b/);
  await expect(page.locator(`#screen-${screen}`)).toBeVisible();
}

async function activatePublicControl(page, selector) {
  const control = page.locator(selector).first();
  await expect(control).toHaveCount(1);
  await expect(control).not.toHaveClass(/\bv26-hidden-by-role\b/);
  await control.dispatchEvent('click');
}

async function openPublicScreen(page, screen) {
  await activatePublicControl(page, `[data-screen="${screen}"]:not(.v26-hidden-by-role)`);
  await expectActiveScreen(page, screen);
}

async function visibleControlCount(page, screen) {
  return page.locator(`[data-screen="${screen}"]`).evaluateAll(nodes => nodes.filter(node => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return !node.classList.contains('v26-hidden-by-role')
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && rect.width > 0
      && rect.height > 0;
  }).length);
}

const matrix = [
  { role: 'student', headline: 'Student Mode', allowed: 'study', denied: 'questions' },
  { role: 'parent', headline: 'Parent View', allowed: 'assignments', denied: 'questions' },
  { role: 'teacher', headline: 'Teacher Workspace', allowed: 'questions', denied: 'director' },
  { role: 'director', headline: 'Director Rollup', allowed: 'director', denied: 'questions' },
  { role: 'admin', headline: 'Admin / Builder View', allowed: 'data', denied: null }
];

for (const item of matrix) {
  test(`${item.role} role keeps its public navigation and dock boundary`, async ({ page }, testInfo) => {
    test.setTimeout(60000);
    await loadDemo(page);
    await setRole(page, item.role);
    await expect(page.locator('#roleHeadline')).toHaveText(item.headline);

    const dock = page.locator('#blh-mobile-dock');
    if (item.role === 'student') {
      await expect(dock).toHaveAttribute('aria-hidden', 'false');
      await expect(page.locator('body')).toHaveClass(/\bv73-student-shell\b/);
      if (testInfo.project.name === 'chromium-mobile') await expect(dock).toBeVisible();
      else await expect(dock).toBeHidden();
    } else {
      await expect(dock).toHaveAttribute('aria-hidden', 'true');
      await expect(dock).toBeHidden();
      await expect(page.locator('body')).not.toHaveClass(/\bv73-student-shell\b/);
    }

    await openPublicScreen(page, item.allowed);
    await openPublicScreen(page, 'home');

    if (item.denied) {
      expect(await visibleControlCount(page, item.denied)).toBe(0);
      const deniedControls = page.locator(`[data-screen="${item.denied}"]`);
      if (await deniedControls.count()) {
        await deniedControls.first().dispatchEvent('click');
        await expectActiveScreen(page, 'home');
        await expect(page.locator(`#screen-${item.denied}`)).not.toHaveClass(/\bactive\b/);
      }
    }
  });
}

test('sign-in surface lists all three demo learners and all adult roles', async ({ page }) => {
  test.setTimeout(60000);
  await loadDemo(page);
  await openPublicScreen(page, 'signin');
  await expect(page.locator('[data-signin-student]')).toHaveCount(3);
  for (const studentId of ['stu_jordan', 'stu_avery', 'stu_guest']) {
    await expect(page.locator(`[data-signin-student="${studentId}"]`)).toHaveCount(1);
  }
  for (const role of ['parent', 'teacher', 'director', 'admin']) {
    await expect(page.locator(`[data-signin-role="${role}"]`)).toHaveCount(1);
  }
});

test('student workspace keeps adult controls out of view', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  await loadDemo(page);
  await setRole(page, 'student');
  await expect(page.locator('#roleHeadline')).toHaveText('Student Mode');
  await expect(page.locator('#roleSelect')).toBeHidden();
  await expect(page.locator('#quickLoginSelect')).toBeHidden();

  for (const screen of ['questions', 'director']) {
    expect(await visibleControlCount(page, screen)).toBe(0);
  }

  const dock = page.locator('#blh-mobile-dock');
  await expect(dock).toHaveAttribute('aria-hidden', 'false');
  if (testInfo.project.name === 'chromium-mobile') await expect(dock).toBeVisible();
  else await expect(dock).toBeHidden();
});
