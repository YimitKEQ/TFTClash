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
    await expect(page.getByText(/Join the Arena/i)).toBeVisible({ timeout: 5000 });
  });

  test('Sign Up screen has Discord signup button', async ({ page }) => {
    await expect(page.getByText(/Join with Discord/i)).toBeVisible({ timeout: 5000 });
  });

  test('Sign Up screen has benefits list', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/one-click signup/i);
    expect(bodyText).toMatch(/compete in weekly clashes/i);
  });

  test('Sign Up screen has link to Sign In', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/sign in|already in the arena/i);
  });

  test('Sign Up screen has Discord mentioned', async ({ page }) => {
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

  test('Login screen has Discord login button', async ({ page }) => {
    await expect(page.getByText(/Sign in with Discord/i)).toBeVisible({ timeout: 5000 });
  });

  test('Login screen has no-password messaging', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/no passwords needed/i);
  });

  test('Login screen has a link to Sign Up', async ({ page }) => {
    const visibleText = await page.locator('body').innerText();
    expect(visibleText).toMatch(/Join Now|sign up|new to tft clash/i);
  });

  test('Login screen has Continue as guest option', async ({ page }) => {
    await expect(page.getByText(/continue as guest/i)).toBeVisible({ timeout: 5000 });
  });

  test('Login screen has Discord login option', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/discord/i);
  });

  test('screenshot of Login screen', async ({ page }) => {
    await page.screenshot({
      path: 'playwright-report/screenshots/login.png',
    });
  });
});
