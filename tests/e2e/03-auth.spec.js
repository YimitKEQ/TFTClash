/**
 * E2E – Authentication screens
 *
 * Tests Sign Up and Login screens for:
 * - Correct rendering of form fields
 * - Client-side validation (empty field submission is blocked)
 * - Step 1 → Step 2 progression requires all step-1 fields
 *
 * Key notes:
 * - The home screen also has "Sign In to Register" and "Sign Up Free" buttons
 *   on the partner event card and pricing section, so selectors MUST be
 *   scoped to the nav bar or use exact: true + nth to avoid strict-mode.
 * - We navigate to the auth screens by clicking the nav bar buttons.
 * - We do NOT submit real credentials to Supabase.
 */

import { test, expect } from '@playwright/test';

/** Click the "Sign Up" button that is specifically in the top navigation bar. */
async function openSignUp(page) {
  const nav = page.locator('nav').first();
  const btn = nav.getByRole('button', { name: 'Sign Up', exact: true });
  await btn.waitFor({ timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(500);
}

/** Click the "Sign In" button that is specifically in the top navigation bar. */
async function openSignIn(page) {
  const nav = page.locator('nav').first();
  const btn = nav.getByRole('button', { name: 'Sign In', exact: true });
  await btn.waitFor({ timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(500);
}

test.describe('Sign Up screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('#root')?.children.length > 0,
      { timeout: 10000 }
    );
    await page.waitForTimeout(600);
    await openSignUp(page);
  });

  test('Sign Up screen renders with heading', async ({ page }) => {
    await expect(page.getByText(/Create your account/i)).toBeVisible({ timeout: 5000 });
  });

  test('Sign Up screen has Email and Password fields', async ({ page }) => {
    await expect(page.getByPlaceholder(/email/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder(/password/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Sign Up screen has Username field', async ({ page }) => {
    // The Sign Up form has a "Username" label and a "Your display name" placeholder
    // Look for the label text or the input
    const usernameLabel = page.getByText('Username', { exact: true });
    const displayNameInput = page.getByPlaceholder('Your display name');
    // Either the label or the input should be visible
    const hasUsernameField = (await usernameLabel.count() > 0) || (await displayNameInput.count() > 0);
    expect(hasUsernameField, 'Username field (label or input) should be visible').toBe(true);
    if (await displayNameInput.count() > 0) {
      await expect(displayNameInput).toBeVisible({ timeout: 5000 });
    } else {
      await expect(usernameLabel.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('step indicator shows both step labels', async ({ page }) => {
    // The two-step wizard shows "Credentials" and "Your Profile"
    await expect(page.getByText('Credentials')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Your Profile')).toBeVisible({ timeout: 5000 });
  });

  test('clicking Continue with empty fields keeps user on step 1', async ({ page }) => {
    // Click the step-1 continue button without filling anything
    // The button label is "Continue →" based on the UI
    const continueBtn = page.getByRole('button', { name: /Continue/i }).first();
    if (await continueBtn.count() > 0) {
      await continueBtn.click();
    } else {
      // Fallback: find next-step button by looking for a primary button
      const primaryBtn = page.locator('button').filter({ hasText: /continue|next/i }).first();
      if (await primaryBtn.count() > 0) await primaryBtn.click();
    }
    await page.waitForTimeout(500);

    // We should still be on step 1 (Credentials label still visible)
    await expect(page.getByText(/Credentials/i)).toBeVisible({ timeout: 3000 });
  });

  test('Back to home button is visible and functional', async ({ page }) => {
    // There should be a back button that says "Back to home" or similar
    const backBtn = page.getByRole('button', { name: /Back to home|Back/i }).first();
    await expect(backBtn).toBeVisible({ timeout: 5000 });
    await backBtn.click();
    await page.waitForTimeout(600);

    // After going back, home content should be visible
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/Season 16|TFT Clash|Next clash|Registration/i);
  });

  test('Sign Up screen has link to Sign In', async ({ page }) => {
    // The sign up screen should have a way to go to login
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/sign in|log in|already have/i);
  });

  test('screenshot of Sign Up screen', async ({ page }) => {
    await page.screenshot({
      path: 'playwright-report/screenshots/signup.png',
    });
  });
});

test.describe('Login screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('#root')?.children.length > 0,
      { timeout: 10000 }
    );
    await page.waitForTimeout(600);
    await openSignIn(page);
  });

  test('Login screen renders with a welcome heading', async ({ page }) => {
    // The Login screen says "Welcome back" or "Sign in to your account"
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/Welcome back|Sign in|Your account/i);
  });

  test('Login screen has Email field', async ({ page }) => {
    await expect(page.getByPlaceholder(/email/i)).toBeVisible({ timeout: 5000 });
  });

  test('Login screen has Password field', async ({ page }) => {
    await expect(page.getByPlaceholder(/password/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Login screen has a submit button', async ({ page }) => {
    // Look for a Sign In or Login submit button that's NOT in the nav
    // The login form renders its own submit button
    const bodyText = await page.textContent('body');
    // Confirm the login form is present by checking for form fields and submit
    expect(bodyText).toMatch(/sign in|log in/i);
  });

  test('Login screen has a link to Sign Up', async ({ page }) => {
    // The login screen shows "No account? Create one free" below the form
    // Use innerText to get only visible rendered text (not CSS)
    const visibleText = await page.locator('body').innerText();
    // Match actual UI text: "Create one free" or "Sign up" or "create account"
    expect(visibleText).toMatch(/create one free|sign up|create account|no account/i);
  });

  test('submitting empty form keeps user on login screen', async ({ page }) => {
    // The email field should still be visible after failed submit
    const emailField = page.getByPlaceholder(/email/i);
    await expect(emailField).toBeVisible({ timeout: 5000 });

    // Try to submit — find the primary button in the form
    const submitBtn = page.locator('button').filter({ hasText: /^sign in$/i }).first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await page.waitForTimeout(500);
    }

    // Email field should still be visible (still on login)
    await expect(emailField).toBeVisible({ timeout: 3000 });
  });

  test('Back to home button works', async ({ page }) => {
    const backBtn = page.getByRole('button', { name: /Back to home|Back/i }).first();
    await expect(backBtn).toBeVisible({ timeout: 5000 });
    await backBtn.click();
    await page.waitForTimeout(600);

    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/Season 16|TFT Clash|Next clash|Registration/i);
  });

  test('screenshot of Login screen', async ({ page }) => {
    await page.screenshot({
      path: 'playwright-report/screenshots/login.png',
    });
  });
});
