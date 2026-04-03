/**
 * E2E – Authentication screens
 *
 * Tests Sign Up and Login screens for:
 * - Correct rendering of form fields and headings
 * - Footer links between Sign Up and Sign In
 *
 * Navigation: Sign In / Sign Up buttons are in the top header bar.
 * Auth screens render as full-screen overlays via authScreen state.
 *
 * SignUp screen: heading "Create Account", fields: Email, Summoner Name, Security Key, Confirm Key
 * Login screen: heading "Sign In", fields: Email, Security Key, submit "Authenticate Account"
 */

import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage.js';

test.describe('Sign Up screen', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);
    await app.clickSignUp();
    await page.waitForTimeout(500);
  });

  test('Sign Up screen renders with heading', async ({ page }) => {
    await expect(page.getByText(/Create Account/i)).toBeVisible({ timeout: 5000 });
  });

  test('Sign Up screen has Email field', async ({ page }) => {
    await expect(page.getByPlaceholder(/email/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Sign Up screen has Username / Summoner Name field', async ({ page }) => {
    const summonerLabel = page.getByText('Summoner Name');
    const displayNameInput = page.getByPlaceholder(/display name/i);
    const hasField = (await summonerLabel.count() > 0) || (await displayNameInput.count() > 0);
    expect(hasField, 'Summoner Name field should be visible').toBe(true);
  });

  test('Sign Up screen has password fields', async ({ page }) => {
    // Security Key and Confirm Key fields
    const securityKeyLabels = page.getByText(/Security Key|Confirm Key/i);
    expect(await securityKeyLabels.count()).toBeGreaterThanOrEqual(1);
  });

  test('Sign Up screen has submit button', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: /Establish Profile/i });
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
  });

  test('Sign Up screen has link to Sign In', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/sign in|already in the arena/i);
  });

  test('Sign Up screen has Discord signup option', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/discord/i);
  });

  test('screenshot of Sign Up screen', async ({ page }) => {
    await page.screenshot({
      path: 'playwright-report/screenshots/signup.png',
    });
  });
});

test.describe('Login screen', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(600);
    await app.clickSignIn();
    await page.waitForTimeout(500);
  });

  test('Login screen renders with Sign In heading', async ({ page }) => {
    await expect(page.locator('h2').filter({ hasText: /Sign In/i })).toBeVisible({ timeout: 5000 });
  });

  test('Login screen has Email field', async ({ page }) => {
    await expect(page.getByPlaceholder(/email/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Login screen has Security Key label', async ({ page }) => {
    await expect(page.getByText('Security Key')).toBeVisible({ timeout: 5000 });
  });

  test('Login screen has Authenticate Account button', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: /Authenticate Account/i });
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
  });

  test('Login screen has a link to Sign Up', async ({ page }) => {
    const visibleText = await page.locator('body').innerText();
    expect(visibleText).toMatch(/Establish Profile|sign up|new to the arena/i);
  });

  test('Login screen has Forgot Access link', async ({ page }) => {
    await expect(page.getByText(/Forgot Access/i)).toBeVisible({ timeout: 5000 });
  });

  test('Login screen has Discord login option', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/discord/i);
  });

  test('submitting empty form keeps user on login screen', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: /Authenticate Account/i });
    await submitBtn.click();
    await page.waitForTimeout(500);
    // Should still be on login screen - email field visible
    await expect(page.getByPlaceholder(/email/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('screenshot of Login screen', async ({ page }) => {
    await page.screenshot({
      path: 'playwright-report/screenshots/login.png',
    });
  });
});
