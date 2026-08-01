import { test, expect } from '@playwright/test';

const stateKey = 'beaufortLearningHarbor.v10.19.state';
const roles = ['student', 'parent', 'teacher', 'director', 'admin'];

async function loadDemo(page) {
  await page.goto('/');
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('load-demo-family').click();
  await expect(page.getByTestId('demo-scenario-status')).toHaveText('Active sample progress');
}

async function activeRelease(page) {
  const release = await page.locator('html').getAttribute('data-release');
  expect(release).toMatch(/^v\d+\.\d+(?:\.\d+)?$/);
  return release;
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

test('active release exposes one read-only app-shell role-policy contract', async ({ page }) => {
  await loadDemo(page);
  const release = await activeRelease(page);
  await expect(page.locator('html')).toHaveAttribute('data-app-shell-role-policy', release);
  await expect(page.locator('html')).toHaveAttribute('data-app-shell-role-policy-schema', '1');

  const result = await page.evaluate(() => {
    const policy = window.BLHAppShellPolicy;
    const runtime = window.BLHRolePolicyRuntime;
    const snapshot = policy.snapshot();
    return {
      policyVersion: policy.version,
      policySchema: policy.schema,
      runtimeVersion: runtime.version,
      runtimeSchema: runtime.schema,
      roleIds: policy.roleIds,
      roleOptions: policy.roleOptions(),
      screenCount: snapshot.screenCount,
      catalogIds: policy.catalog().map(screen => screen.id),
      unknownRole: policy.roleCanAccessStatic('home', 'owner'),
      unknownScreen: policy.roleCanAccessStatic('missing-screen', 'admin'),
      unknownDefault: policy.defaultScreen('owner')
    };
  });

  expect(result.policyVersion).toBe(release);
  expect(result.policySchema).toBe(1);
  expect(result.runtimeVersion).toBe(release);
  expect(result.runtimeSchema).toBe(1);
  expect(result.roleIds).toEqual(roles);
  expect(result.roleOptions.map(role => role.id)).toEqual(roles);
  expect(result.screenCount).toBeGreaterThan(50);
  expect(new Set(result.catalogIds).size).toBe(result.catalogIds.length);
  expect(result.unknownRole).toBe(false);
  expect(result.unknownScreen).toBe(false);
  expect(result.unknownDefault).toBeNull();
});

for (const role of roles) {
  test(`${role} runtime remains parity-clean with the active static policy`, async ({ page }) => {
    test.setTimeout(60000);
    await loadDemo(page);
    await setRole(page, role);

    const result = await page.evaluate(role => {
      const policy = window.BLHAppShellPolicy;
      const runtime = window.BLHRolePolicyRuntime;
      const catalog = policy.catalog();
      const staticScreens = catalog.filter(screen => policy.roleCanAccessStatic(screen.id, role)).map(screen => screen.id);
      const runtimeScreens = catalog.filter(screen => runtime.canAccess(screen.id, role)).map(screen => screen.id);
      const catalogMismatches = catalog
        .filter(screen => policy.roleCanAccessStatic(screen.id, role) !== screen.roles.includes(role))
        .map(screen => screen.id);
      const runtimeEscapes = runtimeScreens.filter(screen => !staticScreens.includes(screen));
      return {
        staticScreens,
        runtimeScreens,
        catalogMismatches,
        runtimeEscapes,
        defaultScreen: runtime.defaultScreen(role),
        navGroups: runtime.navGroups(role).map(group => group.id),
        roleOptionIds: runtime.roleOptions().map(option => option.id)
      };
    }, role);

    expect(result.catalogMismatches).toEqual([]);
    expect(result.runtimeEscapes).toEqual([]);
    expect(result.defaultScreen).toBe('home');
    expect(result.navGroups.length).toBeGreaterThan(0);
    expect(new Set(result.navGroups).size).toBe(result.navGroups.length);
    expect(result.roleOptionIds).toEqual(roles);

    if (role !== 'student') expect(result.runtimeScreens.sort()).toEqual(result.staticScreens.sort());
    else {
      expect(result.runtimeScreens).toContain('home');
      expect(result.runtimeScreens).not.toContain('data');
      expect(result.runtimeScreens).not.toContain('questions');
      expect(result.runtimeScreens).not.toContain('director');
    }
  });
}

test('student direct-route attempts to adult-only surfaces fail closed to Home', async ({ page }) => {
  await loadDemo(page);
  await setRole(page, 'student');
  for (const screen of ['data', 'questions', 'director', 'lessonpacks', 'familyplanner']) {
    const outcome = await page.evaluate(screen => {
      const control = document.querySelector(`[data-screen="${screen}"]`);
      if (control) control.dispatchEvent(new MouseEvent('click', { bubbles:true }));
      return {
        canAccess: window.BLHRolePolicyRuntime.canAccess(screen, 'student'),
        active: document.querySelector('.screen.active')?.id || ''
      };
    }, screen);
    expect(outcome.canAccess).toBe(false);
    expect(outcome.active).toBe('screen-home');
  }
});
