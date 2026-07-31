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

async function openKnowledge(page) {
  const control = page.locator('[data-screen="knowledge"]:not(.v26-hidden-by-role)').first();
  await expect(control).toHaveCount(1);
  await control.dispatchEvent('click');
  await expect(page.locator('#screen-knowledge')).toHaveClass(/\bactive\b/);
  await expect(page.locator('#screen-knowledge')).toBeVisible();
}

async function savedPrompts(page) {
  return page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key));
    return state.ui?.knowledgeCheckBuilder?.prompts || [];
  }, stateKey);
}

test('adult builder creates, previews, exports, imports, and persists a subjective prompt', async ({ page }) => {
  test.setTimeout(90000);
  await loadDemo(page);
  await setRole(page, 'parent');
  await openKnowledge(page);

  await expect(page.getByTestId('knowledge-new')).toBeVisible();
  await page.getByTestId('knowledge-new').click();

  await page.getByTestId('knowledge-title').fill('Synthetic harbor history tell-back');
  await page.getByTestId('knowledge-type').selectOption('oral-tell-back');
  await page.getByTestId('knowledge-directions').fill('Explain the synthetic harbor event in your own words.');
  await page.getByTestId('knowledge-evidence').fill('Give a clear two-minute response and cite one synthetic course note.');
  await page.getByTestId('knowledge-return-language').fill('Adult-only return language marker.');
  await page.getByTestId('knowledge-approval-language').fill('Adult-only approval language marker.');
  await page.getByTestId('knowledge-adult-notes').fill('Adult-only planning note marker.');
  await page.getByTestId('knowledge-save').click();

  const preview = page.getByTestId('knowledge-student-preview');
  await expect(preview).toContainText('Synthetic harbor history tell-back');
  await expect(preview).toContainText('Explain the synthetic harbor event in your own words.');
  await expect(preview).toContainText('Give a clear two-minute response');
  await expect(preview).not.toContainText('Adult-only return language marker.');
  await expect(preview).not.toContainText('Adult-only approval language marker.');
  await expect(preview).not.toContainText('Adult-only planning note marker.');
  await expect(preview).toContainText('not auto-graded');

  const firstSaved = await savedPrompts(page);
  expect(firstSaved).toHaveLength(1);
  expect(firstSaved[0].type).toBe('oral-tell-back');

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('knowledge-export').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('beaufort-learning-harbor-knowledge-checks-v10.36.json');
  const exportedPath = await download.path();
  expect(exportedPath).toBeTruthy();

  await page.reload();
  await openKnowledge(page);
  await expect(page.getByTestId('knowledge-title')).toHaveValue('Synthetic harbor history tell-back');

  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('knowledge-import-file').setInputFiles(exportedPath);
  await expect.poll(async () => (await savedPrompts(page)).length).toBe(1);
  const imported = await savedPrompts(page);
  expect(imported[0].title).toBe('Synthetic harbor history tell-back');
});

test('malformed and dangerous imports fail closed without changing local state', async ({ page }) => {
  test.setTimeout(60000);
  await loadDemo(page);
  await setRole(page, 'teacher');
  await openKnowledge(page);
  await page.getByTestId('knowledge-new').click();
  const before = JSON.stringify(await savedPrompts(page));

  await page.getByTestId('knowledge-import-file').setInputFiles({
    name: 'malformed.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad json')
  });
  await expect.poll(async () => JSON.stringify(await savedPrompts(page))).toBe(before);

  const dangerous = '{"format":"beaufort-learning-harbor-knowledge-check-bank","schemaVersion":1,"kind":"knowledge-check-bank","productVersion":"10.36","prompts":[{"id":"kc_bad","title":"Bad","type":"recitation","subject":"History","track":"All learners","status":"draft","studentDirections":"Explain.","evidenceExpectations":"Show evidence.","criteria":["Clear"],"__proto__":{"polluted":true}}]}';
  await page.getByTestId('knowledge-import-file').setInputFiles({
    name: 'dangerous.json',
    mimeType: 'application/json',
    buffer: Buffer.from(dangerous)
  });
  await expect.poll(async () => JSON.stringify(await savedPrompts(page))).toBe(before);
  expect(await page.evaluate(() => Object.prototype.polluted)).toBeUndefined();
});

test('student cannot access authoring controls and director receives a read-only rollup', async ({ page }) => {
  test.setTimeout(60000);
  await loadDemo(page);
  await setRole(page, 'student');

  const studentControls = page.locator('[data-screen="knowledge"]');
  if (await studentControls.count()) {
    await expect(studentControls.first()).toHaveClass(/\bv26-hidden-by-role\b/);
    await studentControls.first().dispatchEvent('click');
    await expect(page.locator('#screen-home')).toHaveClass(/\bactive\b/);
  }
  await expect(page.getByTestId('knowledge-new')).toHaveCount(0);
  await expect(page.getByTestId('knowledge-import')).toHaveCount(0);
  await expect(page.getByTestId('knowledge-export')).toHaveCount(0);

  await setRole(page, 'director');
  await openKnowledge(page);
  await expect(page.getByTestId('knowledge-director-rollup')).toBeVisible();
  await expect(page.getByTestId('knowledge-new')).toHaveCount(0);
  await expect(page.getByTestId('knowledge-import')).toHaveCount(0);
  await expect(page.getByTestId('knowledge-export')).toHaveCount(0);
});
