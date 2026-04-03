/**
 * E2E – Smoke tests for remaining screens
 *
 * Validates that each additional screen renders without a JS crash.
 * Uses the drawer menu for secondary screens and header nav for primary ones.
 */

import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage.js';

// ── Pricing ────────────────────────────────────────────────────────────────────
test('Pricing screen renders plan content', async ({ page }) => {
  const app = new AppPage(page);
  await app.goto();
  await page.waitForTimeout(600);
  await app.clickNavLink('Pricing');
  await page.waitForTimeout(600);

  const bodyText = await page.textContent('body');
  expect(bodyText).toMatch(/pricing|plans|free|pro|host/i);
  await page.screenshot({ path: 'playwright-report/screenshots/pricing.png' });
});

// ── Rules (via drawer) ────────────────────────────────────────────────────────
test('Rules screen renders rulebook content', async ({ page }) => {
  const app = new AppPage(page);
  await app.goto();
  await page.waitForTimeout(600);
  await app.clickDrawerItem('Rules');
  await page.waitForTimeout(600);

  const bodyText = await page.textContent('body');
  expect(bodyText).toMatch(/rules|rulebook|tournament|points/i);
  await page.screenshot({ path: 'playwright-report/screenshots/rules.png' });
});

// ── FAQ (via drawer) ──────────────────────────────────────────────────────────
test('FAQ screen renders questions content', async ({ page }) => {
  const app = new AppPage(page);
  await app.goto();
  await page.waitForTimeout(600);
  await app.clickDrawerItem('FAQ');
  await page.waitForTimeout(600);

  const bodyText = await page.textContent('body');
  expect(bodyText).toMatch(/faq|frequently|question/i);
  await page.screenshot({ path: 'playwright-report/screenshots/faq.png' });
});

// ── Clash ──────────────────────────────────────────────────────────────────────
test('Clash screen renders without crashing', async ({ page }) => {
  const app = new AppPage(page);
  await app.goto();
  await page.waitForTimeout(600);
  await app.clickNavLink('Clash');
  await page.waitForTimeout(600);

  const bodyText = await page.textContent('body');
  expect(bodyText).toMatch(/clash|tournament|register|lobby|bracket|round/i);
  await page.screenshot({ path: 'playwright-report/screenshots/clash-smoke.png' });
});

// ── Events ─────────────────────────────────────────────────────────────────────
test('Events screen renders without crashing', async ({ page }) => {
  const app = new AppPage(page);
  await app.goto();
  await page.waitForTimeout(600);
  await app.clickNavLink('Events');
  await page.waitForTimeout(600);

  const bodyText = await page.textContent('body');
  expect(bodyText).toMatch(/events|upcoming|past|featured|tournament/i);
  await page.screenshot({ path: 'playwright-report/screenshots/events-smoke.png' });
});

// ── Sign Up -> Sign In navigation ──────────────────────────────────────────────
test('Sign Up screen has a link to Sign In', async ({ page }) => {
  const app = new AppPage(page);
  await app.goto();
  await page.waitForTimeout(600);
  await app.clickSignUp();
  await page.waitForTimeout(500);

  const bodyText = await page.textContent('body');
  expect(bodyText).toMatch(/sign in|already in the arena/i);
});
