import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const current = JSON.parse(await readFile(new URL('../source/current-release.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL(`../${current.manifest}`, import.meta.url), 'utf8'));
const productVersion = manifest.release.replace(/^v/, '');
const stateKey = 'beaufortLearningHarbor.v10.19.state';
const legacyKey = 'blh20.curriculumDrafts.v1';

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

async function openLessonPacks(page) {
  const control = page.locator('[data-screen="lessonpacks"]:not(.v26-hidden-by-role)').first();
  await expect(control).toHaveCount(1);
  await control.dispatchEvent('click');
  await expect(page.locator('#screen-lessonpacks')).toHaveClass(/\bactive\b/);
  await expect(page.locator('#screen-lessonpacks')).toBeVisible();
}

async function savedLessonPacks(page) {
  return page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key));
    return state.ui?.lessonPackEditor?.drafts || [];
  }, stateKey);
}

test('adult builds, previews, exports, imports, and persists a reversible lesson pack', async ({ page }) => {
  test.setTimeout(90000);
  await loadDemo(page);
  await setRole(page, 'parent');
  await openLessonPacks(page);

  await expect(page.getByTestId('lesson-pack-new')).toBeVisible();
  await page.getByTestId('lesson-pack-new').click();
  await page.getByTestId('lesson-section-add').click();

  await page.getByTestId('lesson-pack-title').fill('Synthetic harbor ecology lesson');
  await page.getByTestId('lesson-pack-target').selectOption('biology');
  await page.getByTestId('lesson-pack-objective').fill('Explain how a synthetic tidal habitat supports two organisms.');

  const sections = page.locator('[data-lp-section-index]');
  await expect(sections).toHaveCount(2);
  await sections.nth(0).locator('[data-lp-section-title]').fill('Learn');
  await sections.nth(0).locator('[data-lp-section-body]').fill('Read the original synthetic habitat explanation.');
  await sections.nth(1).locator('[data-lp-section-title]').fill('Compare');
  await sections.nth(1).locator('[data-lp-section-body]').fill('Compare two invented organisms without copying a textbook.');

  await page.getByTestId('lesson-pack-practice').fill('Name one habitat feature.\nExplain one organism adaptation.');
  await page.getByTestId('lesson-pack-labs').fill('Create a safe paper food-web model.');
  await page.locator('#lpMediaHero').check();
  await page.locator('#lpMediaDiagram').check();
  await page.locator('#lpMediaLicense').check();
  await page.locator('#lpMediaAlt').check();
  await page.getByTestId('lesson-pack-media-notes').fill('Use a public-domain estuary diagram and original captions.');
  await page.getByTestId('lesson-pack-no-equipment').check();
  await page.locator('#lpNoEquipmentDirections').fill('Use index cards to model the habitat and organisms.');
  await page.locator('#lpNoEquipmentEvidence').fill('Submit a labeled card layout and a two-minute explanation.');
  await page.getByTestId('lesson-pack-adult-notes').fill('Adult-only planning marker.');
  await page.getByTestId('lesson-pack-save').click();

  const beforePreview = page.getByTestId('lesson-pack-before-preview');
  const studentPreview = page.getByTestId('lesson-pack-student-preview');
  await expect(beforePreview).toContainText('current live target');
  await expect(beforePreview).toContainText('No live apply occurs');
  await expect(studentPreview).toContainText('Synthetic harbor ecology lesson');
  await expect(studentPreview).toContainText('Compare two invented organisms');
  await expect(studentPreview).toContainText('No-equipment path');
  await expect(studentPreview).toContainText('public-domain estuary diagram');
  await expect(studentPreview).not.toContainText('Adult-only planning marker.');

  const saved = await savedLessonPacks(page);
  expect(saved).toHaveLength(1);
  expect(saved[0].sections).toHaveLength(2);
  expect(saved[0].applyMode).toBe('draft-only');
  expect(saved[0].noEquipmentPath.enabled).toBe(true);

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('lesson-pack-export').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(`beaufort-learning-harbor-lesson-pack-synthetic_harbor_ecology_lesson-v${productVersion}.json`);
  const exportedPath = await download.path();
  expect(exportedPath).toBeTruthy();
  const exported = JSON.parse(await readFile(exportedPath, 'utf8'));
  expect(exported).toMatchObject({
    format: 'beaufort-learning-harbor-lesson-pack',
    kind: 'lesson-pack-draft',
    productVersion,
    schemaVersion: 1
  });
  expect(exported.pack.adultNotes).toBe('Adult-only planning marker.');

  await page.reload();
  await openLessonPacks(page);
  await expect(page.getByTestId('lesson-pack-title')).toHaveValue('Synthetic harbor ecology lesson');

  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('lesson-pack-import-file').setInputFiles(exportedPath);
  await expect.poll(async () => (await savedLessonPacks(page)).length).toBe(1);
});

test('malformed package fails closed and legacy migration preserves source stores without duplicates', async ({ page }) => {
  test.setTimeout(60000);
  await loadDemo(page);
  await setRole(page, 'teacher');
  await page.evaluate(({ legacyKey }) => {
    const legacy = [{
      id: 'studio_synthetic_1',
      area: 'Botany',
      title: 'Synthetic legacy leaf lesson',
      track: 'Lower learner',
      goal: 'Describe a synthetic leaf structure.',
      lesson: 'Original legacy draft content.',
      assessment: 'Explain the structure in your own words.',
      media: 'Needs public-domain diagram and source review.',
      notes: 'Legacy adult note.'
    }];
    localStorage.setItem(legacyKey, JSON.stringify(legacy));
  }, { legacyKey });
  const legacyBefore = await page.evaluate(key => localStorage.getItem(key), legacyKey);
  await page.reload();
  await openLessonPacks(page);

  await page.getByTestId('lesson-pack-migrate').click();
  await expect.poll(async () => (await savedLessonPacks(page)).length).toBe(1);
  const migrated = await savedLessonPacks(page);
  expect(migrated[0]).toMatchObject({
    title: 'Synthetic legacy leaf lesson',
    subject: 'Botany',
    targetScreen: 'botany',
    sourceDraftId: 'studio_synthetic_1',
    applyMode: 'draft-only'
  });
  expect(await page.evaluate(key => localStorage.getItem(key), legacyKey)).toBe(legacyBefore);

  await page.getByTestId('lesson-pack-migrate').click();
  await expect.poll(async () => (await savedLessonPacks(page)).length).toBe(1);

  const beforeInvalid = JSON.stringify(await savedLessonPacks(page));
  await page.getByTestId('lesson-pack-import-file').setInputFiles({
    name: 'malformed.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad json')
  });
  await expect.poll(async () => JSON.stringify(await savedLessonPacks(page))).toBe(beforeInvalid);

  const dangerous = `{"format":"beaufort-learning-harbor-lesson-pack","schemaVersion":1,"kind":"lesson-pack-draft","productVersion":"${productVersion}","pack":{"id":"lp_bad","title":"Bad","subject":"Science","track":"All","targetScreen":"biology","targetWeekId":"","status":"draft","objective":"Explain.","sections":[{"id":"section_bad","title":"Learn","body":"Original."}],"practicePrompts":[],"labPrompts":[],"mediaNeeds":{},"noEquipmentPath":{"enabled":false},"__proto__":{"polluted":true}}}`;
  await page.getByTestId('lesson-pack-import-file').setInputFiles({
    name: 'dangerous.json',
    mimeType: 'application/json',
    buffer: Buffer.from(dangerous)
  });
  await expect.poll(async () => JSON.stringify(await savedLessonPacks(page))).toBe(beforeInvalid);
  expect(await page.evaluate(() => Object.prototype.polluted)).toBeUndefined();
});

test('student cannot access authoring and director receives a read-only rollup', async ({ page }) => {
  test.setTimeout(60000);
  await loadDemo(page);
  await setRole(page, 'student');

  const studentControls = page.locator('[data-screen="lessonpacks"]');
  if (await studentControls.count()) {
    await expect(studentControls.first()).toHaveClass(/\bv26-hidden-by-role\b/);
    await studentControls.first().dispatchEvent('click');
    await expect(page.locator('#screen-home')).toHaveClass(/\bactive\b/);
  }
  await expect(page.getByTestId('lesson-pack-new')).toHaveCount(0);
  await expect(page.getByTestId('lesson-pack-import')).toHaveCount(0);
  await expect(page.getByTestId('lesson-pack-export')).toHaveCount(0);
  await expect(page.getByTestId('lesson-pack-migrate')).toHaveCount(0);

  await setRole(page, 'director');
  await openLessonPacks(page);
  await expect(page.getByTestId('lesson-pack-director-rollup')).toBeVisible();
  await expect(page.getByTestId('lesson-pack-new')).toHaveCount(0);
  await expect(page.getByTestId('lesson-pack-import')).toHaveCount(0);
  await expect(page.getByTestId('lesson-pack-export')).toHaveCount(0);
  await expect(page.getByTestId('lesson-pack-migrate')).toHaveCount(0);
});
