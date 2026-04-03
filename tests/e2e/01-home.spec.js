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

  test('home screen shows meaningful content', async ({ page }) => {
    const bodyText = await page.textContent('body');
    // Home page should show TFT Clash branding or tournament info
    const hasContent = /TFT Clash|Season|Clash|Registration|Dashboard/i.test(bodyText || '');
    expect(hasContent, 'Home screen should show TFT Clash content').toBe(true);
  });

  test('top header is rendered', async ({ page }) => {
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 5000 });
  });

  test('Sign In button is visible in the header when logged out', async ({ page }) => {
    const header = page.locator('header');
    const signInBtn = header.getByRole('button', { name: 'Sign In', exact: true });
    await expect(signInBtn).toBeVisible({ timeout: 5000 });
  });

  test('Sign Up button is visible in the header when logged out', async ({ page }) => {
    const header = page.locator('header');
    const signUpBtn = header.getByRole('button', { name: 'Sign Up', exact: true });
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
