import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const root = process.cwd();

test('account access stays viewport-contained and uses themed segmented controls on a short desktop', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'short-desktop layout regression is covered once in the desktop project');

  const [baseCss, signInCss] = await Promise.all([
    readFile(path.join(root, 'src/styles.css'), 'utf8'),
    readFile(path.join(root, 'src/signin-access.css'), 'utf8')
  ]);

  await page.setViewportSize({ width: 900, height: 800 });
  await page.setContent(`<!doctype html>
    <html>
      <head><style>${baseCss}\n${signInCss}</style></head>
      <body>
        <main class="signin-shell">
          <section class="signin-card" data-testid="account-access-panel">
            <div class="brand-lockup centered">
              <span class="brand-mark" aria-hidden="true">BLH</span>
              <div><span class="eyebrow">Beaufort Learning Harbor</span><h1>Sign in to your group</h1></div>
            </div>
            <p class="signin-intro">Accounts, memberships, household relationships, and permissions are validated before shared records load.</p>
            <div class="segmented-control" role="tablist" aria-label="Account access choice">
              <button type="button" role="tab" aria-selected="true" class="active">Sign in</button>
              <button type="button" role="tab" aria-selected="false">Create account</button>
              <button type="button" role="tab" aria-selected="false">Reset password</button>
            </div>
            <form class="form-stack">
              <label><span>Email</span><input type="email" /></label>
              <label><span>Password</span><input type="password" /></label>
              <button class="button primary" type="button">Sign in</button>
            </form>
            <div class="privacy-callout"><strong>Identity bootstrap alpha</strong><span>New accounts create or join an organization after email confirmation. Invitations cannot grant System Administrator access.</span></div>
          </section>
        </main>
      </body>
    </html>`);

  const card = page.getByTestId('account-access-panel');
  await expect(card).toBeVisible();
  const bounds = await card.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(800);

  const viewportFits = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight);
  expect(viewportFits).toBe(true);

  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(3);
  const segmentedDisplay = await page.locator('.segmented-control').evaluate((element) => getComputedStyle(element).display);
  expect(segmentedDisplay).toBe('grid');

  const activeBackground = await tabs.nth(0).evaluate((element) => getComputedStyle(element).backgroundColor);
  const inactiveBackground = await tabs.nth(1).evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(activeBackground).not.toBe(inactiveBackground);

  const activeBorderWidth = await tabs.nth(0).evaluate((element) => getComputedStyle(element).borderTopWidth);
  expect(activeBorderWidth).toBe('0px');
});
