import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const current = JSON.parse(await readFile(new URL('../source/current-release.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL(`../${current.manifest}`, import.meta.url), 'utf8'));
const productVersion = manifest.release.replace(/^v/, '');
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

async function openPlanner(page) {
  const control = page.locator('[data-screen="familyplanner"]:not(.v26-hidden-by-role)').first();
  await expect(control).toHaveCount(1);
  await control.dispatchEvent('click');
  await expect(page.locator('#screen-familyplanner')).toHaveClass(/\bactive\b/);
  await expect(page.locator('#screen-familyplanner')).toBeVisible();
}

async function plannerState(page) {
  return page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key));
    return state.ui?.familyPlanner || null;
  }, stateKey);
}

async function protectedSlices(page) {
  return page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key));
    const progress = Object.fromEntries(Object.entries(state.progress || {}).map(([studentId, value]) => {
      const record = value || {};
      const meaningfulPortfolioFlags = Object.fromEntries(Object.entries(record.portfolioFlags || {}).filter(([, flags]) =>
        !!(flags?.approved || flags?.hidden || flags?.showcase)
      ));
      return [studentId, {
        xp: Number(record.xp || 0),
        teamPoints: Number(record.teamPoints || 0),
        streak: Number(record.streak || 0),
        assignments: record.assignments || {},
        attendance: record.attendance || {},
        assessments: record.assessments || {},
        rewardLedger: record.rewardLedger || {},
        rewardAudit: record.rewardAudit || [],
        rubricReviews: record.rubricReviews || {},
        portfolioFlags: meaningfulPortfolioFlags,
        portfolioReflections: record.portfolioReflections || [],
        masteryArena: {
          notes: record.masteryArena?.notes || [],
          tierPreference: record.masteryArena?.tierPreference || 'auto',
          viewed: record.masteryArena?.viewed || {}
        }
      }];
    }));
    return {
      progress,
      assignments: state.assignments || [],
      lessonPacks: state.ui?.lessonPackEditor?.drafts || [],
      attendance: state.sessionLogs || [],
      portfolio: state.portfolioArtifacts || []
    };
  }, stateKey);
}

test('adult creates, filters, carries over, exports, imports, and persists a weekly co-op item without reward side effects', async ({ page }) => {
  test.setTimeout(100000);
  await loadDemo(page);
  await setRole(page, 'parent');
  await openPlanner(page);

  const protectedBefore = await protectedSlices(page);
  await expect(page.getByTestId('family-planner-new')).toBeVisible();
  await page.getByTestId('family-planner-new').click();
  await page.getByTestId('family-planner-title').fill('Synthetic co-op science day');
  await page.locator('#fpDay').selectOption('Tuesday');
  await page.locator('#fpType').selectOption('co-op');
  await page.locator('#fpStart').fill('09:00');
  await page.locator('#fpEnd').fill('10:30');
  await page.locator('#fpSubject').fill('Honors Biology');
  await page.locator('#fpLocation').fill('Synthetic Community Room');
  await page.getByTestId('family-planner-directions').fill('Complete the original synthetic lab and explain the model.');
  await page.getByTestId('family-planner-coop').check();
  await page.locator('#fpCoOpEvent').fill('Synthetic lab day');
  await page.locator('#fpCoOpRole').fill('Teacher lead');
  await page.locator('#fpCoOpMaterials').fill('Paper cards and safe household objects');
  await page.locator('#fpCoOpArrival').fill('Arrive ten minutes early.');
  await page.locator('#fpCoOpFollowUp').fill('Parent reviewer');
  await page.getByTestId('family-planner-adult-notes').fill('Adult-only coordination marker.');
  await page.getByTestId('family-planner-save').click();

  const card = page.getByTestId('family-planner-item').filter({ hasText:'Synthetic co-op science day' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Teacher lead');
  await expect(card).not.toContainText('Adult-only coordination marker.');

  const afterSave = await plannerState(page);
  const sourceWeek = afterSave.weeks.find(week => week.weekId === afterSave.activeWeekId);
  expect(sourceWeek.items).toHaveLength(1);
  expect(sourceWeek.items[0].coOp.enabled).toBe(true);
  expect(sourceWeek.items[0].adultNotes).toBe('Adult-only coordination marker.');
  expect(await protectedSlices(page)).toEqual(protectedBefore);

  const targetWeekId = await page.locator('#fpCarryTarget option').evaluateAll((options, active) => options.map(option => option.value).find(value => value && value !== active), afterSave.activeWeekId);
  expect(targetWeekId).toBeTruthy();
  await page.locator('#fpCarryTarget').selectOption(targetWeekId);
  await page.getByTestId('family-planner-carryover').click();
  const afterCarry = await plannerState(page);
  expect(afterCarry.weeks.find(week => week.weekId === afterSave.activeWeekId).items).toHaveLength(1);
  const carried = afterCarry.weeks.find(week => week.weekId === targetWeekId).items;
  expect(carried).toHaveLength(1);
  expect(carried[0]).toMatchObject({ status:'carryover', carriedFromId:sourceWeek.items[0].id });
  expect(await protectedSlices(page)).toEqual(protectedBefore);

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('family-planner-export').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`beaufort-learning-harbor-family-planner-v${productVersion}.json`);
  const exportedPath = await download.path();
  expect(exportedPath).toBeTruthy();
  const exported = JSON.parse(await readFile(exportedPath, 'utf8'));
  expect(exported).toMatchObject({
    format:'beaufort-learning-harbor-family-planner',
    kind:'family-planner-workspace',
    productVersion,
    schemaVersion:1
  });
  expect(exported.planner.weeks.flatMap(week => week.items)).toHaveLength(2);

  await page.reload();
  await openPlanner(page);
  await expect(page.getByTestId('family-planner-item').filter({ hasText:'Synthetic co-op science day' })).toBeVisible();

  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('family-planner-import-file').setInputFiles(exportedPath);
  await expect.poll(async () => (await plannerState(page)).weeks.flatMap(week => week.items).length).toBe(2);
  expect(await protectedSlices(page)).toEqual(protectedBefore);
});

test('source seeding is idempotent, source-safe, and linked from existing adult workflows', async ({ page }) => {
  test.setTimeout(80000);
  await loadDemo(page);
  await setRole(page, 'teacher');
  await page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key));
    state.ui ||= {};
    state.ui.lessonPackEditor ||= { version:'v10.37', activePackId:'', drafts:[] };
    state.ui.lessonPackEditor.drafts.push({
      id:'lp_seed_synthetic',
      title:'Synthetic seeded lesson pack',
      subject:'Botany',
      track:'Lower learner',
      targetWeekId:state.currentWeekId,
      targetScreen:'botany',
      status:'ready',
      objective:'Explain a synthetic plant observation.',
      sections:[{ id:'section_seed', title:'Learn', body:'Original synthetic content.' }],
      practicePrompts:[],
      labPrompts:[],
      mediaNeeds:{ heroImage:false, supportingImages:false, diagramOrMap:false, sourceLicenseReview:false, altText:false, notes:'' },
      noEquipmentPath:{ enabled:false, directions:'', evidence:'' },
      adultNotes:'',
      sourceDraftId:'',
      applyMode:'draft-only',
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString()
    });
    localStorage.setItem(key, JSON.stringify(state));
  }, stateKey);
  await page.reload();

  const protectedBefore = await protectedSlices(page);
  const assignmentsButton = page.locator('[data-screen="assignments"]:not(.v26-hidden-by-role)').first();
  await assignmentsButton.dispatchEvent('click');
  await expect(page.locator('#screen-assignments [data-fp-entry-link]')).toContainText('Family/Co-op Planner');
  await page.locator('#screen-assignments [data-fp-entry-link] [data-screen="familyplanner"]').click();
  await expect(page.locator('#screen-familyplanner')).toHaveClass(/\bactive\b/);

  await page.getByTestId('family-planner-seed').click();
  const first = await plannerState(page);
  const currentWeek = first.weeks.find(week => week.weekId === first.activeWeekId);
  const sourceKeys = currentWeek.items.map(item => `${item.sourceScreen}:${item.sourceId}`);
  expect(sourceKeys).toContain('lessonpacks:lp_seed_synthetic');
  expect(sourceKeys.some(key => key.startsWith('assignments:'))).toBe(true);
  expect(new Set(sourceKeys).size).toBe(sourceKeys.length);

  await page.getByTestId('family-planner-seed').click();
  const second = await plannerState(page);
  expect(second.weeks.find(week => week.weekId === second.activeWeekId).items).toHaveLength(currentWeek.items.length);
  expect(await protectedSlices(page)).toEqual(protectedBefore);
});

test('malformed and dangerous planner packages fail closed; student is denied and director is read-only', async ({ page }) => {
  test.setTimeout(80000);
  await loadDemo(page);
  await setRole(page, 'admin');
  await openPlanner(page);
  await page.getByTestId('family-planner-new').click();
  const before = JSON.stringify(await plannerState(page));

  await page.getByTestId('family-planner-import-file').setInputFiles({
    name:'malformed.json',
    mimeType:'application/json',
    buffer:Buffer.from('{bad json')
  });
  await expect.poll(async () => JSON.stringify(await plannerState(page))).toBe(before);

  const dangerous = `{"format":"beaufort-learning-harbor-family-planner","schemaVersion":1,"kind":"family-planner-workspace","productVersion":"${productVersion}","planner":{"activeWeekId":"week_1","weeks":[{"weekId":"week_1","mode":"standard","familyNotes":"","coOpNotes":"","items":[{"id":"fp_bad","title":"Bad","day":"Monday","startTime":"","endTime":"","targetKind":"all","targetId":"","subject":"","itemType":"lesson","status":"planned","location":"Home","sourceScreen":"","sourceId":"","coOp":{"enabled":false},"studentDirections":"Explain.","adultNotes":"","order":0,"__proto__":{"polluted":true}}]}]}}`;
  await page.getByTestId('family-planner-import-file').setInputFiles({
    name:'dangerous.json',
    mimeType:'application/json',
    buffer:Buffer.from(dangerous)
  });
  await expect.poll(async () => JSON.stringify(await plannerState(page))).toBe(before);
  expect(await page.evaluate(() => Object.prototype.polluted)).toBeUndefined();

  await setRole(page, 'student');
  const studentControls = page.locator('[data-screen="familyplanner"]');
  if (await studentControls.count()) await expect(studentControls.first()).toHaveClass(/\bv26-hidden-by-role\b/);
  await expect(page.getByTestId('family-planner-new')).toHaveCount(0);
  await expect(page.getByTestId('family-planner-import')).toHaveCount(0);
  await expect(page.getByTestId('family-planner-export')).toHaveCount(0);
  await expect(page.locator('[data-fp-entry-link]')).toHaveCount(0);

  await setRole(page, 'director');
  await openPlanner(page);
  await expect(page.getByTestId('family-planner-director-rollup')).toBeVisible();
  await expect(page.getByTestId('family-planner-new')).toHaveCount(0);
  await expect(page.getByTestId('family-planner-import')).toHaveCount(0);
  await expect(page.getByTestId('family-planner-export')).toHaveCount(0);
});

test('family planner remains width-stable on Pixel 7', async ({ page }) => {
  await page.setViewportSize({ width:412, height:915 });
  await loadDemo(page);
  await setRole(page, 'parent');
  await openPlanner(page);
  await page.getByTestId('family-planner-new').click();
  await expect(page.getByTestId('family-planner-board')).toBeVisible();
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
