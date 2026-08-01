import { test, expect } from '@playwright/test';

test.describe('v10.39.1 console and observer stability', () => {
  test('settles without legacy page errors or a mutation storm', async ({ page }) => {
    const pageErrors = [];
    const legacyConsoleFailures = [];

    page.on('pageerror', error => pageErrors.push(String(error)));
    page.on('console', message => {
      if (!['warning', 'error'].includes(message.type())) return;
      const text = message.text();
      if (/VERSION is not defined|BLH v10\.18 (?:initial )?apply skipped/.test(text)) {
        legacyConsoleFailures.push(text);
      }
    });

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-console-stability', 'v10.39.1');
    await expect(page.locator('html')).toHaveAttribute('data-legacy-observers-retired', '9');
    await expect(page).toHaveTitle('Beaufort Learning Harbor v10.39.1');

    await page.waitForTimeout(1000);
    const mutationCount = await page.evaluate(async () => {
      let count = 0;
      const observer = new MutationObserver(records => { count += records.length; });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
      observer.disconnect();
      return count;
    });

    expect(pageErrors, 'uncaught page errors after initial load').toEqual([]);
    expect(legacyConsoleFailures, 'legacy VERSION/apply warnings').toEqual([]);
    expect(mutationCount, `post-load DOM mutations: ${mutationCount}`).toBeLessThanOrEqual(500);
  });
});
