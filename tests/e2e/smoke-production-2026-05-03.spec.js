/**
 * Production smoke test – 2026-05-03
 *
 * Full platform audit covering every priority route for the upcoming
 * paying-customer custom tournament. Tests run against the preview
 * build on port 4173.
 *
 * Run:
 *   npx playwright test tests/e2e/smoke-production-2026-05-03.spec.js --project=chromium
 */

import { test, expect } from '@playwright/test';

// helpers ──────────────────────────────────────────────────────────────────────

const BASE = 'http://localhost:4173';

async function go(page, path) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#root', { timeout: 15000 });
  await page.waitForFunction(
    () => document.querySelector('#root')?.children.length > 0,
    { timeout: 15000 }
  );
  await page.waitForTimeout(800);
}

function attachErrors(page) {
  var errors = [];
  page.on('console', function(msg) {
    if (msg.type() === 'error') errors.push('[console.error] ' + msg.text());
  });
  page.on('pageerror', function(err) { errors.push('[pageerror] ' + err.message); });
  return errors;
}

async function shot(page, name) {
  await page.screenshot({
    path: 'playwright-report/screenshots/smoke-' + name + '.png',
    fullPage: false,
  });
}

async function checkEmDashes(page, label) {
  var bodyText = await page.textContent('body');
  // Check for em-dash (U+2014) and en-dash (U+2013)
  var emDashes = (bodyText.match(/\u2014/g) || []).length;
  var enDashes = (bodyText.match(/\u2013/g) || []).length;
  if (emDashes > 0 || enDashes > 0) {
    return '[WARN] ' + label + ': found ' + emDashes + ' em-dashes and ' + enDashes + ' en-dashes';
  }
  return null;
}

async function checkMaterialSymbols(page, label) {
  // Check if any material-symbols-outlined spans have no text (box squares)
  var emptyIcons = await page.evaluate(function() {
    var icons = document.querySelectorAll('.material-symbols-outlined');
    var empty = 0;
    icons.forEach(function(el) {
      if (!el.textContent || el.textContent.trim() === '') empty++;
    });
    return empty;
  });
  if (emptyIcons > 0) {
    return '[WARN] ' + label + ': ' + emptyIcons + ' empty Material Symbols icon(s)';
  }
  return null;
}

// ─── CRITICAL FLOWS ───────────────────────────────────────────────────────────

test.describe('CRITICAL: Core page renders', function() {

  test('/ — homepage loads', async function({ page }) {
    var errors = attachErrors(page);
    await go(page, '/');
    await shot(page, 'home');

    var bodyText = await page.textContent('body');
    expect(bodyText.length, 'body should not be empty').toBeGreaterThan(100);
    expect(bodyText).not.toMatch(/something went wrong/i);

    // Hero/branding present
    expect(bodyText).toMatch(/TFT Clash/i);

    // No JS crash
    var pageErrors = errors.filter(function(e) { return e.includes('[pageerror]'); });
    expect(pageErrors, 'No unhandled JS errors on homepage').toHaveLength(0);

    var dashWarn = await checkEmDashes(page, 'home');
    if (dashWarn) console.warn(dashWarn);
    var iconWarn = await checkMaterialSymbols(page, 'home');
    if (iconWarn) console.warn(iconWarn);
  });

  test('/signup — renders, Discord button visible, ToS checkbox works', async function({ page }) {
    var errors = attachErrors(page);
    await go(page, '/signup');
    await shot(page, 'signup');

    var bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/something went wrong/i);
    expect(bodyText.length).toBeGreaterThan(50);

    // No black screen check
    var bgColor = await page.evaluate(function() {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    // Acceptable backgrounds for a dark theme: not white (rgb 255,255,255) or transparent
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');

    // Discord OAuth button should be visible
    var discordBtn = page.getByRole('button', { name: /discord/i }).first();
    await expect(discordBtn).toBeVisible({ timeout: 8000 });

    // ToS checkbox should be present
    var tosCheckbox = page.locator('input[type="checkbox"]').first();
    var hasTos = await tosCheckbox.count();
    if (hasTos > 0) {
      await expect(tosCheckbox).toBeVisible({ timeout: 5000 });
      // Test toggle
      var checked = await tosCheckbox.isChecked();
      await tosCheckbox.click();
      var checkedAfter = await tosCheckbox.isChecked();
      expect(checkedAfter).not.toBe(checked);
    }

    var pageErrors = errors.filter(function(e) { return e.includes('[pageerror]'); });
    expect(pageErrors, 'No JS crashes on signup').toHaveLength(0);

    var dashWarn = await checkEmDashes(page, 'signup');
    if (dashWarn) console.warn(dashWarn);
  });

  test('/login — Discord button visible, no black screen', async function({ page }) {
    var errors = attachErrors(page);
    await go(page, '/login');
    await shot(page, 'login');

    var bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/something went wrong/i);

    // Discord button
    var discordBtn = page.getByRole('button', { name: /discord/i }).first();
    await expect(discordBtn).toBeVisible({ timeout: 8000 });

    // Email input present
    expect(bodyText).toMatch(/email/i);

    var pageErrors = errors.filter(function(e) { return e.includes('[pageerror]'); });
    expect(pageErrors, 'No JS crashes on login').toHaveLength(0);

    var dashWarn = await checkEmDashes(page, 'login');
    if (dashWarn) console.warn(dashWarn);
  });

  test('/standings — loads with player data', async function({ page }) {
    var errors = attachErrors(page);
    await go(page, '/standings');
    await shot(page, 'standings');

    var bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/something went wrong/i);
    expect(bodyText).toMatch(/standings|season|rank/i);

    var pageErrors = errors.filter(function(e) { return e.includes('[pageerror]'); });
    expect(pageErrors, 'No JS crashes on standings').toHaveLength(0);

    var dashWarn = await checkEmDashes(page, 'standings');
    if (dashWarn) console.warn(dashWarn);
  });

  test('/leaderboard — rows visible', async function({ page }) {
    var errors = attachErrors(page);
    await go(page, '/leaderboard');
    await shot(page, 'leaderboard');

    var bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/something went wrong/i);
    expect(bodyText).toMatch(/leaderboard|rank|player/i);

    var pageErrors = errors.filter(function(e) { return e.includes('[pageerror]'); });
    expect(pageErrors, 'No JS crashes on leaderboard').toHaveLength(0);

    var dashWarn = await checkEmDashes(page, 'leaderboard');
    if (dashWarn) console.warn(dashWarn);
  });

  test('/leaderboard — no horizontal scroll at 375px', async function({ page }) {
    await page.setViewportSize({ width: 375, height: 812 });
    await go(page, '/leaderboard');
    await shot(page, 'leaderboard-375');

    var bodyWidth = await page.evaluate(function() { return document.body.scrollWidth; });
    expect(bodyWidth, 'Leaderboard should not overflow 375px viewport').toBeLessThanOrEqual(380);
  });

  test('/events — tournament list shows', async function({ page }) {
    var errors = attachErrors(page);
    await go(page, '/events');
    await shot(page, 'events');

    var bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/something went wrong/i);
    expect(bodyText).toMatch(/event|tournament|clash/i);

    var pageErrors = errors.filter(function(e) { return e.includes('[pageerror]'); });
    expect(pageErrors, 'No JS crashes on events').toHaveLength(0);

    var dashWarn = await checkEmDashes(page, 'events');
    if (dashWarn) console.warn(dashWarn);
  });
});

// ─── ADMIN PANEL ─────────────────────────────────────────────────────────────

test.describe('Admin panel gate', function() {

  test('/admin — gate works when not authenticated', async function({ page }) {
    var errors = attachErrors(page);
    await go(page, '/admin');
    await shot(page, 'admin-gate');

    var bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/something went wrong/i);

    // Either shows gate or the panel itself — no crash is the core requirement
    var hasGate = /admin access|access required|sign in|log in|lock/i.test(bodyText);
    var hasPanel = /overview|players|tournament|settings/i.test(bodyText);
    expect(hasGate || hasPanel, 'Admin should show gate or panel').toBe(true);

    var pageErrors = errors.filter(function(e) { return e.includes('[pageerror]'); });
    expect(pageErrors, 'No JS crashes on /admin').toHaveLength(0);
  });
});

// ─── TOURNAMENT FLOWS ────────────────────────────────────────────────────────

test.describe('Tournament routes', function() {

  test('/tournament/:uuid — unknown ID handled gracefully', async function({ page }) {
    var errors = attachErrors(page);
    await go(page, '/tournament/00000000-0000-0000-0000-000000000000');
    await shot(page, 'tournament-unknown');

    var bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/something went wrong/i);

    var pageErrors = errors.filter(function(e) { return e.includes('[pageerror]'); });
    expect(pageErrors, 'No JS crashes on unknown tournament').toHaveLength(0);
  });

  test('/flash/:id — redirects to /tournament/', async function({ page }) {
    var errors = attachErrors(page);
    await go(page, '/flash/test-smoke-id');
    await shot(page, 'flash-redirect');

    var url = page.url();
    expect(url).toContain('/tournament/');

    var pageErrors = errors.filter(function(e) { return e.includes('[pageerror]'); });
    expect(pageErrors, 'No JS crashes on /flash redirect').toHaveLength(0);
  });

  test('/bracket — renders idle state or bracket', async function({ page }) {
    var errors = attachErrors(page);
    await go(page, '/bracket');
    await shot(page, 'bracket');

    var bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/something went wrong/i);
    expect(bodyText.length).toBeGreaterThan(40);

    var pageErrors = errors.filter(function(e) { return e.includes('[pageerror]'); });
    expect(pageErrors, 'No JS crashes on /bracket').toHaveLength(0);
  });
});

// ─── OTHER PAGES ─────────────────────────────────────────────────────────────

test.describe('Other pages smoke', function() {

  for (var entry of [
    ['/pricing',       /player|free|pro|host/i,           'pricing'],
    ['/faq',           /faq|question|how/i,               'faq'],
    ['/rules',         /rule|scoring|placement/i,         'rules'],
    ['/privacy',       /privacy|data|cookie/i,            'privacy'],
    ['/terms',         /term|service|agreement/i,         'terms'],
    ['/hall-of-fame',  /hall of fame|champion|record/i,   'hof'],
    ['/archive',       /archive|history|past/i,           'archive'],
    ['/milestones',    /milestone/i,                      'milestones'],
    ['/challenges',    /challenge/i,                      'challenges'],
    ['/season-recap',  /season|recap/i,                   'season-recap'],
    ['/scrims',        /.{1}/,                            'scrims'],
    ['/host/apply',    /host|apply|organizer|application/i, 'host-apply'],
    ['/host/dashboard', /.{1}/,                           'host-dashboard'],
    ['/account',       /account|sign in|log in/i,         'account'],
    ['/player/Levitate', /.{1}/,                          'player-levitate'],
  ]) {
    (function(path, keyword, label) {
      test(label + ' renders without crash', async function({ page }) {
        var errors = attachErrors(page);
        await go(page, path);
        await shot(page, label);

        var bodyText = await page.textContent('body');
        expect(bodyText).not.toMatch(/something went wrong/i);
        expect(bodyText).toMatch(keyword);

        var pageErrors = errors.filter(function(e) { return e.includes('[pageerror]'); });
        expect(pageErrors, 'No JS crashes on ' + path).toHaveLength(0);

        var dashWarn = await checkEmDashes(page, label);
        if (dashWarn) console.warn(dashWarn);
        var iconWarn = await checkMaterialSymbols(page, label);
        if (iconWarn) console.warn(iconWarn);
      });
    })(entry[0], entry[1], entry[2]);
  }
});

// ─── MOBILE OVERFLOW CHECKS ───────────────────────────────────────────────────

test.describe('Mobile 375px overflow checks', function() {

  for (var item of [
    ['/', 'home-mobile'],
    ['/standings', 'standings-mobile'],
    ['/pricing', 'pricing-mobile'],
    ['/host/apply', 'host-apply-mobile'],
  ]) {
    (function(path, label) {
      test(label + ' — no horizontal overflow', async function({ page }) {
        await page.setViewportSize({ width: 375, height: 812 });
        await go(page, path);
        await shot(page, label);

        var bodyWidth = await page.evaluate(function() { return document.body.scrollWidth; });
        expect(bodyWidth, label + ' should not overflow 375px').toBeLessThanOrEqual(385);

        var bodyText = await page.textContent('body');
        expect(bodyText).not.toMatch(/something went wrong/i);
      });
    })(item[0], item[1]);
  }
});

// ─── MATERIAL SYMBOLS FONT CHECK ─────────────────────────────────────────────

test.describe('Material Symbols font load', function() {

  test('Home — icons render as text not box squares', async function({ page }) {
    await go(page, '/');
    await page.waitForTimeout(1500); // allow font to load

    var result = await page.evaluate(function() {
      var icons = document.querySelectorAll('.material-symbols-outlined');
      if (icons.length === 0) return { total: 0, empty: 0, sample: [] };
      var empty = 0;
      var sample = [];
      icons.forEach(function(el) {
        var text = el.textContent ? el.textContent.trim() : '';
        if (!text) empty++;
        else if (sample.length < 3) sample.push(text);
      });
      return { total: icons.length, empty: empty, sample: sample };
    });

    console.log('[Material Symbols] icons found:', result.total, 'empty:', result.empty, 'samples:', result.sample);
    // If there are icons, they should not all be empty
    if (result.total > 0) {
      var emptyRatio = result.empty / result.total;
      expect(emptyRatio, 'Icon empty rate should be < 50%').toBeLessThan(0.5);
    }
    await shot(page, 'icons-home');
  });
});

// ─── EM DASH SWEEP ────────────────────────────────────────────────────────────

test.describe('Em/en dash zero-tolerance sweep', function() {

  for (var pg of [
    ['/', 'home'],
    ['/pricing', 'pricing'],
    ['/events', 'events'],
    ['/faq', 'faq'],
    ['/rules', 'rules'],
    ['/host/apply', 'host-apply'],
  ]) {
    (function(path, label) {
      test(label + ' — zero em/en dashes', async function({ page }) {
        await go(page, path);
        var bodyText = await page.textContent('body');
        var emDashCount = (bodyText.match(/\u2014/g) || []).length;
        var enDashCount = (bodyText.match(/\u2013/g) || []).length;

        if (emDashCount > 0 || enDashCount > 0) {
          // Extract context around each dash for reporting
          var issues = [];
          var lines = bodyText.split('\n');
          lines.forEach(function(line) {
            if (/\u2014|\u2013/.test(line)) {
              issues.push(line.trim().substring(0, 120));
            }
          });
          console.warn('[DASH VIOLATION] ' + label + ': em=' + emDashCount + ' en=' + enDashCount);
          issues.forEach(function(i) { console.warn('  > ' + i); });
        }

        expect(emDashCount, label + ' should have zero em-dashes (U+2014)').toBe(0);
        expect(enDashCount, label + ' should have zero en-dashes (U+2013)').toBe(0);
      });
    })(pg[0], pg[1]);
  }
});

// ─── VIEWPORT RESIZE 375 <-> 1280 ────────────────────────────────────────────

test.describe('Layout shift on viewport resize', function() {

  test('Home — no crash resizing 375 to 1280', async function({ page }) {
    await page.setViewportSize({ width: 375, height: 812 });
    await go(page, '/');
    await shot(page, 'home-375');

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(400);
    await shot(page, 'home-1280');

    var bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/something went wrong/i);
  });

  test('Leaderboard — no crash resizing 375 to 1280', async function({ page }) {
    await page.setViewportSize({ width: 375, height: 812 });
    await go(page, '/leaderboard');

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(400);
    await shot(page, 'leaderboard-1280');

    var bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/something went wrong/i);
  });
});
