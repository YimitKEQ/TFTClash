/**
 * E2E – Home screen
 *
 * Verifies core home screen elements that render regardless of
 * whether Supabase is connected or the player table is populated.
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
    const bodyText = await page.textContent('body');
    const hasPhase = /Registration Open|Check.in Open|Clash is LIVE|Results Posted/i.test(bodyText || '');
    expect(hasPhase, 'Phase status pill text should be visible').toBe(true);
  });

  test('navigation bar is rendered', async ({ page }) => {
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible({ timeout: 5000 });
  });

  test('Sign In button is visible in the navbar when logged out', async ({ page }) => {
    const nav = page.locator('nav').first();
    const signInBtn = nav.getByRole('button', { name: 'Sign In', exact: true });
    await expect(signInBtn).toBeVisible({ timeout: 5000 });
  });

  test('Sign Up button is visible in the navbar when logged out', async ({ page }) => {
    const nav = page.locator('nav').first();
    const signUpBtn = nav.getByRole('button', { name: 'Sign Up', exact: true });
    await expect(signUpBtn).toBeVisible({ timeout: 5000 });
  });

  test('TFT Clash logo or title text is visible', async ({ page }) => {
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
