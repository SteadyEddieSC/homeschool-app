import { test, expect } from '@playwright/test';

test('loads the sanitized v10.32 baseline', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Beaufort Learning Harbor v10\.32/);
  await expect(page.locator('html')).toHaveAttribute('data-demo-build', 'synthetic');
  await expect(page.locator('#blh-mobile-dock')).toHaveCount(1);
});
