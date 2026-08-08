/**
 * How fast a racer is allowed to improve, in one place.
 *
 * Racing is the only source of stats — training, mini-games, boosters and
 * accessories are all gone — so these two numbers are the entire progression
 * curve of the game. They lived inside `routes/race.ts`, which was fine while
 * the settle path was the only code that needed them; it stopped being fine the
 * moment a screen had to tell the player how much of the day was left, because
 * the alternative was a second copy of 4.0 in a different file drifting away
 * from the one the server enforces.
 */

/**
 * What every stat starts at, free and Showcase alike (the Showcase adds a small
 * archetype bias on top).
 *
 * It was 10, which put a fresh racer at 60 total — far below the range every
 * other number in the game was tuned inside, and measurably so: a new player's
 * Sprint took 23.4s and their Endurance 51.0s while the lobby promised "about
 * 20" and "about 45". Those promised times belonged to a racer at ~12 per stat,
 * which is to say a racer nobody had ever owned on the day they first raced.
 *
 * 12 makes the promise true on the first race: 21.7s and 45.0s, measured over
 * 400 races per distance against the real engine.
 *
 * Raising this SPENDS the free racer's runway, which is why it did not move
 * alone — see FREE_STAT_CAP.
 */
export const MINT_BASE_STAT = 12;

/**
 * Per-stat ceilings, by tier and rarity. Six stats, so multiply by six for the
 * total a racer can ever reach, and compare against TIER_THRESHOLDS in
 * simulation/evolution.ts (90 / 130 / 170).
 *
 * Two of these numbers were chosen deliberately and both are worth reading:
 *
 *   free 18 — was 15, i.e. a total of exactly 90, exactly the first tier. That
 *     was a real design line: a Wind-Up reaches its first form precisely as it
 *     runs out of room. But it only worked while minting started at 10 and the
 *     climb took 7.5 days. At a base of 12 the same ceiling gives 4.5 days and
 *     then the racer every new player owns is finished forever. 18 gives a total
 *     of 108, so a Wind-Up reaches T1 in about four and a half days and then has
 *     roughly as long again to keep growing. T2 at 130 is still out of reach
 *     without the upgrade, which is the line that actually matters.
 *
 *   rare 29 — was 28, a total of 168 against a T3 threshold of 170. An Excellent
 *     Showcase could never reach the final form, by two points, which read as an
 *     off-by-a-hair rather than a design line: it left Fair, Good and Excellent
 *     all stuck at T2 with nothing separating them, so the middle of the rarity
 *     ladder did nothing at all. 29 gives 174.
 */
export const FREE_STAT_CAP = 18;

export const STAT_CAPS: Record<string, number> = {
  free: FREE_STAT_CAP,
  common: 22,
  uncommon: 25,
  rare: 29,
  epic: 31,
  legendary: 35,
};

/** The ceiling for one stat on this racer. Unknown rarities fall back to the lowest. */
export function statCapFor(type: string | undefined, rarity: string | undefined | null): number {
  if (type === "free") return STAT_CAPS.free;
  return (rarity && STAT_CAPS[rarity]) || STAT_CAPS.common;
}

/** Stat added to one stat per finish. Which stat depends on finishing position. */
export const PER_RACE_STAT_GAIN = 0.4;

/** The most one racer may gain in a day. About ten races fills it. */
export const DAILY_STAT_CAP = 4.0;

/**
 * YYYY-MM-DD in the server's own timezone, matching what Postgres reports.
 *
 * This was `toISOString()`, which is UTC. For a player three hours east of it,
 * every race between midnight and 03:00 local counted against the previous
 * day's budget — usually already spent — so they raced, won, and watched
 * nothing happen with no explanation given. A playtest hit exactly that and
 * reported stat growth as broken; it was the cap, invisible.
 *
 * One boundary, the same one the database reports, and in production the server
 * runs on UTC so the two agree by construction.
 */
export function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
