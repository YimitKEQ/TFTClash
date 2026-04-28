// Drives the live UI through the test tournament we just inserted into the DB,
// covering every screen that should reflect a completed custom tournament.
// Captures console errors / page errors / HTTP 4xx and screenshots each screen.

import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

var BASE = process.env.SIM_BASE || 'http://localhost:5174'
var TID = process.env.SIM_TID || 'b2749164-3188-4ae4-8e9a-7ef4310169e8'
var OUT = 'tests/sim-results-tournament'
mkdirSync(OUT, { recursive: true })

var screens = [
  { route: '/', name: '01-home' },
  { route: '/events', name: '02-events' },
  { route: '/tournament/' + TID, name: '03-tournament-detail' },
  { route: '/results', name: '04-results' },
  { route: '/standings', name: '05-standings' },
  { route: '/leaderboard', name: '06-leaderboard' },
  { route: '/hall-of-fame', name: '07-hof' },
  { route: '/player/Levitate', name: '08-player-levitate' },
  { route: '/player/Vlad', name: '09-player-vlad' },
  { route: '/dashboard', name: '10-dashboard' },
]

var report = []
var browser = await chromium.launch()
var ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
var page = await ctx.newPage()

for (var i = 0; i < screens.length; i++) {
  var s = screens[i]
  var perScreenErrors = []
  var pushErr = function(msg){ if (msg.type() === 'error') perScreenErrors.push(msg.text()) }
  var pushPageErr = function(err){ perScreenErrors.push('PAGE ERROR: ' + err.message) }
  var pushHttpErr = function(res){
    var status = res.status()
    if (status >= 400 && status < 500) {
      var url = res.url()
      // Filter Supabase 406 on .single() with no rows (benign in many places)
      perScreenErrors.push('HTTP ' + status + ' ' + url.slice(0, 200))
    }
  }
  page.on('console', pushErr)
  page.on('pageerror', pushPageErr)
  page.on('response', pushHttpErr)

  var entry = { name: s.name, route: s.route, errors: [], crashed: false }
  try {
    await page.goto(BASE + s.route, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(1200)
    var errBoundary = await page.locator('text=Something went wrong').count()
    if (errBoundary > 0) entry.crashed = true
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
var withErr = report.filter(function(r){ return r.errors.length > 0 })

console.log('\n=== TOURNAMENT-DETAIL WALKTHROUGH ===')
console.log('Total: ' + report.length + '  Crashed: ' + crashed.length + '  With errors: ' + withErr.length)
console.log('')
report.forEach(function(r){
  var status = r.crashed ? 'CRASH' : (r.errors.length > 0 ? 'WARN ' : 'OK   ')
  console.log(status + ' ' + r.name + '  ' + r.route)
  r.errors.slice(0, 4).forEach(function(e){ console.log('       - ' + e.slice(0, 220)) })
  if (r.errors.length > 4) console.log('       (+ ' + (r.errors.length - 4) + ' more)')
})
console.log('\nReport: ' + OUT + '/report.json')
