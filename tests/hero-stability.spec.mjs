import { test, expect } from '@playwright/test';
import { releaseManifest } from './release-contract.mjs';

test('hero title and home content remain stable after startup', async ({ page }) => {
  await page.goto('/');

  const hero = page.locator('.v25-title');
  const heading = hero.locator('h1');
  const kicker = hero.locator('.kicker');

  await expect(page).toHaveTitle(releaseManifest.title);
  await expect(hero).toHaveAttribute('data-blh-hero-owner', releaseManifest.heroOwner);
  await expect(heading).toHaveText('Beaufort Learning Harbor');
  await expect(kicker).toHaveText(`Offline-first learning harbor · ${releaseManifest.release}`);

  await page.waitForTimeout(2500);

  const stability = await page.evaluate(async () => {
    const hero = document.querySelector('.v25-title');
    const home = document.querySelector('#screen-home');
    const titleNode = document.querySelector('title');
    const heroMutations = [];
    const titleMutations = [];
    const samples = [];

    const heroObserver = new MutationObserver(records => {
      heroMutations.push(...records.map(record => record.type));
    });
    const titleObserver = new MutationObserver(records => {
      titleMutations.push(...records.map(record => record.type));
    });

    heroObserver.observe(hero, { childList: true, subtree: true, characterData: true });
    titleObserver.observe(titleNode, { childList: true, subtree: true, characterData: true });

    for (let index = 0; index < 16; index += 1) {
      samples.push({
        title: document.title,
        heading: hero.querySelector('h1')?.textContent || '',
        kicker: hero.querySelector('.kicker')?.textContent || '',
        home: home?.innerText || ''
      });
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    heroObserver.disconnect();
    titleObserver.disconnect();
    return {
      heroMutations,
      titleMutations,
      uniqueSamples: new Set(samples.map(sample => JSON.stringify(sample))).size
    };
  });

  expect(stability.heroMutations).toEqual([]);
  expect(stability.titleMutations).toEqual([]);
  expect(stability.uniqueSamples).toBe(1);
});
