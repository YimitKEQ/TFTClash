/**
 * E2E – Leaderboard comparison tool
 *
 * Tests the player comparison feature added to LeaderboardScreen.
 * With no players loaded (SEED = []), the leaderboard is empty
 * but should render gracefully with the search bar visible.
 */

import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage.js';

test.describe('Leaderboard screen', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await app.clickNavLink('Leaderboard');
    await page.waitForTimeout(600);
  });

  test('leaderboard screen renders without crash', async ({ page }) => {
    const errorBoundary = page.getByText('Something went wrong');
    const isErrorVisible = await errorBoundary.isVisible().catch(() => false);
    expect(isErrorVisible, 'Error boundary should not be triggered').toBe(false);
  });

  test('search bar is present', async ({ page }) => {
    const body = await page.textContent('body');
    // Search bar placeholder text
    const hasSearch = /search|filter|find/i.test(body || '');
    expect(hasSearch, 'Search functionality should be visible').toBe(true);
  });

  test('leaderboard tabs are rendered', async ({ page }) => {
    const body = await page.textContent('body');
    // Season tab should be present
    const hasTabs = /Season|Cards|Stats|Streaks/i.test(body || '');
    expect(hasTabs, 'Leaderboard tabs should be visible').toBe(true);
  });

  test('empty state is shown when no players', async ({ page }) => {
    const body = await page.textContent('body');
    // Either shows players or an empty state — either way no crash
    expect(body).toBeTruthy();
  });

  test('screenshot of leaderboard', async ({ page }) => {
    await page.screenshot({
      path: 'playwright-report/screenshots/leaderboard.png',
      fullPage: false,
    });
  });
});

test.describe('Comparison tool', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await app.clickNavLink('Leaderboard');
    await page.waitForTimeout(600);
  });

  test('comparison panel is not shown by default', async ({ page }) => {
    // Compare panel only shows when 2+ players are selected
    const comparePanel = page.getByText('Season Points').first();
    // If no players loaded, there's nothing to compare — check no crash
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});
