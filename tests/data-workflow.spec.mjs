import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const stateKey = 'beaufortLearningHarbor.v10.19.state';

async function loadDemo(page) {
  await page.goto('/');
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('load-demo-family').click();
  await expect(page.getByTestId('demo-scenario-status')).toHaveText('Active sample progress');
}

async function setAdminRole(page) {
  await page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key));
    state.ui ||= {};
    state.authSettings ||= {};
    state.ui.role = 'admin';
    state.ui.adultUnlocked = true;
    state.authSettings.lastAdultRole = 'admin';
    state.authSettings.adultPinHash = 'synthetic-browser-pin-hash';
    state.authSettings.pinHint = 'synthetic browser hint';
    state.authSettings.auditLog = [{ id: 'audit_browser_demo', action: 'synthetic browser action' }];
    state.authSettings.adultUnlockExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    state.backups = [{
      id: 'backup_browser_demo',
      label: 'Synthetic browser backup',
      createdAt: '2026-07-31T00:00:00.000Z',
      hash: 'synthetic-browser-backup-hash',
      bytes: 4321,
      snapshot: { students: [{ id: 'nested_demo', name: 'Nested Demo' }] }
    }];
    localStorage.setItem(key, JSON.stringify(state));
  }, stateKey);
  await page.reload();
  await expect(page.locator('#roleHeadline')).toHaveText('Admin / Builder View');
}

async function openDataScreen(page) {
  const control = page.locator('[data-screen="data"]:not(.v26-hidden-by-role)').first();
  await expect(control).toHaveCount(1);
  await control.dispatchEvent('click');
  await expect(page.locator('#screen-data')).toHaveClass(/\bactive\b/);
  await expect(page.locator('#exportStateBtn')).toBeVisible();
}

test('sanitized browser export uses the v10.35 schema envelope', async ({ page }) => {
  test.setTimeout(60000);
  await loadDemo(page);
  await setAdminRole(page);
  await openDataScreen(page);

  await expect(page.locator('html')).toHaveAttribute('data-data-adapter', 'v10.35');
  await expect(page.locator('html')).toHaveAttribute('data-data-schema', '1');
  await expect(page.locator('#exportStateBtn')).toHaveText('Download sanitized app data');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#exportStateBtn').click()
  ]);
  expect(download.suggestedFilename()).toBe('beaufort-learning-harbor-v10.35-data.json');
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const text = await readFile(downloadPath, 'utf8');
  expect(text.endsWith('\n')).toBe(true);

  const envelope = JSON.parse(text);
  expect(envelope).toMatchObject({
    format: 'beaufort-learning-harbor-data',
    kind: 'application-state',
    productVersion: '10.35',
    schemaVersion: 1
  });
  expect(envelope.state.students.map(student => student.name)).toEqual(expect.arrayContaining(['Jordan', 'Avery']));
  expect(Array.isArray(envelope.state.curriculum.weeks)).toBe(true);
  expect(envelope.state.demoProfile).toMatchObject({
    synthetic: true,
    familyName: 'Demo Family',
    scenario: 'active'
  });
  expect(envelope.state.authSettings.adultPinHash).toBe('');
  expect(envelope.state.authSettings.pinHint).toBe('');
  expect(envelope.state.authSettings.adultUnlockExpiresAt).toBe('');
  expect(envelope.state.authSettings.auditLog).toEqual([]);
  expect(envelope.state.backups[0].payloadOmitted).toBe(true);
  expect(envelope.state.backups[0].snapshot).toBeUndefined();
});

test('unsupported schema fails closed and versioned import then succeeds', async ({ page }) => {
  test.setTimeout(60000);
  await loadDemo(page);
  await setAdminRole(page);
  await openDataScreen(page);

  const beforeInvalid = await page.evaluate(key => localStorage.getItem(key), stateKey);
  const currentState = JSON.parse(beforeInvalid);
  const unsupported = JSON.stringify({
    format: 'beaufort-learning-harbor-data',
    kind: 'application-state',
    productVersion: '10.35',
    schemaVersion: 999,
    state: currentState
  });
  await page.locator('#importFile').setInputFiles({
    name: 'unsupported-schema.json',
    mimeType: 'application/json',
    buffer: Buffer.from(unsupported)
  });
  await expect(page.locator('#toast')).toContainText('UNSUPPORTED_SCHEMA');
  const afterInvalid = await page.evaluate(key => localStorage.getItem(key), stateKey);
  expect(afterInvalid).toBe(beforeInvalid);

  const versionedPayload = await page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key));
    state.programName = 'Imported Synthetic Harbor';
    return window.BLHDataAdapter.exportState(state, { productVersion: '10.35' });
  }, stateKey);
  await page.locator('#importFile').setInputFiles({
    name: 'beaufort-learning-harbor-v10.35-data.json',
    mimeType: 'application/json',
    buffer: Buffer.from(versionedPayload)
  });
  await expect(page.locator('#toast')).toContainText('Versioned app data imported');
  const imported = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), stateKey);
  expect(imported.programName).toBe('Imported Synthetic Harbor');
  expect(imported.demoProfile).toMatchObject({ familyName: 'Demo Family', scenario: 'active' });
  expect(imported.authSettings.adultPinHash).toBe('');
  expect(imported.authSettings.adultUnlockExpiresAt).toBe('');
});
