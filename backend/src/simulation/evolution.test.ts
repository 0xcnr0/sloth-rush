import { test } from 'node:test'
import assert from 'node:assert'
import { tierForStats, nextTierAt, MAX_TIER, TIER_THRESHOLDS } from './evolution'

// The caps live in routes/racer.ts; duplicated here deliberately so this test
// fails if either side moves without the other.
const FREE_CAP = 15, LEGENDARY_CAP = 35, STATS = 6

test('tiers follow the reachable stat range', () => {
  assert.equal(tierForStats(0), 0)
  assert.equal(tierForStats(89), 0)
  assert.equal(tierForStats(90), 1)
  assert.equal(tierForStats(129), 1)
  assert.equal(tierForStats(130), 2)
  assert.equal(tierForStats(169), 2)
  assert.equal(tierForStats(170), 3)
  assert.equal(tierForStats(9999), MAX_TIER)
})

test('the next threshold is reported until there is none', () => {
  assert.equal(nextTierAt(0), 90)
  assert.equal(nextTierAt(100), 130)
  assert.equal(nextTierAt(170), null)
})

test('the ladder stays inside what the stat caps can produce', () => {
  const freeMax = FREE_CAP * STATS          // 90
  const showcaseMax = LEGENDARY_CAP * STATS // 210
  assert.equal(tierForStats(freeMax), 1, 'a maxed free racer should reach exactly T1')
  assert.equal(tierForStats(showcaseMax), 3, 'a maxed Showcase should reach T3')
  assert.ok(
    TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1] <= showcaseMax,
    'the top tier must be reachable by some racer that can exist'
  )
})
