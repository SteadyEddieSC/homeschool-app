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
  }, { key: stateKey, role });
  await page.reload();
}

async function seedReadyPack(page) {
  await page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key));
    state.ui ||= {};
    state.ui.lessonPackEditor = {
      version: 'v10.43',
      activePackId: 'lp_controlled_apply_test',
      drafts: [{
        id: 'lp_controlled_apply_test',
        title: 'Synthetic controlled apply ecology pack',
        subject: 'Botany',
        track: 'Lower learner',
        targetWeekId: state.currentWeekId || '',
        targetScreen: 'botany',
        status: 'ready',
        objective: 'Explain how a synthetic marsh plant supports an invented habitat.',
        sections: [
          { id: 'section_learn', title: 'Learn', body: 'Read the original synthetic marsh explanation.' },
          { id: 'section_compare', title: 'Compare', body: 'Compare two invented plant structures.' }
        ],
        practicePrompts: ['Name one synthetic structure.', 'Explain one synthetic function.'],
        labPrompts: ['Build a safe index-card habitat model.'],
        mediaNeeds: {
          heroImage: true,
          supportingImages: true,
          diagramOrMap: true,
          sourceLicenseReview: true,
          altText: true,
          notes: 'Use an approved public-domain marsh diagram.'
        },
        noEquipmentPath: {
          enabled: true,
          directions: 'Use labeled index cards instead of a computer or lab kit.',
          evidence: 'Show the labeled layout and explain it aloud.'
        },
        adultNotes: 'PRIVATE ADULT SOURCE NOTE 1043',
        applyMode: 'draft-only',
        sourceDraftId: '',
        createdAt: '2026-08-02T12:00:00.000Z',
        updatedAt: '2026-08-02T12:00:00.000Z'
      }]
    };
    localStorage.setItem(key, JSON.stringify(state));
  }, stateKey);
  await page.reload();
}

async function openScreen(page, screen) {
  const control = page.locator(`[data-screen="${screen}"]:not(.v26-hidden-by-role)`).first();
  await expect(control).toHaveCount(1);
  await control.dispatchEvent('click');
  await expect(page.locator(`#screen-${screen}`)).toHaveClass(/\bactive\b/);
}

async function applyWorkspace(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)).ui?.lessonPackControlledApply || {}, stateKey);
}

test('reviewed Lesson Pack apply is selective, student-safe, duplicate-safe, role-bound, and reversible', async ({ page }) => {
  test.setTimeout(120000);
  await loadDemo(page);
  await setRole(page, 'parent');
  await seedReadyPack(page);
  await openScreen(page, 'lessonpacks');

  const panel = page.getByTestId('lesson-pack-controlled-apply');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('lesson-pack-apply-comparison')).toContainText('Before · active destination state');
  await expect(page.getByTestId('lesson-pack-apply-comparison')).toContainText('After · proposed student-safe overlay');
  await expect(page.getByTestId('lesson-pack-confirm-apply')).toBeDisabled();

  await panel.locator('[data-lpa-field="contentRightsAttested"]').check();
  await page.getByTestId('lesson-pack-controlled-apply').locator('[data-lpa-field="mediaLicenseReviewed"]').check();
  await page.getByTestId('lesson-pack-controlled-apply').locator('[data-lpa-field="mediaProvenanceReviewed"]').check();
  await page.getByTestId('lesson-pack-controlled-apply').locator('[data-lpa-field="auditNote"]').fill('PRIVATE ADULT APPLY NOTE 1043');
  await expect(page.getByTestId('lesson-pack-confirm-apply')).toBeEnabled();
  await page.getByTestId('lesson-pack-confirm-apply').click();

  await expect.poll(async () => (await applyWorkspace(page)).overlays?.length || 0).toBe(1);
  let workspace = await applyWorkspace(page);
  expect(workspace.overlays[0].status).toBe('active');
  expect(workspace.audit).toHaveLength(1);
  expect(workspace.audit[0].action).toBe('apply');

  const sourceAfterApply = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).ui.lessonPackEditor.drafts[0], stateKey);
  expect(sourceAfterApply.adultNotes).toBe('PRIVATE ADULT SOURCE NOTE 1043');
  expect(sourceAfterApply.status).toBe('ready');
  expect(sourceAfterApply.applyMode).toBe('draft-only');

  await openScreen(page, 'botany');
  const destination = page.getByTestId('lesson-pack-active-overlay');
  await expect(destination).toContainText('Synthetic controlled apply ecology pack');
  await expect(destination).toContainText('Use labeled index cards');
  await expect(destination).not.toContainText('PRIVATE ADULT APPLY NOTE 1043');
  await expect(destination).not.toContainText('PRIVATE ADULT SOURCE NOTE 1043');
  await expect(destination).not.toContainText('rightsAttested');
  await expect(destination).not.toContainText('Rollback active overlay');

  await openScreen(page, 'lessonpacks');
  await page.getByTestId('lesson-pack-controlled-apply').locator('[data-lpa-field="auditNote"]').fill('Attempt identical apply');
  await page.getByTestId('lesson-pack-confirm-apply').click();
  await expect.poll(async () => (await applyWorkspace(page)).overlays?.length || 0).toBe(1);

  await setRole(page, 'student');
  await openScreen(page, 'botany');
  await expect(page.getByTestId('lesson-pack-active-overlay')).toContainText('Synthetic controlled apply ecology pack');
  await expect(page.getByTestId('lesson-pack-controlled-apply')).toHaveCount(0);
  await expect(page.getByTestId('lesson-pack-rollback')).toHaveCount(0);

  await setRole(page, 'director');
  await openScreen(page, 'lessonpacks');
  await expect(page.locator('#screen-lessonpacks').getByTestId('lesson-pack-apply-director-rollup')).toContainText('Read-only overlay rollup');
  await expect(page.getByTestId('lesson-pack-confirm-apply')).toHaveCount(0);
  await expect(page.getByTestId('lesson-pack-rollback')).toHaveCount(0);

  await setRole(page, 'parent');
  await openScreen(page, 'lessonpacks');
  const parentPanel = page.locator('#screen-lessonpacks').getByTestId('lesson-pack-controlled-apply');
  await expect(parentPanel).toBeVisible();
  await parentPanel.locator('[data-lpa-rollback-note]').fill('Return to the prior destination state after review.');
  const rollbackButton = parentPanel.getByTestId('lesson-pack-rollback');
  await expect(rollbackButton).toBeVisible();
  await rollbackButton.click();
  await expect.poll(async () => (await applyWorkspace(page)).overlays?.[0]?.status).toBe('rolled-back');
  workspace = await applyWorkspace(page);
  expect(workspace.audit.at(-1).action).toBe('rollback');

  await openScreen(page, 'botany');
  await expect(page.getByTestId('lesson-pack-active-overlay')).toHaveCount(0);
  const sourceAfterRollback = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).ui.lessonPackEditor.drafts[0], stateKey);
  expect(sourceAfterRollback.adultNotes).toBe('PRIVATE ADULT SOURCE NOTE 1043');
  expect(sourceAfterRollback.status).toBe('ready');
});
