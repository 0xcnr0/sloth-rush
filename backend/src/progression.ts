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
