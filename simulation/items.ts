/**
 * Race items — the one decision a player makes while a race is running.
 *
 * Two codes, theme-neutral as always (CLAUDE.md §0): `boost` acts on yourself,
 * `hinder` acts on a racer you name. Labels live in theme.ts.
 *
 * `hinder` used to hit whoever happened to be leading, which read as a decision
 * and was not one: the game picked the target, and the only thing the player
 * chose was a moment. Naming the target is the decision — hit the leader, or
 * hit the one closing on you from behind.
 *
 * ## Why this can exist now when Tactic Mode could not
 *
 * Tactic Mode was cut because the client submitted an action mid-playback and
 * then re-ran `simulateRace`, which restarted the race from tick 0 with a
 * different outcome — a player in the lead pressed boost and watched the race
 * begin again.
 *
 * The fix is not a resumable engine. It is a rule:
 *
 *   AN ITEM MAY ONLY BE SCHEDULED ONTO A TICK THAT HAS NOT BEEN REVEALED YET,
 *   AND APPLYING AN ITEM MUST NOT CONSUME RANDOMNESS.
 *
 * Given both, re-simulating from tick 0 with the new item list reproduces the
 * already-revealed prefix exactly, because the RNG stream is untouched and the
 * only changed multipliers act on ticks the player has not seen. The race can
 * therefore be resolved in batches while staying a single deterministic
 * function of (seed, item list) — which is what keeps it verifiable by anyone.
 *
 * `itemsPreserveHistory.test.ts` asserts the prefix stability directly rather
 * than trusting the argument.
 */

export type ItemCode = 'boost' | 'hinder';

export interface ScheduledItem {
  /** The racer who used it. */
  racerId: number;
  code: ItemCode;
  /**
   * Who it lands on. Required for `hinder`, ignored for `boost` (which always
   * acts on its user). Stored rather than derived so a replay of the same item
   * list reproduces the same race — deriving "the leader" at apply time would
   * make the result depend on the state at that tick.
   */
  targetId?: number;
  /** Tick the effect starts on. Must be beyond the revealed frontier. */
  tick: number;
}

export const ITEM_TUNING = {
  /**
   * Ticks an item stays active. Gigling runs 50 ticks (5 s) and that reads well
   * at 10 Hz — long enough to see, short enough that a race is not decided by
   * one press.
   */
  durationTicks: 50,
  /** Multiplier applied to the user's own speed. */
  boostMultiplier: 1.18,
  /** Multiplier applied to the named target's speed. */
  hinderMultiplier: 0.82,
  /**
   * Nothing may be slowed below this share of its own speed. A racer that can
   * be stopped outright turns the item into a punishment rather than a play.
   */
  hinderFloor: 0.5,
  /** Items each racer carries into a race. Not bought — there is no currency. */
  perRacer: 2,
  /**
   * How far ahead of the revealed frontier an item must land. One batch, so a
   * press always resolves into the next chunk the client has yet to receive.
   */
  batchTicks: 50,
} as const;

/** Speed multiplier for one racer at one tick, from the scheduled item list. */
export function itemMultiplier(
  items: ScheduledItem[],
  racerId: number,
  tick: number
): number {
  let mul = 1;
  for (const it of items) {
    if (tick < it.tick || tick >= it.tick + ITEM_TUNING.durationTicks) continue;
    if (it.code === 'boost' && it.racerId === racerId) {
      mul *= ITEM_TUNING.boostMultiplier;
    } else if (it.code === 'hinder' && it.targetId === racerId && it.racerId !== racerId) {
      mul *= ITEM_TUNING.hinderMultiplier;
    }
  }
  return Math.max(ITEM_TUNING.hinderFloor, mul);
}

/**
 * The earliest tick an item submitted now may be scheduled onto.
 * Anything at or after this is safe; anything before it would rewrite history.
 */
export function earliestSchedulableTick(revealedTick: number): number {
  return revealedTick + ITEM_TUNING.batchTicks;
}

/** Whether a submission is legal against the current frontier. */
export function isSchedulable(tick: number, revealedTick: number): boolean {
  return tick >= earliestSchedulableTick(revealedTick);
}
