/**
 * Race formats — the single source of truth for what a race costs and how far
 * it runs. Labels live in `frontend/src/config/theme.ts` (CLAUDE.md §0); this
 * file holds mechanics only and never a display string.
 *
 * V1 ships two paid formats that differ in exactly one thing: distance. That
 * is deliberate. A second format only earns its place if it asks a different
 * question, and distance is the one lever measured to change the answer:
 *
 *   Sprint    — top speed decides. The fastest racer wins and fatigue barely
 *               registers.
 *   Endurance — balance decides. A racer that is only fast fades; a racer that
 *               is only durable was never fast enough to matter.
 *
 * Both cost the same on purpose. If Endurance cost more, players would choose
 * by wallet instead of by racer, and the choice would stop being about the toy
 * they own. The entry fee is a fixed cost; distance is the decision.
 *
 * The numbers come from `distanceLever.check.ts` and `fatigueSweep.ts`, not
 * from taste. Re-run both before moving any of them.
 *
 * Grand Prix and Tactic Challenge were cut from V1 — see
 * `frontend/src/config/features.ts` for which was cut for scope and which was
 * cut because it did not work.
 */

export interface RaceFormat {
  /** Stored in `races.format`. Theme-neutral, never shown to a player. */
  id: string;
  /** Entry fee in the game currency. */
  entry: number;
  /** Distance units the race is run over. */
  trackLength: number;
}

/**
 * Distances, in units, measured against the stat range the game actually mints.
 *
 * These were 1600/3200, derived from a sweep that used stats of 55-80. No racer
 * has ever had a stat above 35 — the caps are 15 (free) and 22-35 by rarity, and
 * a fresh racer mints near 10 — so a Sprint that was supposed to run 24 seconds
 * ran 56, and an Endurance ran into the simulation's tick ceiling without
 * finishing. Re-derived with `distanceLever.check.ts` inside the real caps.
 */
/** Short race — roughly 22 seconds for a fresh racer. */
export const SPRINT_LENGTH = 800;
/**
 * Long race — the measured crossover, where a pure sprinter and a balanced
 * racer win equally often (50.2 / 49.8 at 3000 runs).
 *
 * OPEN: duration depends heavily on how developed the racer is, and the spread
 * is wide. A fresh racer (~11 per stat, which is what mint produces) runs this
 * in about 62 seconds; a developed one (~20) in about 36. The distance that
 * makes STA decide anything for a developed racer is a long watch for a new
 * player, and the real cause is upstream: mint hands out ~10 per stat against
 * caps of 15 (free) and 22-35 (rarity), so a new racer starts far below the
 * range every other number was tuned for. Raising the mint floor is the fix,
 * and it is a balance decision that has not been taken.
 */
export const ENDURANCE_LENGTH = 1400;

export const RACE_FORMATS: Record<string, RaceFormat> = {
  exhibition: { id: 'exhibition', entry: 0, trackLength: SPRINT_LENGTH },
  sprint: { id: 'sprint', entry: 50, trackLength: SPRINT_LENGTH },
  endurance: { id: 'endurance', entry: 50, trackLength: ENDURANCE_LENGTH },
};

export const DEFAULT_FORMAT = 'sprint';

/**
 * Formats that no longer appear in the lobby but still sit in the database.
 * Finished races are replayed from history, so their rows have to keep
 * resolving to a distance — otherwise every archived race silently re-runs at
 * the wrong length. `standard` predates the Sprint/Endurance split and ran at
 * the old 2800.
 */
const RETIRED_FORMATS: Record<string, RaceFormat> = {
  standard: { id: 'standard', entry: 50, trackLength: 2800 },
  grand_prix: { id: 'grand_prix', entry: 150, trackLength: 2800 },
  gp_qualify: { id: 'gp_qualify', entry: 0, trackLength: 2800 },
  gp_final: { id: 'gp_final', entry: 0, trackLength: 2800 },
  tactic: { id: 'tactic', entry: 75, trackLength: 2800 },
};

/** Every format value the `races.format` CHECK constraint must still accept. */
export const ALL_FORMAT_IDS = [
  ...Object.keys(RACE_FORMATS),
  ...Object.keys(RETIRED_FORMATS),
];

/** Resolves a format id, including archived ones. Unknown ids fall back. */
export function raceFormat(id: string | null | undefined): RaceFormat {
  return (
    (id ? RACE_FORMATS[id] ?? RETIRED_FORMATS[id] : undefined) ??
    RACE_FORMATS[DEFAULT_FORMAT]
  );
}

/** Formats a player can actually enter right now. */
export function isPlayableFormat(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(RACE_FORMATS, id);
}
