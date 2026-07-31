import { test, expect } from '@playwright/test';
import { releaseManifest } from './release-contract.mjs';

test(`loads the synthetic ${releaseManifest.release} release`, async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(releaseManifest.title);
  await expect(page.locator('html')).toHaveAttribute('data-demo-build', releaseManifest.demoBuild);
  await expect(page.locator('html')).toHaveAttribute('data-release', releaseManifest.release);
  await expect(page.locator('html')).toHaveAttribute('data-route-contract', releaseManifest.routeContract);
  await expect(page.locator('html')).toHaveAttribute('data-destination-stability', releaseManifest.destinationStability);
  if (releaseManifest.dataAdapter) {
    await expect(page.locator('html')).toHaveAttribute('data-data-adapter', releaseManifest.dataAdapter);
    await expect(page.locator('html')).toHaveAttribute('data-data-schema', String(releaseManifest.dataSchema));
  }
  await expect(page.locator('#blh1033DemoNotice')).toHaveCount(1);
  await expect(page.getByTestId('load-demo-family')).toBeVisible();
  await expect(page.getByTestId('reset-demo-data')).toBeVisible();
  await expect(page.locator('.v25-title')).toHaveAttribute('data-blh-hero-owner', releaseManifest.heroOwner);
  await expect(page.locator('#blh-mobile-dock')).toHaveCount(1);
});
