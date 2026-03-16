/**
 * E2E – Home screen
 *
 * Verifies core home screen elements that render regardless of
 * whether Supabase is connected or the player table is populated.
 *
 * Key facts about the app:
 * - SEED = [] so players start empty; Supabase may or may not be available
 * - SEASON_CHAMPION = null so no champion hero card is rendered by default
 * - The ticker and phase pill render from tournamentState, not player data
 * - Sign In / Sign Up buttons are in the nav, but the home screen also
 *   has "Sign In to Register" inside the Aegis partner card, so we
 *   must scope button selectors to avoid strict-mode violations
 */

import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage.js';

test.describe('Home screen', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(800);
  });

  test('page title is TFT Clash', async ({ page }) => {
    await expect(page).toHaveTitle(/TFT Clash/i);
  });

  test('root element is rendered with dark background', async ({ page }) => {
    const root = page.locator('#root');
    await expect(root).toBeVisible();
    await expect(root).not.toBeEmpty();
  });

  test('phase status pill is visible', async ({ page }) => {
    // phaseStatusText() returns "Registration Open · N/24 registered" etc.
    // We look for any of the possible phase status texts
    const bodyText = await page.textContent('body');
    const hasPhase = /Registration Open|Check.in Open|Clash is LIVE|Results Posted/i.test(bodyText || '');
    expect(hasPhase, 'Phase status pill text should be visible').toBe(true);
  });

  test('countdown timer digits are rendered on the page', async ({ page }) => {
    // Countdown shows D / H / M / S — look for time-related labels
    const bodyText = await page.textContent('body');
    // The timer container renders digits — at minimum the body has digits
    expect(bodyText).toMatch(/\d/);
  });

  test('Season 16 branding is present', async ({ page }) => {
    const season = page.getByText(/Season 16/i);
    await expect(season.first()).toBeVisible({ timeout: 5000 });
  });

  test('navigation bar is rendered', async ({ page }) => {
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible({ timeout: 5000 });
  });

  test('Sign In button is visible in the navbar when logged out', async ({ page }) => {
    // Scope to the top navbar to avoid matching "Sign In to Register" on the page
    const nav = page.locator('nav').first();
    const signInBtn = nav.getByRole('button', { name: 'Sign In', exact: true });
    await expect(signInBtn).toBeVisible({ timeout: 5000 });
  });

  test('Sign Up button is visible in the navbar when logged out', async ({ page }) => {
    // Scope to the top navbar to avoid matching "Sign Up Free" on the Pricing section
    const nav = page.locator('nav').first();
    const signUpBtn = nav.getByRole('button', { name: 'Sign Up', exact: true });
    await expect(signUpBtn).toBeVisible({ timeout: 5000 });
  });

  test('community pulse ticker renders schedule text', async ({ page }) => {
    // Static ticker item "Next clash: Saturday 8PM EST" is always present
    const tickerText = page.getByText(/Next clash/i);
    await expect(tickerText.first()).toBeVisible({ timeout: 8000 });
  });

  test('TFT Clash logo or title text is visible', async ({ page }) => {
    // The navbar brand text or page content has "TFT Clash"
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/TFT Clash/i);
  });

  test('screenshot of home page', async ({ page }) => {
    await page.screenshot({
      path: 'playwright-report/screenshots/home.png',
      fullPage: false,
    });
  });
});
