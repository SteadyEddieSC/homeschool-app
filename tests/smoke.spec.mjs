import { test, expect } from '@playwright/test';

test('loads the synthetic v10.34.1 release', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Beaufort Learning Harbor v10\.34\.1/);
  await expect(page.locator('html')).toHaveAttribute('data-demo-build', 'synthetic');
  await expect(page.locator('html')).toHaveAttribute('data-release', 'v10.34.1');
  await expect(page.locator('html')).toHaveAttribute('data-route-contract', 'v10.34.1');
  await expect(page.locator('html')).toHaveAttribute('data-destination-stability', 'v10.34.1');
  await expect(page.locator('#blh1033DemoNotice')).toHaveCount(1);
  await expect(page.getByTestId('load-demo-family')).toBeVisible();
  await expect(page.getByTestId('reset-demo-data')).toBeVisible();
  await expect(page.locator('.v25-title')).toHaveAttribute('data-blh-hero-owner', 'BLHHero@v10.34.1');
  await expect(page.locator('#blh-mobile-dock')).toHaveCount(1);
});
