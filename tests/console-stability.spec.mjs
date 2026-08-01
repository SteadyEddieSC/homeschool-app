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
    await expect(page.locator('html')).toHaveAttribute('data-legacy-polls-retired', '15');
    await expect(page.locator('html')).toHaveAttribute('data-media-class-stability', 'v10.39.1');
    await expect(page).toHaveTitle('Beaufort Learning Harbor v10.39.1');

    await page.waitForTimeout(1000);
    const mutationResult = await page.evaluate(async () => {
      let count = 0;
      const summary = {};
      const targetName = node => {
        if (!node) return 'unknown';
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentElement;
          return `#text@${parent?.id || parent?.className || parent?.tagName || 'unknown'}`;
        }
        const id = node.id ? `#${node.id}` : '';
        const classes = typeof node.className === 'string' && node.className.trim()
          ? `.${node.className.trim().split(/\s+/).slice(0, 3).join('.')}`
          : '';
        return `${node.tagName || 'node'}${id}${classes}`;
      };
      const observer = new MutationObserver(records => {
        count += records.length;
        for (const record of records) {
          const key = `${record.type}|${targetName(record.target)}|${record.attributeName || ''}`;
          summary[key] = (summary[key] || 0) + 1;
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
      observer.disconnect();
      return {
        count,
        top: Object.entries(summary).sort((left, right) => right[1] - left[1]).slice(0, 12)
      };
    });

    expect(pageErrors, 'uncaught page errors after initial load').toEqual([]);
    expect(legacyConsoleFailures, 'legacy VERSION/apply warnings').toEqual([]);
    expect(
      mutationResult.count,
      `post-load DOM mutations: ${mutationResult.count}; top sources: ${JSON.stringify(mutationResult.top)}`
    ).toBeLessThanOrEqual(500);
  });
});
