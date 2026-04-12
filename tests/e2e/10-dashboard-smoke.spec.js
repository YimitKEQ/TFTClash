import { test, expect } from '@playwright/test';

test.describe('Dashboard screen', () => {
  test('Dashboard route renders without crash', async ({ page }) => {
    await page.goto('/#/dashboard');
    await page.waitForTimeout(1000);
    const errorBoundary = page.locator('text=Something went wrong');
    await expect(errorBoundary).toHaveCount(0);
  });

  test('Dashboard shows sign-in prompt or player content', async ({ page }) => {
    await page.goto('/#/dashboard');
    await page.waitForTimeout(1000);
    const body = await page.textContent('body');
    // Should show login prompt (not logged in) or dashboard content
    const hasContent = /sign in|dashboard|stats|welcome|profile|log in/i.test(body);
    expect(hasContent).toBe(true);
  });
});

test.describe('Account screen', () => {
  test('Account route renders without crash', async ({ page }) => {
    await page.goto('/#/account');
    await page.waitForTimeout(1000);
    const errorBoundary = page.locator('text=Something went wrong');
    await expect(errorBoundary).toHaveCount(0);
  });
});
