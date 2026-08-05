/**
 * Screenshot a page from the running dev server, for checking UI work by eye.
 *
 * Typechecks and unit tests both pass on a canvas that draws nothing, so a
 * render change is not verified until somebody looks at it. This is how.
 *
 *   node tools/screenshot.mjs <url> [waitMs] [outPath] [--canvas]
 *
 * --canvas captures only the first <canvas> element, which skips wallet and
 * onboarding overlays that would otherwise sit on top of the thing under test.
 *
 * Uses the Chrome already on the machine via playwright-core, so there is no
 * browser download.
 */
import { chromium } from 'playwright-core'

const args = process.argv.slice(2)
const url = args[0]
const waitMs = Number(args[1] || 4000)
const out = args[2] && !args[2].startsWith('--') ? args[2] : '/tmp/screenshot.png'
const canvasOnly = args.includes('--canvas')

if (!url) {
  console.error('usage: node tools/screenshot.mjs <url> [waitMs] [outPath] [--canvas]')
  process.exit(2)
}

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 3 })
await ctx.addInitScript(() => localStorage.setItem('onboarding-complete', 'true'))
const page = await ctx.newPage()
page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 200)))
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 200)) })

await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(waitMs)

if (canvasOnly) {
  await page.addStyleTag({ content: '.fixed{display:none !important}' })
  await page.waitForTimeout(400)
  const canvas = await page.$('canvas')
  if (!canvas) { console.error('no canvas on the page'); await browser.close(); process.exit(1) }
  await canvas.screenshot({ path: out })
} else {
  await page.screenshot({ path: out })
}
console.log('wrote', out)
await browser.close()
