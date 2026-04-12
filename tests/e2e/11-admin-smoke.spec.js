import { test, expect } from '@playwright/test';

test.describe('Admin screen', () => {
  test('Admin route renders without crash for non-admin', async ({ page }) => {
    await page.goto('/#/admin');
    await page.waitForTimeout(1000);
    const errorBoundary = page.locator('text=Something went wrong');
    await expect(errorBoundary).toHaveCount(0);
  });

  test('Admin screen shows access gate or admin content', async ({ page }) => {
    await page.goto('/#/admin');
    await page.waitForTimeout(1000);
    const body = await page.textContent('body');
    // Should show admin password prompt or admin panel content
    const hasContent = /admin|password|access|panel|command/i.test(body);
    expect(hasContent).toBe(true);
  });
});

test.describe('Scrims screen', () => {
  test('Scrims route renders without crash', async ({ page }) => {
    await page.goto('/#/scrims');
    await page.waitForTimeout(1000);
    const errorBoundary = page.locator('text=Something went wrong');
    await expect(errorBoundary).toHaveCount(0);
  });
});

test.describe('Events screen', () => {
  test('Events route renders without crash', async ({ page }) => {
    await page.goto('/#/events');
    await page.waitForTimeout(1000);
    const errorBoundary = page.locator('text=Something went wrong');
    await expect(errorBoundary).toHaveCount(0);
    const body = await page.textContent('body');
    const hasContent = /event|tournament|featured|community/i.test(body);
    expect(hasContent).toBe(true);
  });
});
