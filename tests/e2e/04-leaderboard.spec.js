/**
 * E2E – Standings screen
 *
 * Verifies:
 * - Standings screen renders
 * - Search input is present and accepts text
 * - Sort dropdown is present
 * - Tab switcher (Leaderboard, Hall of Fame, Player Directory) works
 */

import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage.js';

test.describe('Standings screen', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);
    await app.clickNavLink('Standings');
    await page.waitForTimeout(700);
  });

  test('Standings screen renders content', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(50);
  });

  test('search input is present and accepts text', async ({ page }) => {
    // The search placeholder includes ellipsis: "Search players..."
    const searchInput = page.getByPlaceholder(/Search player/i);
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('test');
    await page.waitForTimeout(400);
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(50);
  });

  test('clearing search shows all results', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search player/i);
    await searchInput.fill('zzz_no_match_xyz');
    await page.waitForTimeout(300);
    await searchInput.fill('');
    await page.waitForTimeout(400);
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(50);
  });

  test('sort dropdown is present', async ({ page }) => {
    // Sort by dropdown (select element)
    const selects = page.locator('select');
    await expect(selects.first()).toBeVisible({ timeout: 5000 });
  });

  test('tab switcher buttons are visible', async ({ page }) => {
    // Current tabs: Leaderboard, Hall of Fame, Player Directory
    for (const tab of ['Leaderboard', 'Hall of Fame', 'Player Directory']) {
      const btn = page.getByRole('button', { name: tab });
      await expect(btn.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('clicking each tab does not crash the app', async ({ page }) => {
    // Scope tab clicks to the tab container (flex row of tab buttons) to avoid
    // hitting sidebar nav items with the same name (e.g. "Hall of Fame")
    const tabContainer = page.locator('div.flex.gap-2').filter({
      has: page.getByRole('button', { name: 'Player Directory' })
    }).first();
    for (const tab of ['Leaderboard', 'Hall of Fame', 'Player Directory']) {
      const btn = tabContainer.getByRole('button', { name: tab });
      await btn.click();
      await page.waitForTimeout(300);
    }
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(50);
  });

  test('standings shows expected content', async ({ page }) => {
    const bodyText = await page.textContent('body');
    const hasContent = /pts|season|standings|leaderboard|player|no data/i.test(bodyText || '');
    expect(hasContent).toBe(true);
  });

  test('screenshot of Standings', async ({ page }) => {
    await page.screenshot({
      path: 'playwright-report/screenshots/standings.png',
      fullPage: false,
    });
  });
});
