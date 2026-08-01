import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

const stateKey = 'beaufortLearningHarbor.v10.19.state';

async function loadDemo(page) {
  await page.goto('/');
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('load-demo-family').click();
  await expect(page.getByTestId('demo-scenario-status')).toHaveText('Active sample progress');
  await stabilize(page);
}

async function stabilize(page) {
  await page.addStyleTag({ content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
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
  await stabilize(page);
}

async function openScreen(page, screen) {
  const control = page.locator(`[data-screen="${screen}"]:not(.v26-hidden-by-role)`).first();
  await expect(control).toHaveCount(1);
  await control.dispatchEvent('click');
  await expect(page.locator(`#screen-${screen}`)).toHaveClass(/\bactive\b/);
  await stabilize(page);
}

async function visualBuffer(locator) {
  await expect(locator).toBeVisible();
  return locator.screenshot({ animations:'disabled' });
}

function expectVisualMatch(baselineBuffer, actualBuffer, name, maxDiffRatio) {
  const baseline = PNG.sync.read(baselineBuffer);
  const actual = PNG.sync.read(actualBuffer);
  expect(actual.width, `${name} width`).toBe(baseline.width);
  expect(actual.height, `${name} height`).toBe(baseline.height);
  let diffPixels = 0;
  for (let index = 0; index < actual.data.length; index += 4) {
    const red = Math.abs(baseline.data[index] - actual.data[index]);
    const green = Math.abs(baseline.data[index + 1] - actual.data[index + 1]);
    const blue = Math.abs(baseline.data[index + 2] - actual.data[index + 2]);
    const alpha = Math.abs(baseline.data[index + 3] - actual.data[index + 3]);
    if (Math.max(red, green, blue, alpha) > 36) diffPixels += 1;
  }
  const ratio = diffPixels / (actual.width * actual.height);
  expect(ratio, `${name} pixel difference ${ratio}`).toBeLessThanOrEqual(maxDiffRatio);
}

test.describe('v10.39 repeat-render visual baselines', () => {
  test.skip(({ browserName }, testInfo) => browserName !== 'chromium' || testInfo.project.name !== 'chromium-desktop', 'Visual baselines are Linux desktop Chromium contracts.');

  test('upper learner home path survives a route cycle without visual drift', async ({ page }) => {
    await loadDemo(page);
    const homePath = page.locator('#screen-home .blh26-student-path').first();
    const baseline = await visualBuffer(homePath);
    await page.locator('[data-blh26-open="learn-upper-biology-life"]').first().dispatchEvent('click');
    await expect(page.locator('#screen-lib-biology')).toHaveClass(/\bactive\b/);
    await openScreen(page, 'home');
    const actual = await visualBuffer(page.locator('#screen-home .blh26-student-path').first());
    expectVisualMatch(baseline, actual, 'student-jordan-home-path', 0.01);
  });

  test('lower learner target banner survives return and reopen without visual drift', async ({ page }) => {
    await loadDemo(page);
    await page.evaluate(key => { const state=JSON.parse(localStorage.getItem(key)); state.activeStudentId='stu_avery'; localStorage.setItem(key, JSON.stringify(state)); }, stateKey);
    await page.reload();
    await stabilize(page);
    const route = page.locator('[data-blh26-open="learn-lower-botany-plant-parts"]').first();
    await route.dispatchEvent('click');
    await expect(page.locator('#screen-lib-botany')).toHaveClass(/\bactive\b/);
    const banner = page.locator('#screen-lib-botany [data-blh26-target-banner="learn-lower-botany-plant-parts"]');
    const baseline = await visualBuffer(banner);
    await openScreen(page, 'home');
    await page.locator('[data-blh26-open="learn-lower-botany-plant-parts"]').first().dispatchEvent('click');
    await stabilize(page);
    const actual = await visualBuffer(page.locator('#screen-lib-botany [data-blh26-target-banner="learn-lower-botany-plant-parts"]'));
    expectVisualMatch(baseline, actual, 'student-avery-botany-target', 0.01);
  });

  test('parent planner and director rollup survive route cycles without visual drift', async ({ page }) => {
    await loadDemo(page);
    await setRole(page, 'parent');
    await openScreen(page, 'familyplanner');
    const parentBaseline = await visualBuffer(page.locator('#screen-familyplanner .fp-heading').first());
    await openScreen(page, 'assignments');
    await openScreen(page, 'familyplanner');
    const parentActual = await visualBuffer(page.locator('#screen-familyplanner .fp-heading').first());
    expectVisualMatch(parentBaseline, parentActual, 'parent-planner-heading', 0.01);

    await setRole(page, 'director');
    await openScreen(page, 'familyplanner');
    const directorBaseline = await visualBuffer(page.getByTestId('family-planner-director-rollup'));
    await openScreen(page, 'director');
    await openScreen(page, 'familyplanner');
    const directorActual = await visualBuffer(page.getByTestId('family-planner-director-rollup'));
    expectVisualMatch(directorBaseline, directorActual, 'director-planner-rollup', 0.01);
  });
});
