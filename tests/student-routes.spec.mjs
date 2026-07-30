import { test, expect } from '@playwright/test';

const stateKey = 'beaufortLearningHarbor.v10.19.state';

async function loadDemo(page) {
  await page.goto('/');
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('load-demo-family').click();
  await expect(page.getByTestId('demo-scenario-status')).toHaveText('Active sample progress');
}

async function selectStudent(page, studentId) {
  await page.evaluate(({ key, studentId }) => {
    const state = JSON.parse(localStorage.getItem(key));
    state.activeStudentId = studentId;
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: stateKey, studentId });
  await page.reload();
}

async function expectActiveScreen(page, screen) {
  await expect(page.locator(`#screen-${screen}`)).toHaveClass(/\bactive\b/);
  await expect(page.locator(`#screen-${screen}`)).toBeVisible();
}

const upperRoutes = [
  { route: 'learn', screen: 'lib-biology', assignment: 'learn-upper-biology-life' },
  { route: 'practice', screen: 'biology', assignment: 'practice-upper-biology-notebook' },
  { route: 'quiz', screen: 'quizzes-tests', assignment: 'quiz-upper-biology-check' },
  { route: 'proof', screen: 'assignments', assignment: 'proof-upper-latin-recitation' },
  { route: 'feedback', screen: 'portfolio', assignment: 'feedback-all-portfolio-review' }
];

const lowerRoutes = [
  { route: 'learn', screen: 'lib-botany', assignment: 'learn-lower-botany-plant-parts' },
  { route: 'practice', screen: 'botany', assignment: 'practice-lower-botany-sort-lab' },
  { route: 'quiz', screen: 'quizzes-tests', assignment: 'quiz-lower-science-check' },
  { route: 'proof', screen: 'assignments', assignment: null },
  { route: 'feedback', screen: 'portfolio', assignment: 'feedback-all-portfolio-review' }
];

for (const scenario of [
  { name: 'upper learner', studentId: 'stu_jordan', routes: upperRoutes },
  { name: 'lower learner', studentId: 'stu_avery', routes: lowerRoutes }
]) {
  test(`${scenario.name} dock routes stay exact and return home`, async ({ page }) => {
    await loadDemo(page);
    await selectStudent(page, scenario.studentId);

    const dock = page.locator('#blh-mobile-dock');
    await expect(dock).toBeVisible();
    await dock.evaluate(node => { node.dataset.routeMatrixIdentity = 'v10.34-stable'; });

    for (const item of scenario.routes) {
      await dock.locator(`[data-blh26-route="${item.route}"]`).click();
      await expectActiveScreen(page, item.screen);
      if (item.assignment) {
        await expect(page.locator(`[data-blh26-target-banner="${item.assignment}"]`)).toHaveCount(1);
      } else {
        await expect(page.locator('[data-blh26-target-banner]')).toHaveCount(0);
      }

      await page.evaluate(() => setScreen('home'));
      await expectActiveScreen(page, 'home');
      await expect(page.locator('#blh-mobile-dock[data-route-matrix-identity="v10.34-stable"]')).toHaveCount(1);
    }
  });
}

test('direct student screens open and return deterministically', async ({ page }) => {
  await loadDemo(page);
  await selectStudent(page, 'stu_jordan');

  for (const screen of ['lib-biology', 'biology', 'quizzes-tests', 'assignments', 'portfolio']) {
    const result = await page.evaluate(screenId => {
      setScreen(screenId);
      return {
        active: document.querySelector('.screen.active')?.id || '',
        role: activeRole(),
        allowed: roleCanAccess(screenId, activeRole())
      };
    }, screen);
    expect(result).toEqual({ active: `screen-${screen}`, role: 'student', allowed: true });
    await expectActiveScreen(page, screen);

    await page.evaluate(() => setScreen('home'));
    await expectActiveScreen(page, 'home');
  }
});
