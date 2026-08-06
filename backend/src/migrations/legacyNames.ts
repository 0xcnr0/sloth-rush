/**
 * QUARANTINE FILE — historical schema identifiers.
 *
 * This project has been rebranded twice. A database created under an older
 * brand still carries that brand's physical table and column names, so the
 * one-time rename statements below have to spell those old names out.
 *
 * This is the ONLY file outside `frontend/src/config/theme.ts` allowed to
 * contain retired theme vocabulary, and it may only contain rename/backfill
 * SQL — never live query paths. The verification grep excludes exactly these
 * two files; if a third one shows up, something leaked.
 *
 * Every statement is executed inside a try/catch by the caller, so on an
 * already-migrated database each one throws harmlessly and is skipped.
 */

/** Renames of physical tables and columns, oldest brand first. */
export const LEGACY_RENAMES: string[] = [
  // --- two brands ago -> one brand ago ---
  `ALTER TABLE IF EXISTS slugs RENAME TO sloths`,
  `ALTER TABLE IF EXISTS race_participants RENAME COLUMN snail_id TO sloth_id`,
  `ALTER TABLE IF EXISTS tactic_actions RENAME COLUMN snail_id TO sloth_id`,
  `ALTER TABLE IF EXISTS streaks RENAME COLUMN snail_id TO sloth_id`,
  `ALTER TABLE IF EXISTS race_points RENAME COLUMN snail_id TO sloth_id`,
  `ALTER TABLE IF EXISTS trainings RENAME COLUMN snail_id TO sloth_id`,
  `ALTER TABLE IF EXISTS daily_stat_gains RENAME COLUMN snail_id TO sloth_id`,
  `ALTER TABLE IF EXISTS daily_minigame_plays RENAME COLUMN snail_id TO sloth_id`,
  `ALTER TABLE IF EXISTS user_cosmetics RENAME COLUMN equipped_snail_id TO equipped_sloth_id`,
  `ALTER TABLE IF EXISTS snail_equipment RENAME TO sloth_equipment`,
  `ALTER TABLE IF EXISTS sloth_equipment RENAME COLUMN snail_id TO sloth_id`,
  `ALTER TABLE IF EXISTS cosmetics RENAME COLUMN slug_price TO sloth_price`,
  `ALTER TABLE IF EXISTS accessories RENAME COLUMN slug_price TO sloth_price`,
  `ALTER TABLE IF EXISTS season_rewards RENAME COLUMN slug_reward TO sloth_reward`,
  `ALTER TABLE IF EXISTS quests RENAME COLUMN slug_reward TO sloth_reward`,

  // --- one brand ago -> current, theme-neutral schema ---
  `ALTER TABLE IF EXISTS sloths RENAME TO racers`,
  `ALTER TABLE IF EXISTS sloth_equipment RENAME TO racer_equipment`,
  `ALTER TABLE IF EXISTS racer_equipment RENAME COLUMN sloth_id TO racer_id`,
  `ALTER TABLE IF EXISTS race_participants RENAME COLUMN sloth_id TO racer_id`,
  `ALTER TABLE IF EXISTS tactic_actions RENAME COLUMN sloth_id TO racer_id`,
  `ALTER TABLE IF EXISTS streaks RENAME COLUMN sloth_id TO racer_id`,
  `ALTER TABLE IF EXISTS race_points RENAME COLUMN sloth_id TO racer_id`,
  `ALTER TABLE IF EXISTS trainings RENAME COLUMN sloth_id TO racer_id`,
  `ALTER TABLE IF EXISTS daily_stat_gains RENAME COLUMN sloth_id TO racer_id`,
  `ALTER TABLE IF EXISTS daily_minigame_plays RENAME COLUMN sloth_id TO racer_id`,
  `ALTER TABLE IF EXISTS user_cosmetics RENAME COLUMN equipped_sloth_id TO equipped_racer_id`,
  `ALTER TABLE IF EXISTS cosmetics RENAME COLUMN sloth_price TO coin_price`,
  `ALTER TABLE IF EXISTS accessories RENAME COLUMN sloth_price TO coin_price`,
  `ALTER TABLE IF EXISTS season_rewards RENAME COLUMN sloth_reward TO coin_reward`,
  `ALTER TABLE IF EXISTS quests RENAME COLUMN sloth_reward TO coin_reward`,

  // Indexes carried the old names too; drop them so db.ts can recreate them.
  `DROP INDEX IF EXISTS idx_sloths_wallet`,
  `DROP INDEX IF EXISTS idx_sloths_wallet_burned`,
  `DROP INDEX IF EXISTS idx_race_participants_sloth`,
  `DROP INDEX IF EXISTS idx_streaks_sloth`,
  `DROP INDEX IF EXISTS idx_trainings_sloth`,
  `DROP INDEX IF EXISTS idx_sloth_equipment_sloth`,

  // Renaming a table does NOT rename its CHECK constraints or its sequence.
  // These old-named constraints would silently reject the value migration
  // below, so they have to come off by their historical names.
  `ALTER TABLE racers DROP CONSTRAINT IF EXISTS slugs_type_check`,
  `ALTER TABLE racers DROP CONSTRAINT IF EXISTS sloths_type_check`,
  `ALTER SEQUENCE IF EXISTS slugs_id_seq RENAME TO racers_id_seq`,
  `ALTER SEQUENCE IF EXISTS sloths_id_seq RENAME TO racers_id_seq`,
  `ALTER TABLE racers RENAME CONSTRAINT sloths_pkey TO racers_pkey`,
  `ALTER TABLE racers RENAME CONSTRAINT sloths_rarity_check TO racers_rarity_check`,
  `ALTER TABLE racer_equipment RENAME CONSTRAINT sloth_equipment_pkey TO racer_equipment_pkey`,
];

/**
 * Retirement of the pre-race spending mechanic and the winner-prediction
 * system. Both are gone from the game; these statements exist only to carry an
 * existing database across, which means naming the columns they used to have.
 *
 * `wind_tension` is deliberately the *final* name, not a like-for-like rename:
 * the column now holds skill-derived spring tension (0-100), so the old
 * currency amounts it carried are reset rather than migrated.
 */
export const RETIRED_MECHANIC_MIGRATIONS: string[] = [
  `ALTER TABLE IF EXISTS races RENAME COLUMN max_raise TO max_tune`,
  `ALTER TABLE IF EXISTS race_participants RENAME COLUMN bid_amount TO wind_tension`,
  `ALTER TABLE IF EXISTS race_participants RENAME COLUMN payout TO reward`,
  `UPDATE race_participants SET wind_tension = 0 WHERE wind_tension <> 0`,
  `ALTER TABLE race_participants DROP CONSTRAINT IF EXISTS race_participants_wind_tension_check`,
  `ALTER TABLE race_participants ADD CONSTRAINT race_participants_wind_tension_check CHECK(wind_tension >= 0 AND wind_tension <= 100)`,
  `ALTER TABLE races DROP CONSTRAINT IF EXISTS races_status_check`,
  `UPDATE races SET status = 'tuning' WHERE status = 'bidding'`,
  `ALTER TABLE races ADD CONSTRAINT races_status_check CHECK(status IN ('lobby', 'tuning', 'racing', 'finished'))`,
  `DROP INDEX IF EXISTS idx_predictions_race`,
  `DROP TABLE IF EXISTS predictions`,

  // --- Tune-Up's last column, and the Sprint/Endurance split ---
  // Renaming a table does not rename its CHECK constraints, and neither does
  // adding a value to one: the old constraint has to be dropped by name first
  // or every insert of a new format is rejected while the migration log still
  // reads clean. That failure mode has already cost this project once.
  `ALTER TABLE IF EXISTS races DROP COLUMN IF EXISTS max_tune`,
  // Added nullable on purpose. Every row that exists when the column appears
  // predates the Sprint/Endurance split and was raced at the old 2800, so NULL
  // is exactly the marker for "historical" — and backfilling only NULLs makes
  // the statement safe to re-run, which it will be, on every boot. An
  // unconditional UPDATE here would quietly reset live races to 2800 forever
  // after, and a WHERE on format would miss archived exhibitions.
  `ALTER TABLE IF EXISTS races ADD COLUMN IF NOT EXISTS track_length INTEGER`,
  `UPDATE races SET track_length = 2800 WHERE track_length IS NULL`,
  `ALTER TABLE races ALTER COLUMN track_length SET DEFAULT 1600`,
  `ALTER TABLE races ALTER COLUMN track_length SET NOT NULL`,
  `ALTER TABLE races DROP CONSTRAINT IF EXISTS races_format_check`,
  `ALTER TABLE races ADD CONSTRAINT races_format_check CHECK(format IN ('exhibition', 'sprint', 'endurance', 'standard', 'grand_prix', 'tactic', 'gp_qualify', 'gp_final'))`,

  // --- the in-game currency, retired ---
  // V1 races are free and there is nothing to buy, so nothing reads or writes
  // these. They are dropped rather than left in place because an unused table
  // is the same kind of debt as unused code: the next schema change still has
  // to think about it, and the next reader still has to work out whether it
  // matters. Entry fees stay on `races` and `race_participants.reward` stays at
  // 0 so finished races keep their shape in history.
  `DROP TABLE IF EXISTS transactions`,
  `DROP TABLE IF EXISTS coin_balances`,
  `DROP TABLE IF EXISTS daily_logins`,
  `DROP TABLE IF EXISTS daily_free_races`,
  `DROP TABLE IF EXISTS user_quest_progress`,
  `DROP TABLE IF EXISTS quests`,
  `DROP TABLE IF EXISTS trainings`,
  `DROP TABLE IF EXISTS daily_minigame_plays`,
  `DROP TABLE IF EXISTS cosmetics`,
  `DROP TABLE IF EXISTS user_cosmetics`,
  `DROP TABLE IF EXISTS accessories`,
  `DROP TABLE IF EXISTS racer_equipment`,
  `DROP TABLE IF EXISTS user_accessories`,

  // --- the Wind-Up phase, retired ---
  // Replaced by an item loadout chosen before the race and deployed during it.
  // The phase measured how long a button was held; the loadout asks a question
  // the player can actually answer, and the timing of a deployment is where the
  // skill went.
  `ALTER TABLE IF EXISTS race_participants ADD COLUMN IF NOT EXISTS loadout TEXT NOT NULL DEFAULT 'boost,hinder'`,
  `ALTER TABLE IF EXISTS races ADD COLUMN IF NOT EXISTS started_at TIMESTAMP`,
  `ALTER TABLE IF EXISTS race_participants DROP COLUMN IF EXISTS wind_tension`,
  `ALTER TABLE IF EXISTS race_participants DROP COLUMN IF EXISTS wind_pressed_at`,
  `ALTER TABLE IF EXISTS race_participants DROP COLUMN IF EXISTS wind_snapped`,
  `ALTER TABLE IF EXISTS race_participants DROP COLUMN IF EXISTS wind_locked`,
  `ALTER TABLE IF EXISTS races DROP COLUMN IF EXISTS tuning_opened_at`,
  // `status = 'tuning'` was the Wind-Up window. Races now go lobby -> racing.
  `ALTER TABLE races DROP CONSTRAINT IF EXISTS races_status_check`,
  `UPDATE races SET status = 'racing' WHERE status = 'tuning'`,
  `ALTER TABLE races ADD CONSTRAINT races_status_check CHECK(status IN ('lobby', 'racing', 'finished'))`,
  `DROP TABLE IF EXISTS tactic_actions`,
];

/**
 * Retired value-level aliases, per column. Each entry maps a current,
 * functional value to every historical value that should become it.
 */
export const LEGACY_VALUE_ALIASES: {
  table: string;
  column: string;
  map: Record<string, string[]>;
}[] = [
  {
    table: "racers",
    column: "type",
    map: {
      free: ["free_sloth", "free_slug"],
      pro: ["sloth", "snail"],
    },
  },
  {
    // `race` holds the archetype; the column name predates the rename.
    table: "racers",
    column: "race",
    map: {
      speedster: ["caffeine_junkie", "turbo_slug"],
      tank: ["pillow_knight", "shell_knight"],
      trickster: ["dream_weaver", "goo_mage"],
      burst: ["thunder_nap", "storm_racer"],
    },
  },
  {
    table: "racers",
    column: "passive",
    map: {
      late_surge: ["caffeine_rush", "speed_burst"],
      overtake_boost: ["adrenaline_wake", "speed_overtake"],
      fatigue_resist: ["deep_sleep", "fatigue_slow"],
      impact_resist: ["thick_fur", "shell_resist"],
      luck_magnet: ["dream_catcher"],
      misfortune_flip: ["lucid_dream", "bad_to_good"],
    },
  },
  {
    table: "racers",
    column: "evolution_path",
    map: {
      speed: ["caffeine", "velocity"],
      endurance: ["hibernate", "fortress"],
      luck: ["dreamwalk", "mystic"],
    },
  },
  {
    table: "tactic_actions",
    column: "action_type",
    map: {
      projectile: ["pillow", "shell"],
    },
  },
  {
    table: "quests",
    column: "requirement_type",
    map: {
      home_visit: ["treehouse_visit", "stable_visit"],
    },
  },
];

/** Expands LEGACY_VALUE_ALIASES into idempotent UPDATE statements. */
export function legacyValueUpdates(): string[] {
  const statements: string[] = [];
  for (const { table, column, map } of LEGACY_VALUE_ALIASES) {
    for (const [current, retired] of Object.entries(map)) {
      const list = retired.map((v) => `'${v}'`).join(", ");
      statements.push(
        `UPDATE ${table} SET ${column} = '${current}' WHERE ${column} IN (${list})`
      );
    }
  }
  return statements;
}
