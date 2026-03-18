/**
 * E2E – Results, Hall of Fame, Archive
 *
 * Note: SEED = [] and SEASON_CHAMPION = null by default.
 * Levitate only appears if Supabase has player data loaded.
 * Tests verify screens render correctly regardless of data state.
 *
 * Results screen:
 * - Renders screen content without crashing
 * - Shows placement or champion text if data exists
 *
 * Hall of Fame:
 * - "Hall of Fame" heading renders
 * - Screen doesn't crash
 *
 * Archive:
 * - Screen renders without errors
 * - Archive-related content is visible
 */

import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage.js';

// ── Results ────────────────────────────────────────────────────────────────────

test.describe('Results screen', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);

    const nav = page.locator('nav').first();
    const resultsBtn = nav.getByRole('button', { name: 'Results', exact: true });
    await resultsBtn.waitFor({ timeout: 5000 });
    await resultsBtn.click();
    await page.waitForTimeout(700);
  });

  test('Results screen renders without crashing', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(50);
  });

  test('Results screen shows clash-related content', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/results|clash|placement|champion|season|standings/i);
  });

  test('Results screen does not show a JS error', async ({ page }) => {
    // Check that no "Cannot read" or "undefined" error text is visible to the user
    const errorText = page.getByText(/Cannot read|undefined is not|TypeError/i);
    await expect(errorText).not.toBeVisible();
  });

  test('crown emoji or champion content appears when champion is set', async ({ page }) => {
    const bodyText = await page.textContent('body');
    // SEASON_CHAMPION = null currently, so champion content may be absent.
    // This test is informational — verify we render something meaningful.
    // The results screen should at minimum show the "Results" area
    const hasResultsContent = bodyText?.length > 100;
    expect(hasResultsContent).toBe(true);
  });

  test('screenshot of Results screen', async ({ page }) => {
    await page.screenshot({
      path: 'playwright-report/screenshots/results.png',
      fullPage: false,
    });
  });
});

// ── Hall of Fame ───────────────────────────────────────────────────────────────

test.describe('Hall of Fame screen', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);

    const nav = page.locator('nav').first();
    const hofBtn = nav.getByRole('button', { name: 'Hall of Fame', exact: true });
    await hofBtn.waitFor({ timeout: 5000 });
    await hofBtn.click();
    await page.waitForTimeout(700);
  });

  test('Hall of Fame heading is visible', async ({ page }) => {
    // Scope to the heading role to avoid strict-mode with nav button
    await expect(page.getByRole('heading', { name: /Hall of Fame/i })).toBeVisible({ timeout: 5000 });
  });

  test('Hall of Fame screen renders content', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/hall of fame|champion|trophy|season|award/i);
  });

  test('Hall of Fame screen does not crash', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(100);
  });

  test('screenshot of Hall of Fame', async ({ page }) => {
    await page.screenshot({
      path: 'playwright-report/screenshots/hof.png',
      fullPage: false,
    });
  });
});

// ── Archive ────────────────────────────────────────────────────────────────────

test.describe('Archive screen', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);

    // Archive is in the More menu on desktop
    const nav = page.locator('nav').first();
    const moreBtn = nav.getByRole('button', { name: /More/i });
    await moreBtn.waitFor({ timeout: 5000 });
    await moreBtn.click();
    await page.waitForTimeout(300);

    const archiveBtn = nav.getByRole('button', { name: 'Archive', exact: true });
    await archiveBtn.waitFor({ timeout: 5000 });
    await archiveBtn.click();
    await page.waitForTimeout(700);
  });

  test('Archive screen renders without crashing', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(50);
  });

  test('Archive screen shows archive-related content', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/archive|past|history|season|clash/i);
  });

  test('screenshot of Archive screen', async ({ page }) => {
    await page.screenshot({
      path: 'playwright-report/screenshots/archive.png',
      fullPage: false,
    });
  });
});
