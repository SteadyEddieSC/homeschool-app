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
    state.ui.role = role;
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: stateKey, role });
  await page.reload();
  await page.waitForFunction(expected => typeof activeRole === 'function' && activeRole() === expected, role);
}

const matrix = [
  { role: 'student', headline: 'Student Mode', allowed: 'study', denied: 'data', dockVisible: true },
  { role: 'parent', headline: 'Parent View', allowed: 'schedule', denied: 'data', dockVisible: false },
  { role: 'teacher', headline: 'Teacher Workspace', allowed: 'questions', denied: 'data', dockVisible: false },
  { role: 'director', headline: 'Director Rollup', allowed: 'director', denied: 'questions', dockVisible: false },
  { role: 'admin', headline: 'Admin / Builder View', allowed: 'data', denied: null, dockVisible: false }
];

test('role access boundaries persist and redirect denied screens', async ({ page }) => {
  await loadDemo(page);

  for (const item of matrix) {
    await setRole(page, item.role);
    await expect(page.locator('#roleHeadline')).toHaveText(item.headline);

    const access = await page.evaluate(({ allowed, denied }) => ({
      role: activeRole(),
      allowed: roleCanAccess(allowed, activeRole()),
      denied: denied ? roleCanAccess(denied, activeRole()) : null
    }), item);
    expect(access.role).toBe(item.role);
    expect(access.allowed).toBe(true);
    if (item.denied) expect(access.denied).toBe(false);

    const dock = page.locator('#blh-mobile-dock');
    if (item.dockVisible) {
      await expect(dock).toBeVisible();
      await expect(dock).toHaveAttribute('aria-hidden', 'false');
      await expect(page.locator('body')).toHaveClass(/\bv73-student-shell\b/);
    } else {
      await expect(dock).toBeHidden();
      await expect(dock).toHaveAttribute('aria-hidden', 'true');
      await expect(page.locator('body')).not.toHaveClass(/\bv73-student-shell\b/);
    }

    await page.evaluate(screen => setScreen(screen), item.allowed);
    await expect(page.locator(`#screen-${item.allowed}`)).toHaveClass(/\bactive\b/);

    if (item.denied) {
      await page.evaluate(screen => setScreen(screen), item.denied);
      await expect(page.locator('#screen-home')).toHaveClass(/\bactive\b/);
      await expect(page.locator(`#screen-${item.denied}`)).not.toHaveClass(/\bactive\b/);
    }
  }
});

test('student mode consistently hides adult-only controls and screens', async ({ page }) => {
  await loadDemo(page);
  await setRole(page, 'student');

  for (const screen of ['data', 'questions', 'director', 'security']) {
    const allowed = await page.evaluate(screenId => roleCanAccess(screenId, activeRole()), screen);
    expect(allowed).toBe(false);
    await page.evaluate(screenId => setScreen(screenId), screen);
    await expect(page.locator('#screen-home')).toHaveClass(/\bactive\b/);
  }

  await expect(page.locator('#roleSelect')).toBeHidden();
  await expect(page.locator('#quickLoginSelect')).toBeHidden();
  await expect(page.locator('#blh-mobile-dock')).toBeVisible();
});
