/**
 * Capture every screen the game actually has, into docs/screens/.
 *
 * Written to be handed to somebody who has never seen the game, so the flow
 * screens are DRIVEN rather than deep-linked: the countdown, the item in flight,
 * the finish freeze and the form change only exist for a moment each, and a URL
 * cannot reach them.
 */
import { chromium } from 'playwright-core'
import { execSync } from 'node:child_process'

const OUT = 'docs/screens'
const BASE = 'http://localhost:5173'
const API = 'http://localhost:3001/api'
const DEV = '0x334a13C2DdC4eE734fC9eA20F6475179690fE2F2'
const FRESH = '0x1111111111111111111111111111111111111111'
const FORM = '0x6666666666666666666666666666666666666666'

const sh = (c) => execSync(c, { encoding: 'utf8' }).trim()
const post = (p, b) => JSON.parse(sh(`curl -s -X POST ${API}${p} -H 'Content-Type: application/json' -d '${JSON.stringify(b)}'`))

function newRace(wallet, racerId, format = 'sprint') {
  const r = post('/race/create', { wallet, racerId, format })
  post('/race/join', { raceId: r.raceId, racerId, wallet, loadout: ['boost', 'hinder'] })
  post('/race/start', { raceId: r.raceId })
  return r.raceId
}

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const shots = []
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); shots.push(name); console.log('  ✓', name) }

// --- onboarding: the one screen that needs a clean localStorage -------------
await page.goto(`${BASE}/?preview=1`, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await shot('01-onboarding')

// everything after this wants the tutorial out of the way
await page.evaluate(() => localStorage.setItem('onboarding-complete', 'true'))

const still = [
  ['02-landing', `${BASE}/?preview=1`, 3500],
  ['03-mint-idle', `${BASE}/mint?preview=${FRESH}`, 3000],
  ['04-toybox', `${BASE}/collection?preview=1`, 3500],
  ['05-race-lobby', `${BASE}/race?preview=1`, 3000],
  ['12-shelf-public', `${BASE}/shelf/${DEV}`, 4000],
  ['13-profile', `${BASE}/profile?preview=1`, 3000],
  ['14-ranks', `${BASE}/leaderboard?preview=1`, 3000],
  ['15-guide', `${BASE}/guide?preview=1`, 2500],
]
for (const [name, url, wait] of still) {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(wait)
  await shot(name)
}

// --- the mint reveal, driven ------------------------------------------------
await page.goto(`${BASE}/mint?preview=0x7777777777777777777777777777777777777777`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
const mintBtn = page.getByRole('button', { name: /MINT/i })
if (await mintBtn.count()) {
  await mintBtn.click()
  await page.waitForTimeout(800); await shot('03b-mint-winding')
  await page.waitForTimeout(2200); await shot('03c-mint-alive')
}

// --- a race, driven start to finish ----------------------------------------
let id = newRace(DEV, 171)
await page.goto(`${BASE}/race/${id}?preview=1&racer=171`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(900);  await shot('06-race-countdown')
await page.waitForTimeout(4000); await shot('07-race-running')

// press an item so the strip and the ring are on screen
const boost = page.getByTestId('item-boost')
if (await boost.count()) {
  await boost.click().catch(() => {})
  await page.waitForTimeout(1200); await shot('08-item-in-flight')
  await page.waitForTimeout(6000); await shot('09-item-landed')
}
await page.waitForTimeout(14000); await shot('10-race-finish')
await page.waitForTimeout(4000);  await shot('11-result-screen')

// --- the form change, on the racer parked at 89.6 --------------------------
sh(`psql -q postgres://localhost:5432/wind_up_rush -c "UPDATE racers SET spd=17.6, acc=15, sta=15, agi=14, ref=14, lck=14, tier=0, race=NULL WHERE id=838; DELETE FROM daily_stat_gains WHERE racer_id=838; DELETE FROM racer_milestones WHERE racer_id=838;"`)
id = newRace(FORM, 838)
await page.goto(`${BASE}/race/${id}?preview=${FORM}&racer=838`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(42000)
await shot('11b-form-change')

console.log(`\n${shots.length} screens -> ${OUT}/`)
await browser.close()
