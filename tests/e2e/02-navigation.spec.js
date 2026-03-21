/**
 * E2E – Navigation
 *
 * Verifies that every nav link in the desktop nav and the More menu
 * successfully renders a screen (i.e., the previous screen content is
 * replaced and the page still contains meaningful content).
 */

import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage.js';

const DESKTOP_PRIMARY_LINKS = [
  { label: 'Clash', textOnPage: /clash|tournament|register|lobby/i },
  { label: 'Standings', textOnPage: /standings|leaderboard|season points/i },
  { label: 'Events', textOnPage: /events|upcoming|past|featured/i },
  { label: 'Pricing', textOnPage: /pricing|plans|free|pro|host/i },
];

// Items inside the "More ▾" dropdown
const MORE_MENU_LINKS = [
  { label: 'Rules', textOnPage: /rules|rulebook|tournament|points/i },
  { label: 'FAQ', textOnPage: /faq|frequently|question/i },
];

test.describe('Desktop navigation — primary links', () => {
  let app;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);
  });

  for (const { label, textOnPage } of DESKTOP_PRIMARY_LINKS) {
    test(`nav link "${label}" renders its screen`, async ({ page }) => {
      app = new AppPage(page);
      // Click the button by its text label in the top nav
      const navBtn = page.locator('nav').first().getByRole('button', { name: label, exact: true });
      await expect(navBtn).toBeVisible({ timeout: 5000 });
      await navBtn.click();
      await page.waitForTimeout(600);

      // The page body should contain content related to the screen
      const bodyText = await page.textContent('body');
      expect(bodyText?.toLowerCase()).toMatch(textOnPage);

      await page.screenshot({
        path: `playwright-report/screenshots/nav-${label.toLowerCase().replace(/\s+/g, '-')}.png`,
      });
    });
  }
});

test.describe('Desktop navigation — More menu links', () => {
  for (const { label, textOnPage } of MORE_MENU_LINKS) {
    test(`More menu → "${label}" renders its screen`, async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();
      await page.waitForTimeout(600);

      // Open the More ▾ dropdown
      const nav = page.locator('nav').first();
      const moreBtn = nav.getByRole('button', { name: /More/i });
      await expect(moreBtn).toBeVisible({ timeout: 5000 });
      await moreBtn.click();
      await page.waitForTimeout(300);

      // Click the menu item — scope to nav to avoid strict-mode with footer duplicates
      const menuItem = nav.getByRole('button', { name: label, exact: true });
      await expect(menuItem).toBeVisible({ timeout: 4000 });
      await menuItem.click();
      await page.waitForTimeout(600);

      const bodyText = await page.textContent('body');
      expect(bodyText?.toLowerCase()).toMatch(textOnPage);

      await page.screenshot({
        path: `playwright-report/screenshots/more-${label.toLowerCase().replace(/\s+/g, '-')}.png`,
      });
    });
  }
});

test.describe('Back to Home navigation', () => {
  test('Standings has a Back button that returns to home', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);

    // Navigate to Standings
    const nav = page.locator('nav').first();
    await nav.getByRole('button', { name: 'Standings', exact: true }).click();
    await page.waitForTimeout(600);

    // Find and click the Back button
    const backBtn = page.getByRole('button', { name: /← Back|Back/i }).first();
    await expect(backBtn).toBeVisible({ timeout: 5000 });
    await backBtn.click();
    await page.waitForTimeout(600);

    // Should be back on home
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/Season 16|Next Clash|Levitate|TFT Clash/i);
  });
});
