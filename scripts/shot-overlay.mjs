import { chromium } from 'playwright'

var base = 'http://localhost:5173/overlay'
var shots = [
  { url: base + '?view=spotlight&bg=gradient', file: 'shot-spotlight.png' },
  { url: base + '?view=standings&bg=gradient', file: 'shot-standings.png' },
  { url: base + '?view=soon&bg=gradient', file: 'shot-soon.png' }
]

var browser = await chromium.launch()
var page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
for (var i = 0; i < shots.length; i++) {
  await page.goto(shots[i].url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa-shots/' + shots[i].file })
  console.log('shot:', shots[i].file)
}
await browser.close()
console.log('done')
