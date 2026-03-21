/**
 * E2E – Smoke tests for remaining screens
 *
 * Validates that each additional screen renders without a JS crash
 * and shows expected content. Button selectors are scoped to the
 * navbar to avoid strict-mode violations from duplicate button text.
 */

import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage.js';

/** Open a More-menu screen and return the page body text. */
async function openMoreScreen(page, label) {
  const app = new AppPage(page);
  await app.goto();
  await page.waitForTimeout(600);

  const nav = page.locator('nav').first();
  const moreBtn = nav.getByRole('button', { name: /More/i });
  await moreBtn.waitFor({ timeout: 5000 });
  await moreBtn.click();
  await page.waitForTimeout(300);

  const menuItem = nav.getByRole('button', { name: label, exact: true });
  await menuItem.waitFor({ timeout: 5000 });
  await menuItem.click();
  await page.waitForTimeout(600);
  return page.textContent('body');
}

/** Open a primary nav screen and return the page body text. */
async function openPrimaryScreen(page, label) {
  const app = new AppPage(page);
  await app.goto();
  await page.waitForTimeout(600);

  const nav = page.locator('nav').first();
  const btn = nav.getByRole('button', { name: label, exact: true });
  await btn.waitFor({ timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(600);
  return page.textContent('body');
}

// ── Pricing ────────────────────────────────────────────────────────────────────
test('Pricing screen renders plan content', async ({ page }) => {
  const bodyText = await openPrimaryScreen(page, 'Pricing');
  expect(bodyText).toMatch(/pricing|plans|free|pro|host/i);
  await page.screenshot({ path: 'playwright-report/screenshots/pricing.png' });
});

// ── Rules ──────────────────────────────────────────────────────────────────────
test('Rules screen renders rulebook content', async ({ page }) => {
  const bodyText = await openMoreScreen(page, 'Rules');
  expect(bodyText).toMatch(/rules|rulebook|tournament|points/i);
  await page.screenshot({ path: 'playwright-report/screenshots/rules.png' });
});

// ── FAQ ────────────────────────────────────────────────────────────────────────
test('FAQ screen renders questions content', async ({ page }) => {
  const bodyText = await openMoreScreen(page, 'FAQ');
  expect(bodyText).toMatch(/faq|frequently|question/i);
  await page.screenshot({ path: 'playwright-report/screenshots/faq.png' });
});

// ── Clash ──────────────────────────────────────────────────────────────────────
test('Clash screen renders without crashing', async ({ page }) => {
  const bodyText = await openPrimaryScreen(page, 'Clash');
  expect(bodyText).toMatch(/clash|tournament|register|lobby|bracket|round/i);
  await page.screenshot({ path: 'playwright-report/screenshots/clash-smoke.png' });
});

// ── Events ─────────────────────────────────────────────────────────────────────
test('Events screen renders without crashing', async ({ page }) => {
  const bodyText = await openPrimaryScreen(page, 'Events');
  expect(bodyText).toMatch(/events|upcoming|past|featured|tournament/i);
  await page.screenshot({ path: 'playwright-report/screenshots/events-smoke.png' });
});

// ── Sign Up → Sign In navigation ───────────────────────────────────────────────
test('Sign Up screen has a link to Sign In', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () => document.querySelector('#root')?.children.length > 0,
    { timeout: 10000 }
  );
  await page.waitForTimeout(600);

  // Use the nav-scoped Sign Up button to avoid strict-mode
  const nav = page.locator('nav').first();
  const signUpBtn = nav.getByRole('button', { name: 'Sign Up', exact: true });
  await signUpBtn.waitFor({ timeout: 5000 });
  await signUpBtn.click();
  await page.waitForTimeout(500);

  // The sign-up screen should offer a path to sign in
  const bodyText = await page.textContent('body');
  expect(bodyText).toMatch(/sign in|log in|already have/i);
});
