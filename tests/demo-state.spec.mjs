import { test, expect } from '@playwright/test';

const stateKey = 'beaufortLearningHarbor.v10.19.state';

test('loads deterministic active Demo Family data and persists it', async ({ page }) => {
  await page.goto('/');
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('load-demo-family').click();
  await expect(page.getByTestId('demo-scenario-status')).toHaveText('Active sample progress');

  const active = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), stateKey);
  expect(active.demoProfile).toMatchObject({ synthetic: true, familyName: 'Demo Family', scenario: 'active' });
  expect(active.progress.stu_jordan.xp).toBe(145);
  expect(active.progress.stu_avery.xp).toBe(88);
  expect(active.activity).toHaveLength(3);

  await page.reload();
  await expect(page.getByTestId('demo-scenario-status')).toHaveText('Active sample progress');
});

test('resets to the same fresh synthetic state on repeated runs', async ({ page }) => {
  await page.goto('/');
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('reset-demo-data').click();
  await expect(page.getByTestId('demo-scenario-status')).toHaveText('Fresh demo state');
  const first = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), stateKey);

  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('reset-demo-data').click();
  const second = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), stateKey);

  expect(first.demoProfile).toEqual(second.demoProfile);
  expect(first.progress.stu_jordan.xp).toBe(0);
  expect(first.progress.stu_avery.xp).toBe(0);
  expect(first.activity).toEqual([]);
  expect(second.progress.stu_jordan.xp).toBe(0);
  expect(second.progress.stu_avery.xp).toBe(0);
  expect(second.activity).toEqual([]);
});
