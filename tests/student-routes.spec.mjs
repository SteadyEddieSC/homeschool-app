import { test, expect } from '@playwright/test';

const stateKey = 'beaufortLearningHarbor.v10.19.state';

async function loadDemo(page) {
  await page.goto('/');
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('load-demo-family').click();
  await expect(page.getByTestId('demo-scenario-status')).toHaveText('Active sample progress');
}

async function selectStudent(page, studentId, expectedName) {
  await page.evaluate(({ key, studentId }) => {
    const state = JSON.parse(localStorage.getItem(key));
    state.activeStudentId = studentId;
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: stateKey, studentId });
  await page.reload();
  await expect(page.locator('#activeStudentName')).toHaveText(expectedName);
  await expect(page.locator('#studentSelect')).toHaveValue(studentId);
}

async function expectActiveScreen(page, screen) {
  await expect(page.locator(`#screen-${screen}`)).toHaveClass(/\bactive\b/);
  await expect(page.locator(`#screen-${screen}`)).toBeVisible();
}

async function returnHome(page) {
  const homeControl = page.locator('[data-screen="home"]').first();
  await expect(homeControl).toHaveCount(1);
  await homeControl.dispatchEvent('click');
  await expectActiveScreen(page, 'home');
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
  { name: 'upper learner', studentId: 'stu_jordan', studentName: 'Jordan', routes: upperRoutes },
  { name: 'lower learner', studentId: 'stu_avery', studentName: 'Avery', routes: lowerRoutes }
]) {
  test(`${scenario.name} exact assignment controls open each target and return home`, async ({ page }) => {
    test.setTimeout(90000);
    await loadDemo(page);
    await selectStudent(page, scenario.studentId, scenario.studentName);

    const path = page.locator('#screen-home .blh26-student-path').first();
    await expect(path).toBeVisible();
    await expect(path).toContainText(`Next steps for ${scenario.studentName}`);

    for (const item of scenario.routes) {
      const control = item.assignment
        ? page.locator(`[data-blh26-open="${item.assignment}"]`).first()
        : path.locator(`[data-blh26-route="${item.route}"]`).first();
      await expect(control).toHaveCount(1);
      await control.dispatchEvent('click');

      await expectActiveScreen(page, item.screen);
      if (item.assignment) {
        await expect(page.locator(`[data-blh26-target-banner="${item.assignment}"]`)).toHaveCount(1);
      } else {
        await expect(page.locator('[data-blh26-target-banner]')).toHaveCount(0);
      }
      await returnHome(page);
      await expect(page.locator('#screen-home .blh26-student-path').first()).toContainText(`Next steps for ${scenario.studentName}`);
    }
  });
}

test('the visible Pixel 7 dock exposes all five exact routes without replacing its node', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile', 'The fixed dock is intentionally mobile-only.');
  test.setTimeout(90000);
  await loadDemo(page);
  await selectStudent(page, 'stu_jordan', 'Jordan');

  const dock = page.locator('#blh-mobile-dock');
  await expect(dock).toBeVisible();
  await dock.evaluate(node => { node.dataset.routeMatrixIdentity = 'v10.34-stable'; });

  for (const item of upperRoutes) {
    const control = dock.locator(`[data-blh26-route="${item.route}"]`);
    await control.dispatchEvent('click');
    await expectActiveScreen(page, item.screen);
    await expect(page.locator(`[data-blh26-target-banner="${item.assignment}"]`)).toHaveCount(1);
    await returnHome(page);
    await expect(page.locator('#blh-mobile-dock[data-route-matrix-identity="v10.34-stable"]')).toHaveCount(1);
  }
});
