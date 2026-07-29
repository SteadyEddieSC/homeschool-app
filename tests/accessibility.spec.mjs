import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('student landing view has no critical axe violations', async ({ page }, testInfo) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  await testInfo.attach('axe-results', {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json'
  });
  const critical = results.violations.filter(item => item.impact === 'critical');
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
});
