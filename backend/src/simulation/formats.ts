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

/** Short race — roughly 24 seconds. */
export const SPRINT_LENGTH = 1600;
/** Long race — roughly 48 seconds. Twice the distance, so it is easy to explain. */
export const ENDURANCE_LENGTH = 3200;

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
