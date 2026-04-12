import { test, expect } from '@playwright/test';

test.describe('Clash screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('Clash route renders without crash', async ({ page }) => {
    await page.goto('/#/clash');
    await page.waitForTimeout(1000);
    // Should not show error boundary
    const errorBoundary = page.locator('text=Something went wrong');
    await expect(errorBoundary).toHaveCount(0);
  });

  test('Clash screen shows countdown or tournament content', async ({ page }) => {
    await page.goto('/#/clash');
    await page.waitForTimeout(1000);
    const body = await page.textContent('body');
    // Should show either countdown, registration, or tournament content
    const hasContent = /clash|tournament|countdown|next|saturday|register|live|standings/i.test(body);
    expect(hasContent).toBe(true);
  });

  test('Bracket route renders without crash', async ({ page }) => {
    await page.goto('/#/bracket');
    await page.waitForTimeout(1000);
    const errorBoundary = page.locator('text=Something went wrong');
    await expect(errorBoundary).toHaveCount(0);
  });
});
