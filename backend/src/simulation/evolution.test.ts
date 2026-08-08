import { test } from 'node:test'
import assert from 'node:assert'
import { tierForStats, nextTierAt, MAX_TIER, TIER_THRESHOLDS, archetypeForStats } from './evolution'

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

test('a racer takes the form of the stat it built', () => {
  const base = { spd: 10, acc: 10, sta: 10, agi: 10, ref: 10, lck: 10 };
  assert.equal(archetypeForStats({ ...base, spd: 20 }), 'speedster');
  assert.equal(archetypeForStats({ ...base, sta: 20 }), 'tank');
  assert.equal(archetypeForStats({ ...base, acc: 20 }), 'burst');
  assert.equal(archetypeForStats({ ...base, ref: 20 }), 'burst');
  assert.equal(archetypeForStats({ ...base, lck: 20 }), 'trickster');
  assert.equal(archetypeForStats({ ...base, agi: 20 }), 'trickster');
});

test('a tie always resolves the same way', () => {
  // Runs server-side after a settle; it must not depend on row order or on
  // when it is asked, or the same racer could take two different forms.
  const flat = { spd: 12, acc: 12, sta: 12, agi: 12, ref: 12, lck: 12 };
  assert.equal(archetypeForStats(flat), archetypeForStats({ ...flat }));
  assert.equal(archetypeForStats(flat), 'speedster');
});
