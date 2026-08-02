import { readFile } from 'node:fs/promises';
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
    state.authSettings.adultUnlockExpiresAt = role === 'student' ? '' : new Date(Date.now() + 3600000).toISOString();
    localStorage.setItem(key, JSON.stringify(state));
  }, { key:stateKey, role });
  await page.reload();
}

async function openPlanner(page) {
  const control = page.locator('[data-screen="familyplanner"]:not(.v26-hidden-by-role)').first();
  await expect(control).toHaveCount(1);
  await control.dispatchEvent('click');
  await expect(page.locator('#screen-familyplanner')).toHaveClass(/\bactive\b/);
}

async function plannerState(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)).ui?.familyPlanner || null, stateKey);
}

async function protectedSlices(page) {
  return page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key));
    return {
      progress:state.progress || {},
      assignments:state.assignments || [],
      lessonPacks:state.ui?.lessonPackEditor?.drafts || [],
      attendance:state.sessionLogs || [],
      portfolio:state.portfolioArtifacts || []
    };
  }, stateKey);
}

test('parent saves a reusable template, applies it idempotently, and rolls work forward without source-record changes', async ({ page }) => {
  test.setTimeout(100000);
  await loadDemo(page);
  await setRole(page, 'parent');
  await openPlanner(page);
  const protectedBefore = await protectedSlices(page);

  await expect(page.getByTestId('family-planner-v2-tools')).toBeVisible();
  await page.getByTestId('family-planner-new').click();
  await page.getByTestId('family-planner-title').fill('Synthetic reusable biology block');
  await page.locator('#fpDay').selectOption('Tuesday');
  await page.locator('#fpStart').fill('09:00');
  await page.locator('#fpEnd').fill('10:00');
  await page.getByTestId('family-planner-directions').fill('Complete the synthetic biology notebook block.');
  await page.getByTestId('family-planner-save').click();

  const sourceState = await plannerState(page);
  const sourceWeekId = sourceState.activeWeekId;
  const targetWeekId = await page.locator('#fpWeek option').evaluateAll((options, active) => options.map(option => option.value).find(value => value && value !== active), sourceWeekId);
  expect(targetWeekId).toBeTruthy();

  await page.getByTestId('family-planner-template-name').fill('Synthetic normal week');
  await page.getByTestId('family-planner-save-template').click();
  await expect.poll(async () => (await plannerState(page)).templates?.length || 0).toBe(1);

  await page.locator('#fpWeek').selectOption(targetWeekId);
  await page.getByTestId('family-planner-apply-template').click();
  await expect(page.getByTestId('family-planner-item').filter({ hasText:'Synthetic reusable biology block' })).toBeVisible();
  const afterFirstApply = await plannerState(page);
  const targetCount = afterFirstApply.weeks.find(week => week.weekId === targetWeekId).items.length;
  await page.getByTestId('family-planner-apply-template').click();
  const afterSecondApply = await plannerState(page);
  expect(afterSecondApply.weeks.find(week => week.weekId === targetWeekId).items).toHaveLength(targetCount);

  await page.getByTestId('family-planner-v2-target-week').selectOption(sourceWeekId);
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('family-planner-roll-forward').click();
  const afterRoll = await plannerState(page);
  const sourceWeek = afterRoll.weeks.find(week => week.weekId === targetWeekId);
  const destinationWeek = afterRoll.weeks.find(week => week.weekId === sourceWeekId);
  expect(sourceWeek.items).toHaveLength(targetCount);
  expect(destinationWeek.items.some(item => item.status === 'carryover' && item.carriedFromId.startsWith(`roll-forward:${targetWeekId}:`))).toBe(true);
  expect(await protectedSlices(page)).toEqual(protectedBefore);
});

test('analysis surfaces conflicts and responsibility gaps while learner-safe print and CSV omit adult notes', async ({ page }) => {
  test.setTimeout(90000);
  await loadDemo(page);
  await setRole(page, 'teacher');
  await page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key));
    const weekId = state.currentWeekId || state.curriculum?.weeks?.[0]?.id;
    const now = new Date().toISOString();
    const base = {
      day:'Wednesday', startTime:'09:00', endTime:'10:30', targetKind:'student', targetId:state.students?.[0]?.id || 'avery', subject:'Biology', itemType:'co-op', status:'planned', location:'Synthetic Room', sourceScreen:'', sourceId:'', studentDirections:'Complete the synthetic shared lab.', adultNotes:'PRIVATE ADULT COORDINATION', order:0, carriedFromId:'', createdAt:now, updatedAt:now
    };
    state.ui ||= {};
    state.ui.familyPlanner = {
      version:'v10.42', activeWeekId:weekId, activeItemId:'fp_conflict_a', filters:{ target:'all', track:'all', day:'all', itemType:'all', status:'active' }, templates:[], activeTemplateId:'', printPreview:false,
      weeks:[{ weekId, mode:'standard', familyNotes:'Family-facing note', coOpNotes:'PRIVATE COOP NOTE', updatedAt:now, items:[
        { ...base, id:'fp_conflict_a', title:'Synthetic overlap A', coOp:{ enabled:true, eventName:'Synthetic lab', role:'', materials:'Paper cards', arrivalNotes:'PRIVATE ARRIVAL', followUpOwner:'' } },
        { ...base, id:'fp_conflict_b', title:'Synthetic overlap B', startTime:'10:00', endTime:'11:00', order:1, coOp:{ enabled:false, eventName:'', role:'', materials:'', arrivalNotes:'', followUpOwner:'' } }
      ]}]
    };
    localStorage.setItem(key, JSON.stringify(state));
  }, stateKey);
  await page.reload();
  await openPlanner(page);

  const analysis = page.getByTestId('family-planner-v2-analysis');
  await expect(analysis).toBeVisible();
  await expect(analysis).toContainText('Time conflicts');
  await expect(analysis).toContainText('Synthetic overlap A overlaps Synthetic overlap B');
  await expect(analysis).toContainText('missing role and follow-up owner');

  await page.getByTestId('family-planner-print-preview').click();
  const preview = page.getByTestId('family-planner-print-summary');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('Synthetic overlap A');
  await expect(preview).not.toContainText('PRIVATE ADULT COORDINATION');
  await expect(preview).not.toContainText('PRIVATE COOP NOTE');
  await expect(preview).not.toContainText('PRIVATE ARRIVAL');

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('family-planner-csv').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/beaufort-learning-harbor-week-.*-v10\.42\.csv/);
  const path = await download.path();
  const csv = await readFile(path, 'utf8');
  expect(csv).toContain('Synthetic overlap A');
  expect(csv).not.toContain('PRIVATE');
});

test('student remains denied while director receives a read-only v2 analysis rollup', async ({ page }) => {
  await loadDemo(page);
  await setRole(page, 'student');
  await expect(page.getByTestId('family-planner-v2-tools')).toHaveCount(0);
  await expect(page.getByTestId('family-planner-save-template')).toHaveCount(0);
  await expect(page.getByTestId('family-planner-csv')).toHaveCount(0);

  await setRole(page, 'director');
  await openPlanner(page);
  await expect(page.getByTestId('family-planner-director-rollup')).toBeVisible();
  await expect(page.getByTestId('family-planner-v2-analysis')).toBeVisible();
  await expect(page.getByTestId('family-planner-v2-tools')).toHaveCount(0);
  await expect(page.getByTestId('family-planner-save-template')).toHaveCount(0);
});

test('Family Planner v2 controls remain width-stable on Pixel 7', async ({ page }) => {
  await page.setViewportSize({ width:412, height:915 });
  await loadDemo(page);
  await setRole(page, 'parent');
  await openPlanner(page);
  await expect(page.getByTestId('family-planner-v2-tools')).toBeVisible();
  await expect(page.getByTestId('family-planner-v2-analysis')).toBeVisible();
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
