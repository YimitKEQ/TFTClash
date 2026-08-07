/**
 * render-guide.js - turn docs/guide-card.html into docs/images/guide-card.png.
 *
 * Run with: npm run guide:render
 *
 * The PNG is committed, not generated at runtime. Discord will not render an
 * SVG attachment inline, and putting a browser on the bot VM just to draw one
 * poster would be an absurd dependency for a picture that changes twice a year.
 * So the render happens here, on a dev machine, and the bot only ever reads a
 * file off disk.
 *
 * Playwright is a devDependency of the parent tft-clash repo rather than of the
 * bot, which keeps the bot's production install lean. If it is not there, this
 * script says exactly what to run rather than failing with a module trace.
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var root = path.join(__dirname, '..');

var SOURCE = path.join(root, 'docs', 'guide-card.html');
var OUT_DIR = path.join(root, 'docs', 'images');
var OUT = path.join(OUT_DIR, 'guide-card.png');

// The printable one-pager is generated from the same run, so the PDF in docs/
// can never drift away from the HTML that produced it.
var SHEET_SOURCE = path.join(root, 'docs', 'cheatsheet.html');
var SHEET_OUT = path.join(root, 'docs', 'BrosephTech-Bot-QuickRef.pdf');

// Must match the body width in guide-card.html. Height is deliberately NOT
// pinned here: the capture is fullPage, so adding a row to the guide can never
// silently crop the bottom off the poster.
var WIDTH = 1100;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  var browser = await chromium.launch();
  try {
    var page = await browser.newPage({
      viewport: { width: WIDTH, height: 1200 },
      // Render at 2x so the poster stays sharp when someone clicks to expand it.
      deviceScaleFactor: 2,
    });
    await page.goto('file://' + SOURCE.split(path.sep).join('/'));
    // Give layout a beat to settle so nothing is captured mid-reflow.
    await page.waitForTimeout(400);
    await page.screenshot({ path: OUT, fullPage: true });

    var size = await page.evaluate('({ w: document.body.scrollWidth, h: document.body.scrollHeight })');
    console.log('Wrote ' + OUT + ' (' + (size.w * 2) + 'x' + (size.h * 2) + ')');

    var sheet = await browser.newPage();
    await sheet.goto('file://' + SHEET_SOURCE.split(path.sep).join('/'));
    await sheet.waitForTimeout(200);
    await sheet.pdf({ path: SHEET_OUT, format: 'Letter', printBackground: true });
    console.log('Wrote ' + SHEET_OUT);
  } finally {
    await browser.close();
  }
}

main().catch(function(e) {
  var message = (e && e.message) || String(e);
  if (message.indexOf('Cannot find package') !== -1 || message.indexOf("Cannot find module 'playwright'") !== -1) {
    console.error('Playwright is not installed here. Run it from the parent repo, which already has it:');
    console.error('  cd .. && node bt-bot/scripts/render-guide.js');
    process.exit(1);
  }
  if (message.indexOf('Executable doesn') !== -1 || message.indexOf('browserType.launch') !== -1) {
    console.error('Playwright is installed but the Chromium build is missing. Run:');
    console.error('  npx playwright install chromium');
    process.exit(1);
  }
  console.error('Render failed: ' + message);
  process.exit(1);
});
