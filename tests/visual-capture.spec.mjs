import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('captures the mobile student experience for review', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.screenshot({ path: testInfo.outputPath('mobile-student.png'), fullPage: true });
  await expect(page.locator('#blh-mobile-dock')).toHaveCount(1);
});
