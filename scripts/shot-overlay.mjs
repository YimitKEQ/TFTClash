import { chromium } from 'playwright'

var base = 'http://localhost:5173/overlay'

// Inject a colourful backdrop BEHIND the transparent overlay to simulate OBS
// compositing over gameplay - proves the background is see-through.
async function backdrop(page) {
  await page.evaluate(function () {
    var d = document.createElement('div')
    d.id = 'sim-bg'
    d.style.cssText = 'position:fixed;inset:0;z-index:-1;background:linear-gradient(135deg,#3a1c5e 0%,#13324f 45%,#5e2a1c 100%)'
    document.body.appendChild(d)
  })
}

var browser = await chromium.launch()
var page = await browser.newPage({ viewport: { width: 1280, height: 720 } })

async function shot(view, file, waitMs) {
  await page.goto(base + '?view=' + view, { waitUntil: 'networkidle' })
  await backdrop(page)
  await page.waitForTimeout(waitMs || 2500)
  await page.screenshot({ path: 'qa-shots/' + file })
  console.log('shot:', file)
}

await shot('spotlight', 'tft-spotlight.png', 2500)
await shot('standings', 'tft-standings.png', 2500)
await shot('rotate', 'tft-rotate.png', 2500)
await shot('soon', 'tft-soon.png', 2500)
// CTA fires ~4s after load; capture it mid-animation on spotlight
await shot('spotlight', 'tft-cta.png', 5200)

await browser.close()
console.log('done')
