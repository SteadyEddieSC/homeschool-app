import { test, expect } from '@playwright/test';
import { releaseManifest } from './release-contract.mjs';

const stateKey = 'beaufortLearningHarbor.v10.19.state';
const routes = [
  { route: 'learn', screen: 'lib-biology', assignment: 'learn-upper-biology-life', visual: true },
  { route: 'practice', screen: 'biology', assignment: 'practice-upper-biology-notebook' },
  { route: 'quiz', screen: 'quizzes-tests', assignment: 'quiz-upper-biology-check' },
  { route: 'proof', screen: 'assignments', assignment: 'proof-upper-latin-recitation' },
  { route: 'feedback', screen: 'portfolio', assignment: 'feedback-all-portfolio-review' }
];

async function loadDemo(page) {
  await page.goto('/');
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('load-demo-family').click();
  await expect(page.getByTestId('demo-scenario-status')).toHaveText('Active sample progress');
  await page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key));
    state.activeStudentId = 'stu_jordan';
    state.ui = { ...(state.ui || {}), role: 'student' };
    localStorage.setItem(key, JSON.stringify(state));
  }, stateKey);
  await page.reload();
  await expect(page.locator('#activeStudentName')).toHaveText('Jordan');
}

async function returnHome(page) {
  const home = page.locator('[data-screen="home"]').first();
  await expect(home).toHaveCount(1);
  await home.evaluate(element => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
  await expect(page.locator('#screen-home')).toHaveClass(/\bactive\b/);
}

test('Pixel 7 destinations retain stable nodes and widths after routing', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile', 'The reported regression is mobile-specific.');
  test.setTimeout(100000);
  await loadDemo(page);

  const dock = page.locator('#blh-mobile-dock');
  await expect(dock).toBeVisible();
  await dock.evaluate((node, identity) => { node.dataset.destinationStabilityIdentity = identity; }, releaseManifest.destinationStability);

  for (const item of routes) {
    const control = dock.locator(`[data-blh26-route="${item.route}"]`);
    await expect(control).toHaveCount(1);
    await control.evaluate(element => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));

    const screen = page.locator(`#screen-${item.screen}`);
    await expect(screen).toHaveClass(/\bactive\b/);
    await expect(screen).toBeVisible();
    await expect(page.locator(`[data-blh26-target-banner="${item.assignment}"]`)).toHaveCount(1);
    await page.waitForFunction(screenId => [...document.querySelectorAll(`#${screenId} img`)].every(img => img.complete), `screen-${item.screen}`);
    await page.waitForTimeout(1800);

    const result = await page.evaluate(async ({ screenId, requireVisual }) => {
      const node = document.getElementById(screenId);
      if (!node) return { missing: true };
      node.dataset.destinationScreenIdentity = 'stable';
      const visual = node.querySelector('.blh-visual-model');
      if (visual) visual.dataset.destinationVisualIdentity = 'stable';
      const target = requireVisual ? visual : node;
      if (!target) return { missingVisual: true };

      const widths = [target.getBoundingClientRect().width];
      let childMutations = 0;
      const mutations = new MutationObserver(records => {
        childMutations += records.filter(record => record.type === 'childList').length;
      });
      mutations.observe(target, { childList: true, subtree: true });
      const resize = new ResizeObserver(() => {
        widths.push(target.getBoundingClientRect().width);
      });
      resize.observe(target);
      await new Promise(resolve => setTimeout(resolve, 1800));
      mutations.disconnect();
      resize.disconnect();

      return {
        missing: false,
        missingVisual: false,
        sameScreen: document.getElementById(screenId) === node && node.dataset.destinationScreenIdentity === 'stable',
        sameVisual: !requireVisual || node.querySelector('.blh-visual-model[data-destination-visual-identity="stable"]') === visual,
        stillActive: node.classList.contains('active'),
        childMutations,
        widthSpread: Math.max(...widths) - Math.min(...widths)
      };
    }, { screenId: `screen-${item.screen}`, requireVisual: Boolean(item.visual) });

    expect(result.missing).toBeFalsy();
    expect(result.missingVisual).toBeFalsy();
    expect(result.sameScreen).toBeTruthy();
    expect(result.sameVisual).toBeTruthy();
    expect(result.stillActive).toBeTruthy();
    expect(result.widthSpread).toBeLessThanOrEqual(1);
    if (item.visual) expect(result.childMutations).toBe(0);
    await expect(page.locator(`#blh-mobile-dock[data-destination-stability-identity="${releaseManifest.destinationStability}"]`)).toHaveCount(1);
    await returnHome(page);
  }
});
