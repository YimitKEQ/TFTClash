/**
 * Page Object Model for the TFT Clash SPA.
 *
 * Navigation structure (post-overhaul):
 * - Top header with logo, desktop nav links, Sign In / Sign Up, hamburger menu
 * - Desktop sidebar (xl+ only) with full nav
 * - Mobile bottom bar with tabs
 * - Right-side drawer menu (opened via hamburger)
 *
 * Desktop nav links (inside <nav> in the <header>): Clash, Standings, Events, Stats, Hall of Fame, Pricing
 * Sign In / Sign Up buttons are in the header but OUTSIDE the <nav> element.
 * Rules, FAQ, and other secondary pages are only in the drawer or sidebar.
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

  /** Click a primary nav link (Clash, Standings, Events, Stats, Hall of Fame, Pricing). */
  async clickNavLink(label) {
    const nav = this.page.locator('header nav').first();
    // The "Clash" button has a dynamic label based on tournament phase:
    // "Clash", "● LIVE CLASH", "Clash - Joined", "Clash - Register",
    // "Clash - Check-In", "Clash - Checked In", "Clash - Results".
    // Match any of those when the caller asks for "Clash".
    const matcher = label === 'Clash'
      ? { name: /clash/i }
      : { name: label, exact: true };
    const btn = nav.getByRole('button', matcher).first();
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
    await this.page.waitForTimeout(400);
  }

  /** Open the hamburger drawer menu. */
  async openDrawer() {
    // The hamburger button contains a Material Symbol "menu" icon
    const menuBtn = this.page.locator('header button').filter({
      has: this.page.locator('span.material-symbols-outlined', { hasText: 'menu' })
    }).first();
    await menuBtn.waitFor({ timeout: 5000 });
    await menuBtn.click();
    await this.page.waitForTimeout(500);
  }

  /** Click an item inside the hamburger drawer menu. */
  async clickDrawerItem(label) {
    await this.openDrawer();
    // Wait for drawer animation to complete
    await this.page.waitForTimeout(300);
    // Use JavaScript click to bypass backdrop overlay z-index issues
    await this.page.evaluate((buttonLabel) => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.trim().toLowerCase().includes(buttonLabel.toLowerCase())) {
          // Check if this button is inside the drawer (fixed, right-0 panel)
          const parent = btn.closest('div.fixed');
          if (parent && parent.classList.contains('right-0')) {
            btn.click();
            return true;
          }
        }
      }
      return false;
    }, label);
    await this.page.waitForTimeout(400);
  }

  // ── Auth helpers ─────────────────────────────────────────────────────────

  /** Click the Sign In button in the top header (visible on md+ screens). */
  async clickSignIn() {
    const header = this.page.locator('header');
    const btn = header.getByRole('button', { name: 'Sign In', exact: true });
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
    await this.page.waitForTimeout(400);
  }

  /** Click the Sign Up button in the top header (visible on md+ screens). */
  async clickSignUp() {
    const header = this.page.locator('header');
    const btn = header.getByRole('button', { name: 'Sign Up', exact: true });
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
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
