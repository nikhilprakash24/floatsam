import { expect, test, type Page } from '@playwright/test';

async function tapCanvas(page: Page): Promise<void> {
  await page.locator('canvas').click({ position: { x: 240, y: 360 } });
}

test('mute toggle persists across reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(500); // menu settle

  // Mute button sits at the top-left of the menu.
  await page.locator('canvas').click({ position: { x: 26, y: 26 } });
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('uf.muted')))
    .toBe('1');

  await page.reload();
  expect(await page.evaluate(() => window.localStorage.getItem('uf.muted'))).toBe('1');

  // And toggling back unmutes.
  await page.waitForTimeout(500);
  await page.locator('canvas').click({ position: { x: 26, y: 26 } });
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('uf.muted')))
    .toBe('0');
});

test('game pauses when the tab is hidden and resumes on tap', async ({ page }) => {
  await page.goto('/?seed=42');
  await expect(page.locator('canvas')).toBeVisible();
  // Start a run.
  for (let i = 0; i < 30; i++) {
    await tapCanvas(page);
    await page.waitForTimeout(150);
    const started = await page.evaluate(() => (window.__sim as { started?: boolean })?.started);
    if (started) break;
  }

  const setHidden = (hidden: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { value: h, configurable: true });
      Object.defineProperty(document, 'visibilityState', {
        value: h ? 'hidden' : 'visible',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);

  await setHidden(true);
  await page.waitForTimeout(300);
  const f1 = await page.evaluate(() => (window.__sim as { frame: number }).frame);
  await page.waitForTimeout(600);
  const f2 = await page.evaluate(() => (window.__sim as { frame: number }).frame);
  expect(f2).toBe(f1); // sim frozen while hidden

  await setHidden(false);
  await page.waitForTimeout(200);
  await tapCanvas(page); // dismiss the pause overlay
  await expect
    .poll(() => page.evaluate(() => (window.__sim as { frame: number }).frame))
    .toBeGreaterThan(f2);
});
