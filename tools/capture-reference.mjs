/**
 * Screenshot an external page, for looking at reference games rather than
 * reading descriptions of them.
 *
 * Web search returns prose. Prose about art direction is nearly worthless —
 * "bright, cartoon-like visuals" describes a thousand different games. This
 * opens the actual page.
 *
 *   node tools/capture-reference.mjs <url> [waitMs] [outPath] [width] [height]
 *
 * --click x,y[;x,y...]  clicks those points in order, waiting between each, so
 *                       a game can be started rather than photographed on its
 *                       title screen. A title card tells you nothing about how
 *                       a race reads.
 *
 * Spends nothing and changes nothing; it only looks.
 */
import { chromium } from 'playwright-core'

const argv = process.argv.slice(2)
const [url, waitArg, outArg, wArg, hArg] = argv.filter((a) => !a.startsWith('--'))
const clickArg = argv.find((a) => a.startsWith('--click='))
if (!url) {
  console.error('usage: node tools/capture-reference.mjs <url> [waitMs] [out] [w] [h]')
  process.exit(2)
}
const waitMs = Number(waitArg || 6000)
const out = outArg || '/tmp/reference.png'
const width = Number(wArg || 1280)
const height = Number(hArg || 900)

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 2,
  // Some game portals serve a different page to unknown agents.
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
})
const page = await ctx.newPage()
page.on('console', () => {})
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
} catch (e) {
  console.error('navigation:', e.message)
}
await page.waitForTimeout(waitMs)

if (clickArg) {
  for (const pair of clickArg.slice('--click='.length).split(';')) {
    const [x, y] = pair.split(',').map(Number)
    try {
      await page.mouse.click(x, y)
      console.log('clicked', x, y)
    } catch (e) {
      console.error('click failed:', e.message)
    }
    await page.waitForTimeout(3500)
  }
  await page.waitForTimeout(waitMs)
}

await page.screenshot({ path: out })
console.log('wrote', out)
await browser.close()
