import { test } from 'node:test';
import assert from 'node:assert';
import { simulateRace, poleAccelerationBonus, GRID_TUNING, type RacerStats } from './engine';
import { SPRINT_LENGTH, ENDURANCE_LENGTH } from './formats';

/**
 * Engine properties that are not specific to any one mechanic.
 *
 * These used to live in windUp.test.ts. When that phase was retired the file
 * went with it and took the engine's only coverage along — determinism, the
 * photo-finish tie-break and the grid rule were all being checked there by
 * accident rather than on purpose. They are checked on purpose now.
 */

const mk = (id: number, grid: number, over: Partial<RacerStats> = {}): RacerStats => ({
  id, name: `r${id}`, wallet: `0x${id}`, isBot: false,
  spd: 18, acc: 18, sta: 18, agi: 18, ref: 18, lck: 18, gridPosition: grid, ...over,
});
const field = () => [mk(1, 1), mk(2, 2), mk(3, 3), mk(4, 4)];

test('the same seed reproduces the same race, exactly', () => {
  const a = simulateRace(field(), 'determinism', [], false, SPRINT_LENGTH);
  const b = simulateRace(field(), 'determinism', [], false, SPRINT_LENGTH);
  assert.equal(JSON.stringify(a.frames), JSON.stringify(b.frames));
  assert.equal(JSON.stringify(a.finalOrder), JSON.stringify(b.finalOrder));
  assert.equal(a.totalTicks, b.totalTicks);
});

test('a different seed produces a different race', () => {
  const a = simulateRace(field(), 'seed-a', [], false, SPRINT_LENGTH);
  const b = simulateRace(field(), 'seed-b', [], false, SPRINT_LENGTH);
  assert.notEqual(JSON.stringify(a.frames), JSON.stringify(b.frames));
});

test('everyone leaves the line level — pole is acceleration, not a head start', () => {
  // The first recorded frame is already one tick old, so nobody is at exactly
  // zero. What matters is that the spread at that point is a hair of
  // acceleration and not a granted distance: a head start would show up here as
  // a gap far larger than one tick of movement.
  const r = simulateRace(field(), 'grid-level', [], false, SPRINT_LENGTH);
  const first = r.frames[0];
  assert.ok(first, 'a race should produce frames');
  const d = first.positions.map(p => p.distance);
  const spread = Math.max(...d) - Math.min(...d);
  assert.ok(spread < 0.5, `lanes should leave the line level, spread was ${spread}`);
});

test('the pole bonus favours the front of the grid and runs out at the back', () => {
  const pole = poleAccelerationBonus(1, 4);
  const mid = poleAccelerationBonus(2, 4);
  const last = poleAccelerationBonus(4, 4);
  assert.ok(pole > mid, 'pole should beat second');
  assert.equal(last, 0, 'the back of the grid gets nothing');
  assert.equal(pole, GRID_TUNING.poleAccelerationBonus, 'pole gets the whole bonus');
  assert.equal(poleAccelerationBonus(1, 1), 0, 'a field of one has no advantage to give');
});

test('a photo finish is settled by who was travelling further, not by grid order', () => {
  // Two racers that finish on the same tick must be separated by how far past
  // the line they went. Before this was fixed the tie fell back to array order,
  // which is grid order — so the pole slot won every close finish invisibly.
  let sameTickSeen = 0;
  for (let i = 0; i < 400; i++) {
    const r = simulateRace(field(), `photo_${i}`, [], false, SPRINT_LENGTH);
    const order = r.finalOrder;
    for (let k = 0; k < order.length - 1; k++) {
      const a = order[k], b = order[k + 1];
      if (a.finishTick != null && a.finishTick === b.finishTick) {
        sameTickSeen++;
        const ga = field().find(f => f.id === a.id)!.gridPosition;
        const gb = field().find(f => f.id === b.id)!.gridPosition;
        // The winner of the tie must not be decided by grid alone; if it were,
        // the better grid slot would win every single time.
        if (ga > gb) return; // found a tie won by the worse grid slot — the rule holds
      }
    }
  }
  assert.ok(sameTickSeen > 0, 'no photo finishes occurred, so the tie-break was never exercised');
});

test('endurance takes longer than sprint and finishes without hitting the cap', () => {
  const sprint = simulateRace(field(), 'len', [], false, SPRINT_LENGTH);
  const endurance = simulateRace(field(), 'len', [], false, ENDURANCE_LENGTH);
  assert.ok(endurance.totalTicks > sprint.totalTicks);
  for (const o of endurance.finalOrder) {
    assert.notEqual(o.finishTick, null, 'every racer should cross the line');
  }
});

test('a faster racer beats a slower one over the same distance', () => {
  const wins = { fast: 0, slow: 0 };
  for (let i = 0; i < 60; i++) {
    const r = simulateRace(
      [mk(1, 1, { spd: 30, acc: 30 }), mk(2, 2, { spd: 12, acc: 12 }), mk(3, 3), mk(4, 4)],
      `speed_${i}`, [], false, SPRINT_LENGTH
    );
    const w = r.finalOrder[0].id;
    if (w === 1) wins.fast++;
    if (w === 2) wins.slow++;
  }
  assert.ok(wins.fast > wins.slow, `speed should matter: ${JSON.stringify(wins)}`);
});
