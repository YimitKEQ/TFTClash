// Local tournament simulation walkthrough.
// Boots a chromium against the dev server with ?sim=1 (Levitate auto-login,
// 64-player tournament, round 5 of 6, mid-cut). Visits every key screen,
// captures screenshots + console errors, and reports what works.

import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

var BASE = process.env.SIM_BASE || 'http://localhost:5174'
var OUT = 'tests/sim-results'
mkdirSync(OUT, { recursive: true })

var screens = [
  { route: '/?sim=1', name: '01-home' },
  { route: '/?sim=1#/dashboard', name: '02-dashboard' },
  { route: '/?sim=1#/bracket', name: '03-bracket' },
  { route: '/?sim=1#/standings', name: '04-standings' },
  { route: '/?sim=1#/leaderboard', name: '05-leaderboard' },
  { route: '/?sim=1#/player/Levitate', name: '06-player-profile' },
  { route: '/?sim=1#/results', name: '07-results' },
  { route: '/?sim=1#/hall-of-fame', name: '08-hof' },
  { route: '/?sim=1#/archive', name: '09-archive' },
  { route: '/?sim=1#/events', name: '10-events' },
  { route: '/?sim=1#/milestones', name: '11-milestones' },
  { route: '/?sim=1#/challenges', name: '12-challenges' },
  { route: '/?sim=1#/season-recap', name: '13-recap' },
  { route: '/?sim=1#/account', name: '14-account' },
  { route: '/?sim=1#/rules', name: '15-rules' },
  { route: '/?sim=1#/faq', name: '16-faq' },
  { route: '/links', name: '17-links' },
  { route: '/?sim=1#/donut17', name: '18-donut17' },
]

var report = []
var browser = await chromium.launch()
var ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
var page = await ctx.newPage()

var consoleErrors = []
page.on('console', function(msg){
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', function(err){ consoleErrors.push('PAGE ERROR: ' + err.message) })
page.on('response', function(res){
  var s = res.status()
  if (s >= 400) consoleErrors.push('HTTP ' + s + ' ' + res.url())
})

for (var i = 0; i < screens.length; i++) {
  var s = screens[i]
  var perScreenErrors = []
  var pushErr = function(msg){ if (msg.type() === 'error') perScreenErrors.push(msg.text()) }
  var pushPageErr = function(err){ perScreenErrors.push('PAGE ERROR: ' + err.message) }
  var pushHttpErr = function(res){ var s = res.status(); if (s >= 400) perScreenErrors.push('HTTP ' + s + ' ' + res.url()) }
  page.on('console', pushErr)
  page.on('pageerror', pushPageErr)
  page.on('response', pushHttpErr)

  var entry = { name: s.name, route: s.route, errors: [], crashed: false, missing: [] }
  try {
    await page.goto(BASE + s.route, { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(800)
    var errBoundary = await page.locator('text=Something went wrong').count()
    if (errBoundary > 0) entry.crashed = true
    var bodyText = await page.textContent('body')
    if (!bodyText || bodyText.trim().length < 30) entry.missing.push('empty body')
    await page.screenshot({ path: join(OUT, s.name + '.png'), fullPage: false })
  } catch (e) {
    entry.crashed = true
    entry.errors.push('NAV ERROR: ' + e.message)
  }
  entry.errors = entry.errors.concat(perScreenErrors)
  report.push(entry)
  page.off('console', pushErr)
  page.off('pageerror', pushPageErr)
  page.off('response', pushHttpErr)
}

await browser.close()

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))

var crashed = report.filter(function(r){ return r.crashed })
var withErrors = report.filter(function(r){ return r.errors.length > 0 })

console.log('\n=== SIM WALKTHROUGH RESULTS ===')
console.log('Total screens: ' + report.length)
console.log('Crashed:       ' + crashed.length)
console.log('Console errors: ' + withErrors.length)
console.log('')
report.forEach(function(r){
  var status = r.crashed ? 'CRASH' : (r.errors.length > 0 ? 'WARN ' : 'OK   ')
  console.log(status + ' ' + r.name + '  ' + r.route)
  r.errors.slice(0, 3).forEach(function(e){ console.log('       - ' + e.slice(0, 200)) })
  if (r.errors.length > 3) console.log('       (+ ' + (r.errors.length - 3) + ' more)')
})
console.log('\nScreenshots + report: ' + OUT)
