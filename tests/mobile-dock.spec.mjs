import { test, expect } from '@playwright/test';
import { releaseManifest } from './release-contract.mjs';

test.use({ viewport: { width: 390, height: 844 } });

test(`mobile dock stays a single stable five-action ${releaseManifest.release} node`, async ({ page }) => {
  await page.goto('/');
  const dock = page.locator('#blh-mobile-dock');
  await expect(dock).toHaveCount(1);
  await expect(dock).toHaveAttribute('data-owner', releaseManifest.dockOwner);
  await expect(dock.locator('[data-blh26-route]')).toHaveCount(5);
  await dock.evaluate(node => { node.dataset.testIdentity = 'stable-node'; });
  await page.waitForTimeout(1200);
  await expect(page.locator('#blh-mobile-dock[data-test-identity="stable-node"]')).toHaveCount(1);
});
