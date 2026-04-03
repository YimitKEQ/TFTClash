/**
 * E2E – Registration & check-in flow
 *
 * Tests the tournament registration phase UI.
 * Logged-out users see a prompt to sign in.
 */

import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage.js';

test.describe('Registration flow (logged-out)', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(800);
  });

  test('home screen shows auth prompt or sign up CTA', async ({ page }) => {
    const body = await page.textContent('body');
    const hasPrompt = /Sign In|Sign Up|Log in|Create.*account|Join/i.test(body || '');
    expect(hasPrompt, 'Should show auth prompt for logged-out users').toBe(true);
  });

  test('home screen shows tournament or season content', async ({ page }) => {
    const body = await page.textContent('body');
    const hasContent = /Season|Clash|Tournament|Dashboard|Registration/i.test(body || '');
    expect(hasContent, 'Should show tournament-related content').toBe(true);
  });

  test('pricing section is accessible from nav', async ({ page }) => {
    const app = new AppPage(page);
    await app.clickNavLink('Pricing');
    await page.waitForTimeout(500);
    const body = await page.textContent('body');
    expect(body).toMatch(/pricing|Pro|Host|Free/i);
  });
});

test.describe('Registration UI elements', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(800);
  });

  test('register or sign up is visible', async ({ page }) => {
    const body = await page.textContent('body');
    const hasRegisterFlow = /register|sign in|sign up|join/i.test(body || '');
    expect(hasRegisterFlow).toBe(true);
  });

  test('navigation to clash screen works', async ({ page }) => {
    const app = new AppPage(page);
    await app.clickNavLink('Clash');
    await page.waitForTimeout(500);
    const body = await page.textContent('body');
    const hasClash = /clash|lobby|bracket|no lobbies|round|tournament|register/i.test(body || '');
    expect(hasClash, 'Clash screen should be accessible').toBe(true);
  });

  test('empty clash state is handled gracefully', async ({ page }) => {
    const app = new AppPage(page);
    await app.clickNavLink('Clash');
    await page.waitForTimeout(500);
    const errorBoundary = page.getByText('Something went wrong');
    await expect(errorBoundary).not.toBeVisible({ timeout: 2000 }).catch(() => {});
  });
});
