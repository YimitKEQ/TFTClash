/**
 * E2E – Clash, Events screens (replaced Results, HoF, Archive)
 *
 * After the UX overhaul:
 * - Results + Bracket → Clash (phase-adaptive)
 * - Archive + Featured → Events (filtered)
 * - Hall of Fame → Standings "legends" tab
 *
 * Tests verify the new screens render correctly.
 */

import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage.js';

// ── Clash ────────────────────────────────────────────────────────────────────

test.describe('Clash screen', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);

    const nav = page.locator('nav').first();
    const clashBtn = nav.getByRole('button', { name: 'Clash', exact: true });
    await clashBtn.waitFor({ timeout: 5000 });
    await clashBtn.click();
    await page.waitForTimeout(700);
  });

  test('Clash screen renders without crashing', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(50);
  });

  test('Clash screen shows tournament-related content', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/clash|tournament|register|lobby|bracket|round|phase/i);
  });

  test('Clash screen does not show a JS error', async ({ page }) => {
    const errorText = page.getByText(/Cannot read|undefined is not|TypeError/i);
    await expect(errorText).not.toBeVisible();
  });

  test('screenshot of Clash screen', async ({ page }) => {
    await page.screenshot({
      path: 'playwright-report/screenshots/clash.png',
      fullPage: false,
    });
  });
});

// ── Events ───────────────────────────────────────────────────────────────────

test.describe('Events screen', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);

    const nav = page.locator('nav').first();
    const eventsBtn = nav.getByRole('button', { name: 'Events', exact: true });
    await eventsBtn.waitFor({ timeout: 5000 });
    await eventsBtn.click();
    await page.waitForTimeout(700);
  });

  test('Events screen renders without crashing', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(50);
  });

  test('Events screen shows events-related content', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/events|upcoming|past|featured|tournament|season|clash/i);
  });

  test('screenshot of Events screen', async ({ page }) => {
    await page.screenshot({
      path: 'playwright-report/screenshots/events.png',
      fullPage: false,
    });
  });
});

// ── Legends tab (in Standings) ───────────────────────────────────────────────

test.describe('Legends tab in Standings', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);

    const nav = page.locator('nav').first();
    await nav.getByRole('button', { name: 'Standings', exact: true }).click();
    await page.waitForTimeout(700);

    // Click the legends tab
    const legendsBtn = page.getByRole('button', { name: /legends/i }).first();
    await legendsBtn.waitFor({ timeout: 5000 });
    await legendsBtn.click();
    await page.waitForTimeout(500);
  });

  test('Legends tab renders Hall of Fame content', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/hall of fame|champion|trophy|season|legend/i);
  });

  test('Legends tab does not crash', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(100);
  });

  test('screenshot of Legends tab', async ({ page }) => {
    await page.screenshot({
      path: 'playwright-report/screenshots/legends-tab.png',
      fullPage: false,
    });
  });
});
