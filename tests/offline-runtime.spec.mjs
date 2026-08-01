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
    state.authSettings.adultUnlockExpiresAt = role === 'student' ? '' : new Date(Date.now() + 60 * 60 * 1000).toISOString();
    localStorage.setItem(key, JSON.stringify(state));
  }, { key:stateKey, role });
  await page.reload();
}

async function openScreen(page, screen) {
  const control = page.locator(`[data-screen="${screen}"]:not(.v26-hidden-by-role)`).first();
  await expect(control).toHaveCount(1);
  await control.dispatchEvent('click');
  await expect(page.locator(`#screen-${screen}`)).toHaveClass(/\bactive\b/);
}

test('runtime guard blocks external fetch before network dispatch and exposes a local ledger', async ({ page }) => {
  const externalRequests = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (!['data:', 'blob:'].includes(url.protocol) && url.origin !== 'http://127.0.0.1:4173') externalRequests.push(request.url());
  });
  await loadDemo(page);
  await expect(page.getByTestId('offline-runtime-status')).toContainText('Offline-ready');
  const result = await page.evaluate(async () => {
    try {
      await fetch('https://example.invalid/collect');
      return { blocked:false };
    } catch (error) {
      return { blocked:true, code:error.code, message:error.message, snapshot:window.BLHOfflineRuntime.snapshot() };
    }
  });
  expect(result.blocked).toBe(true);
  expect(result.code).toBe('EXTERNAL_NETWORK_BLOCKED');
  expect(result.snapshot.blockedCount).toBe(1);
  expect(externalRequests).toEqual([]);
  await expect(page.getByTestId('offline-runtime-status')).toContainText('1 external attempt blocked');
});

test('student route and parent planner remain usable after the browser is switched offline', async ({ page, context }) => {
  test.setTimeout(90000);
  await loadDemo(page);
  await context.setOffline(true);

  const studentRoute = page.locator('[data-blh26-open="learn-upper-biology-life"]').first();
  await expect(studentRoute).toHaveCount(1);
  await studentRoute.dispatchEvent('click');
  await expect(page.locator('#screen-lib-biology')).toHaveClass(/\bactive\b/);
  await expect(page.locator('[data-blh26-target-banner="learn-upper-biology-life"]')).toHaveCount(1);

  await context.setOffline(false);
  await setRole(page, 'parent');
  await context.setOffline(true);
  await openScreen(page, 'familyplanner');
  await page.getByTestId('family-planner-new').click();
  await page.getByTestId('family-planner-title').fill('Offline synthetic planning item');
  await page.getByTestId('family-planner-directions').fill('Complete this browser-local planning item.');
  await page.getByTestId('family-planner-save').click();
  await expect(page.getByTestId('family-planner-item').filter({ hasText:'Offline synthetic planning item' })).toBeVisible();
  const snapshot = await page.evaluate(() => window.BLHOfflineRuntime.snapshot());
  expect(snapshot.blockedCount).toBe(0);
});
