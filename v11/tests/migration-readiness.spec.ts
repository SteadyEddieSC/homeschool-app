import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { parseLegacyV1043Export } from '../src/migration/v1043-rehearsal';

async function openRehearsal(page: Page): Promise<void> {
  await page.goto('/?migration-rehearsal=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('migration-readiness-app')).toBeVisible();
}
async function preparePlan(page: Page): Promise<void> {
  await page.getByTestId('load-synthetic-fixture').click();
  await expect(page.getByTestId('fixture-status')).toHaveText('Validated synthetic fixture');
  await page.getByTestId('run-migration-dry-run').click();
  await expect(page.getByTestId('dry-run-write-count')).toHaveText('0');
  await expect(page.getByTestId('migration-operation-count')).not.toHaveText('0');
  await expect(page.getByTestId('migration-review-count')).toHaveText('3');
  await expect(page.getByTestId('migration-conflict-count')).toHaveText('0');
}
test.beforeEach(async ({ page }) => { await openRehearsal(page); });

test('strict synthetic dry-run generates a zero-write authority-aware plan', async ({ page }) => {
  await preparePlan(page);
  await expect(page.getByTestId('migration-operation-syn-assignment-quiz-001')).toContainText('update-review-required');
  await expect(page.getByTestId('migration-operation-syn-assignment-proof-001')).toContainText('update-review-required');
  await expect(page.getByTestId('migration-operation-syn-evidence-001')).toContainText('update-review-required');
  await expect(page.getByTestId('migration-operation-unsupported-xp-ledger')).toContainText('unsupported');
  await expect(page.getByTestId('migration-notice')).toContainText('was not written');
});

test('isolated apply is idempotent and rollback restores the exact checksum', async ({ page }) => {
  await preparePlan(page);
  await page.getByTestId('apply-migration-plan').click();
  const firstCount = Number(await page.getByTestId('applied-record-count').textContent());
  expect(firstCount).toBeGreaterThan(0);
  await page.getByTestId('repeat-migration-apply').click();
  await expect(page.getByTestId('applied-record-count')).toHaveText(String(firstCount));
  await expect(page.getByTestId('migration-notice')).toContainText('idempotently');
  await page.getByTestId('rollback-migration').click();
  await expect(page.getByTestId('rollback-status')).toHaveText('Exact pre-apply checksum restored');
  await expect(page.getByTestId('applied-record-count')).toHaveText('0');
  const normalStores = await page.evaluate(() => ({
    learning: localStorage.getItem('beaufortLearningHarbor.v11.beta1.learning'),
    studio: localStorage.getItem('beaufortLearningHarbor.v11.beta3.studio'),
    organization: localStorage.getItem('beaufortLearningHarbor.v11.preview.organization')
  }));
  expect(normalStores.learning).toBeNull();
  expect(normalStores.studio).toBeNull();
  expect(normalStores.organization).toBeNull();
});

test('encrypted vendor-exit and full recovery rehearsal report zero record loss', async ({ page }) => {
  await preparePlan(page);
  await page.getByTestId('apply-migration-plan').click();
  await page.getByTestId('vendor-exit-passphrase').fill('SyntheticRc1RecoveryPassphrase123!');
  await page.getByTestId('run-vendor-exit').click();
  await expect(page.getByTestId('vendor-exit-status')).toContainText('matching checksum');
  await page.getByTestId('run-recovery-rehearsal').click();
  await expect(page.getByTestId('recovery-rpo')).toHaveText('0 records lost');
  await expect(page.getByTestId('recovery-rto')).toContainText('measured RTO');
  await expect(page.getByTestId('rollback-status')).toHaveText('Exact pre-apply checksum restored');
});

test('production-ready request is downgraded and sanitized reports omit learner content', async ({ page }) => {
  await preparePlan(page);
  await page.getByTestId('apply-migration-plan').click();
  await page.getByTestId('vendor-exit-passphrase').fill('SyntheticRc1RecoveryPassphrase123!');
  await page.getByTestId('run-recovery-rehearsal').click();
  await page.getByTestId('owner-decision').selectOption('production-ready');
  await page.getByTestId('evaluate-readiness').click();
  await expect(page.getByTestId('readiness-decision')).toHaveText('Not ready for production');
  const receiptDownload = page.waitForEvent('download');
  await page.getByTestId('download-migration-receipt').click();
  const receiptPath = await (await receiptDownload).path();
  const receipt = JSON.parse(await readFile(receiptPath!, 'utf8')) as Record<string, unknown>;
  const receiptText = JSON.stringify(receipt);
  for (const forbidden of ['Synthetic Learner','Synthetic Harbor Household','Synthetic model explanation','password','payload','sb_secret_','service_role']) expect(receiptText).not.toContain(forbidden);
  const readinessDownload = page.waitForEvent('download');
  await page.getByTestId('download-readiness-report').click();
  const readinessPath = await (await readinessDownload).path();
  const readiness = JSON.parse(await readFile(readinessPath!, 'utf8')) as { productionReady?: boolean; effectiveDecision?: string; blockedProviderChecks?: unknown[] };
  expect(readiness.productionReady).toBe(false);
  expect(readiness.effectiveDecision).toBe('not-ready');
  expect(readiness.blockedProviderChecks?.length).toBeGreaterThan(0);
});

test('malformed, secret-bearing, and non-synthetic sources are rejected by the parser contract', async () => {
  const fixture = JSON.parse(await readFile(new URL('../public/fixtures/v10.43-synthetic-export.json', import.meta.url), 'utf8')) as Record<string, unknown>;
  const cases: Array<[string, string]> = [
    ['malformed', '{'],
    ['secret', JSON.stringify({ ...fixture, password: 'SyntheticPassword123!' })],
    ['non-synthetic', JSON.stringify({ ...fixture, synthetic: false })],
    ['unknown-field', JSON.stringify({ ...fixture, unexpected: true })]
  ];
  const results = cases.map(([name, value]) => {
    try { parseLegacyV1043Export(value); return { name, rejected: false, message: '' }; }
    catch (error) { return { name, rejected: true, message: error instanceof Error ? error.message : String(error) }; }
  });
  expect(results.every((result) => result.rejected)).toBe(true);
  expect(results.map((result) => result.message).join(' ')).not.toContain('SyntheticPassword123!');
});

test('migration workspace has no material horizontal overflow', async ({ page }) => {
  const overflow = await page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
