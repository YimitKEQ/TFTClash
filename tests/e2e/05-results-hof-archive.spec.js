/**
 * E2E – Clash, Events, Legends tab
 *
 * Tests verify these screens render correctly using the current nav structure.
 */

import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage.js';

// ── Clash ────────────────────────────────────────────────────────────────────

test.describe('Clash screen', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);
    await app.clickNavLink('Clash');
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
    await app.clickNavLink('Events');
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

// ── Hall of Fame tab (in Standings) ──────────────────────────────────────────

test.describe('Hall of Fame tab in Standings', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);
    await app.clickNavLink('Standings');
    await page.waitForTimeout(700);

    const hofBtn = page.getByRole('button', { name: 'Hall of Fame' }).first();
    await hofBtn.waitFor({ timeout: 5000 });
    await hofBtn.click();
    await page.waitForTimeout(500);
  });

  test('Hall of Fame tab renders content', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/hall of fame|champion|trophy|season|legend/i);
  });

  test('Hall of Fame tab does not crash', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(100);
  });

  test('screenshot of Hall of Fame tab', async ({ page }) => {
    await page.screenshot({
      path: 'playwright-report/screenshots/hof-tab.png',
      fullPage: false,
    });
  });
});
