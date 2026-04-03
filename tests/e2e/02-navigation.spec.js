/**
 * E2E – Navigation
 *
 * Verifies that desktop nav links and drawer menu items
 * successfully render their screens.
 *
 * Nav structure:
 * - Desktop nav (in header): Clash, Standings, Events, Stats, Hall of Fame, Pricing
 * - Drawer menu (hamburger): Rules, FAQ, and all other screens
 */

import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage.js';

const DESKTOP_PRIMARY_LINKS = [
  { label: 'Clash', textOnPage: /clash|tournament|register|lobby/i },
  { label: 'Standings', textOnPage: /standings|leaderboard|season points/i },
  { label: 'Events', textOnPage: /events|upcoming|past|featured/i },
  { label: 'Pricing', textOnPage: /pricing|plans|free|pro|host/i },
];

test.describe('Desktop navigation - primary links', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);
  });

  for (const { label, textOnPage } of DESKTOP_PRIMARY_LINKS) {
    test(`nav link "${label}" renders its screen`, async ({ page }) => {
      const app = new AppPage(page);
      const nav = page.locator('header nav').first();
      const navBtn = nav.getByRole('button', { name: label, exact: true });
      await expect(navBtn).toBeVisible({ timeout: 5000 });
      await navBtn.click();
      await page.waitForTimeout(600);

      const bodyText = await page.textContent('body');
      expect(bodyText?.toLowerCase()).toMatch(textOnPage);

      await page.screenshot({
        path: `playwright-report/screenshots/nav-${label.toLowerCase().replace(/\s+/g, '-')}.png`,
      });
    });
  }
});

test.describe('Drawer navigation - secondary links', () => {
  test('Drawer menu opens and shows navigation items', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);

    await app.openDrawer();
    await page.waitForTimeout(300);

    // Drawer should show menu items
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/Rules|FAQ|Archive|Results|Milestones/i);
  });

  test('Drawer -> Rules renders its screen', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);

    await app.clickDrawerItem('Rules');
    await page.waitForTimeout(600);

    const bodyText = await page.textContent('body');
    expect(bodyText?.toLowerCase()).toMatch(/rules|rulebook|tournament|points/i);
  });

  test('Drawer -> FAQ renders its screen', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);

    await app.clickDrawerItem('FAQ');
    await page.waitForTimeout(600);

    const bodyText = await page.textContent('body');
    expect(bodyText?.toLowerCase()).toMatch(/faq|frequently|question/i);
  });
});

test.describe('Home navigation via logo', () => {
  test('Clicking the logo returns to home', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);

    // Navigate away first
    await app.clickNavLink('Standings');
    await page.waitForTimeout(600);

    // Click the logo/brand in the header to go home
    const logo = page.locator('header').getByText('TFT CLASH').first();
    await logo.click();
    await page.waitForTimeout(600);

    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/TFT Clash|Season|Dashboard/i);
  });
});
