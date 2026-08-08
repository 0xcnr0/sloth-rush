/**
 * Evolution tiers — derived, never granted.
 *
 * A racer's tier is a pure function of its total stats, so it can only be
 * arrived at by racing (each finish adds +0.05 to a position-based stat, capped
 * at +0.3/day in routes/race.ts). There is no evolve button and nothing to pay.
 *
 * There used to be both: a modal, and an endpoint that demanded XP, race count,
 * win count, a stat floor AND 800 of the game currency before it would grant
 * the next tier. None of that was a decision — the player pressed the button as soon as
 * it lit up — and the currency requirement made visual progression something you
 * could stall on rather than something you earned by playing.
 *
 * Tier is what changes the racer's FORM; rarity is a separate axis and changes
 * its SURFACE. Neither touches the simulation.
 *
 * The thresholds are anchored to what the game can actually produce, which is
 * not what CLAUDE.md used to claim. Its table read 0/200/350/500, but per-stat
 * caps are 15 (free) and 22-35 (by rarity), so six stats top out at 90 for a
 * Wind-Up and 210 for a Mint Showcase: T2 and T3 were unreachable by any racer
 * that has ever existed. Nobody noticed because the old manual evolve endpoint
 * granted tiers against XP, race count and currency instead of the table, so
 * the document and the code described different games and neither was checked
 * against the other.
 *
 * The ladder below is the reachable range, and it lines up with the two axes
 * the game already has:
 *
 *   T0  <90    a fresh racer
 *   T1  90     a Wind-Up at its ceiling reaches exactly this and stops
 *   T2  130    needs the Showcase upgrade
 *   T3  170    needs the upgrade AND a good rarity roll
 */

/** Total-stat thresholds for T0 → T3. */
export const TIER_THRESHOLDS = [0, 90, 130, 170] as const;

export const MAX_TIER = TIER_THRESHOLDS.length - 1;

export interface StatBlock {
  spd: number;
  acc: number;
  sta: number;
  agi: number;
  ref: number;
  lck: number;
}

export function totalStats(s: StatBlock): number {
  return s.spd + s.acc + s.sta + s.agi + s.ref + s.lck;
}

/** The tier a racer with this stat total has reached. */
export function tierForStats(total: number): number {
  let tier = 0;
  for (let i = 1; i < TIER_THRESHOLDS.length; i++) {
    if (total >= TIER_THRESHOLDS[i]) tier = i;
  }
  return tier;
}

/** Stat total still needed for the next tier, or null at max. */
export function nextTierAt(total: number): number | null {
  const tier = tierForStats(total);
  return tier >= MAX_TIER ? null : TIER_THRESHOLDS[tier + 1];
}

/**
 * The archetype a racer grows into, from the stats it actually built.
 *
 * A Wind-Up starts plain — bare tin, no paint, no archetype — and stays that
 * way until it reaches the first tier. The form it takes then is not drawn at
 * mint and not bought: it is whichever stat the player pushed hardest, so the
 * races they chose are visible in the shape of the toy.
 *
 * Six stats, four archetypes, so they pair up. Ties resolve in a fixed order so
 * the same racer always resolves to the same form — this runs server-side after
 * a settle and must not depend on row order or on when it is asked.
 */
const ARCHETYPE_BY_STAT: [keyof StatBlock, string][] = [
  ["spd", "speedster"],
  ["sta", "tank"],
  ["acc", "burst"],
  ["ref", "burst"],
  ["lck", "trickster"],
  ["agi", "trickster"],
];

export function archetypeForStats(s: StatBlock): string {
  let best = ARCHETYPE_BY_STAT[0];
  let bestVal = -Infinity;
  for (const pair of ARCHETYPE_BY_STAT) {
    const v = s[pair[0]] ?? 0;
    if (v > bestVal) {
      bestVal = v;
      best = pair;
    }
  }
  return best[1];
}
