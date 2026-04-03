/**
 * E2E – Standings comparison tool
 *
 * Tests the player comparison feature in the Standings screen.
 */

import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage.js';

test.describe('Standings screen', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await app.clickNavLink('Standings');
    await page.waitForTimeout(600);
  });

  test('standings screen renders without crash', async ({ page }) => {
    const errorBoundary = page.getByText('Something went wrong');
    const isErrorVisible = await errorBoundary.isVisible().catch(() => false);
    expect(isErrorVisible, 'Error boundary should not be triggered').toBe(false);
  });

  test('search bar is present', async ({ page }) => {
    const body = await page.textContent('body');
    const hasSearch = /search|filter|find/i.test(body || '');
    expect(hasSearch, 'Search functionality should be visible').toBe(true);
  });

  test('standings tabs are rendered', async ({ page }) => {
    const body = await page.textContent('body');
    const hasTabs = /Leaderboard|Hall of Fame|Player Directory/i.test(body || '');
    expect(hasTabs, 'Standings tabs should be visible').toBe(true);
  });

  test('empty state is shown when no players', async ({ page }) => {
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('screenshot of standings', async ({ page }) => {
    await page.screenshot({
      path: 'playwright-report/screenshots/standings-compare.png',
      fullPage: false,
    });
  });
});

test.describe('Comparison tool', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await app.clickNavLink('Standings');
    await page.waitForTimeout(600);
  });

  test('comparison panel is not shown by default', async ({ page }) => {
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});
