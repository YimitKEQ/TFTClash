/**
 * Page Object Model for the TFT Clash SPA.
 * The app uses simple hash routing: #home, #standings, #bracket, etc.
 * Nav clicks update the hash, which the React state machine reads.
 */

export class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  /** Navigate to the app and wait for the root div to mount. */
  async goto() {
    await this.page.goto('/');
    await this.page.waitForSelector('#root', { timeout: 10000 });
    // Wait for React to render something meaningful
    await this.page.waitForFunction(
      () => document.querySelector('#root')?.children.length > 0,
      { timeout: 10000 }
    );
  }

  // ── Desktop nav helpers ──────────────────────────────────────────────────

  async clickNavLink(label) {
    // Desktop nav buttons (text-only buttons inside the top nav)
    const nav = this.page.locator('nav').first();
    const btn = nav.getByRole('button', { name: label, exact: true });
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
    await this.page.waitForTimeout(400);
  }

  async openMoreMenu() {
    const nav = this.page.locator('nav').first();
    const moreBtn = nav.getByRole('button', { name: /More/i });
    await moreBtn.click();
    await this.page.waitForTimeout(300);
  }

  async clickMoreMenuItem(label) {
    await this.openMoreMenu();
    await this.page.getByRole('button', { name: label, exact: true }).click();
    await this.page.waitForTimeout(400);
  }

  // ── Auth helpers ─────────────────────────────────────────────────────────

  async clickSignIn() {
    await this.page.getByRole('button', { name: 'Sign In' }).click();
    await this.page.waitForTimeout(400);
  }

  async clickSignUp() {
    await this.page.getByRole('button', { name: 'Sign Up' }).click();
    await this.page.waitForTimeout(400);
  }

  // ── Screenshot helper ────────────────────────────────────────────────────

  async screenshot(name) {
    await this.page.screenshot({
      path: `playwright-report/screenshots/${name}.png`,
      fullPage: false,
    });
  }
}
