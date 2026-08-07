import { test } from 'node:test';
import assert from 'node:assert';
import { simulateRace, type RacerStats } from './engine';
import { ITEM_TUNING, isSchedulable, earliestSchedulableTick, itemMultiplier } from './items';

/**
 * The correctness argument for in-race items, asserted rather than reasoned.
 *
 * Tactic Mode was cut because submitting an action restarted the race with a
 * different outcome. Items are allowed back only because of one property: an
 * item scheduled onto a future tick cannot change any frame before it. If that
 * property ever breaks, the race stops being reproducible from its seed and the
 * whole "anyone can verify this" claim goes with it — so it is tested directly.
 */

const mk = (id: number, grid: number): RacerStats => ({
  id, name: `r${id}`, wallet: `0x${id}`, isBot: false,
  spd: 18, acc: 18, sta: 18, agi: 18, ref: 18, lck: 18, gridPosition: grid,
});

const field = () => [mk(1, 1), mk(2, 2), mk(3, 3), mk(4, 4)];
const SEED = 'items-history-seed';

function framesUpTo(r: ReturnType<typeof simulateRace>, tick: number) {
  return JSON.stringify(r.frames.filter(f => f.tick < tick).map(f => f.positions));
}

test('an item scheduled at tick T leaves every frame before T untouched', () => {
  const T = 200;
  const without = simulateRace(field(), SEED, [], false, 1600, []);
  const withItem = simulateRace(field(), SEED, [], false, 1600, [
    { racerId: 1, code: 'boost', tick: T },
  ]);

  assert.equal(
    framesUpTo(withItem, T),
    framesUpTo(without, T),
    'frames before the item tick must be bit-identical, or the revealed race changed under the player'
  );
});

test('the item does change the race after its tick', () => {
  const T = 100;
  const without = simulateRace(field(), SEED, [], false, 1600, []);
  const withItem = simulateRace(field(), SEED, [], false, 1600, [
    { racerId: 1, code: 'boost', tick: T },
  ]);
  assert.notEqual(
    framesUpTo(withItem, T + ITEM_TUNING.durationTicks + 20),
    framesUpTo(without, T + ITEM_TUNING.durationTicks + 20),
    'an item that changes nothing is not a mechanic'
  );
});

test('several items stack without disturbing the shared prefix', () => {
  const T = 300;
  const base = simulateRace(field(), SEED, [], false, 1600, [
    { racerId: 1, code: 'boost', tick: 60 },
  ]);
  const more = simulateRace(field(), SEED, [], false, 1600, [
    { racerId: 1, code: 'boost', tick: 60 },
    { racerId: 2, code: 'hinder', targetId: 1, tick: T },
    { racerId: 3, code: 'boost', tick: T + 10 },
  ]);
  assert.equal(framesUpTo(more, T), framesUpTo(base, T));
});

test('nothing may be scheduled onto a tick the player has already seen', () => {
  const revealed = 400;
  assert.equal(isSchedulable(revealed, revealed), false);
  assert.equal(isSchedulable(revealed + 1, revealed), false);
  assert.equal(isSchedulable(earliestSchedulableTick(revealed), revealed), true);
  assert.equal(earliestSchedulableTick(revealed), revealed + ITEM_TUNING.batchTicks);
});

test('a racer cannot be slowed to a standstill', () => {
  const many = Array.from({ length: 6 }, () => ({
    racerId: 9, code: 'hinder' as const, targetId: 1, tick: 0,
  }));
  const mul = itemMultiplier(many, 1, 10);
  assert.ok(mul >= ITEM_TUNING.hinderFloor, `floor breached: ${mul}`);
});

test('boost applies to the user, hinder applies to the racer it names', () => {
  const boost = [{ racerId: 1, code: 'boost' as const, tick: 0 }];
  assert.ok(itemMultiplier(boost, 1, 10) > 1, 'the user should speed up');
  assert.equal(itemMultiplier(boost, 2, 10), 1, 'nobody else should');

  // The target is named by the player, not derived from the running order —
  // deriving it would make the result depend on the state at the apply tick,
  // and the same item list would stop reproducing the same race.
  const hinder = [{ racerId: 1, code: 'hinder' as const, targetId: 3, tick: 0 }];
  assert.ok(itemMultiplier(hinder, 3, 10) < 1, 'the named target should slow');
  assert.equal(itemMultiplier(hinder, 2, 10), 1, 'a racer who was not named should not');
  assert.equal(itemMultiplier(hinder, 1, 10), 1, 'and never the thrower');

  const atSelf = [{ racerId: 1, code: 'hinder' as const, targetId: 1, tick: 0 }];
  assert.equal(itemMultiplier(atSelf, 1, 10), 1, 'naming yourself does nothing');
});

test('an item stops mattering once its window closes', () => {
  const items = [{ racerId: 1, code: 'boost' as const, tick: 100 }];
  assert.equal(itemMultiplier(items, 1, 99), 1);
  assert.ok(itemMultiplier(items, 1, 100) > 1);
  assert.ok(itemMultiplier(items, 1, 100 + ITEM_TUNING.durationTicks - 1) > 1);
  assert.equal(itemMultiplier(items, 1, 100 + ITEM_TUNING.durationTicks), 1);
});
