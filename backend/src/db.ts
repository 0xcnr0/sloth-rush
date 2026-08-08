import { Pool, PoolClient } from "pg";
import {
  LEGACY_RENAMES,
  RETIRED_MECHANIC_MIGRATIONS,
  legacyValueUpdates,
} from "./migrations/legacyNames";

const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.RAILWAY_ENVIRONMENT === "production";

if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL not set. Falling back to individual PG env vars or localhost.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
});

// Helper: run any query (INSERT/UPDATE/DELETE or SELECT)
export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

// Helper: SELECT single row (returns row object or null)
export async function getOne(
  text: string,
  params?: any[]
): Promise<any> {
  const res = await pool.query(text, params);
  return res.rows[0] || null;
}

// Helper: SELECT multiple rows (returns array)
export async function getAll(
  text: string,
  params?: any[]
): Promise<any[]> {
  const res = await pool.query(text, params);
  return res.rows;
}

// Helper: run a function inside a transaction
export async function runTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Rebuild the streak counters from the race log.
 *
 * `streaks` is a denormalised counter and it has drifted badly: racer 171 reads
 * 127 races and 23 wins while the race log holds 83 participations, 60 of them
 * settled, 14 of them won. The cause is historical and is already fixed —
 * /simulate used to award streaks on every call instead of once per race, so a
 * single race could be counted four times. The guard exists now; the numbers it
 * inflated were never corrected.
 *
 * This matters more than a wrong number on a card. The Career leaderboard sorts
 * on total_wins, so the board has been ranking players by how many times they
 * happened to reload a race page.
 *
 * The repair recomputes every column from `race_participants`, which is the
 * source of truth — one row per racer per race, finish_position filled in by
 * the settle. It runs on every boot on purpose: it is a recompute rather than a
 * patch, so if the counter ever drifts again a restart heals it, and at this
 * scale it costs milliseconds.
 */
async function repairStreaks(): Promise<void> {
  const rows = await pool.query<{ racer_id: number; finish_position: number }>(
    `SELECT rp.racer_id, rp.finish_position
       FROM race_participants rp
       JOIN races r ON r.id = rp.race_id
      WHERE rp.finish_position IS NOT NULL
      ORDER BY rp.racer_id, r.created_at`
  );

  const byRacer = new Map<number, number[]>();
  for (const row of rows.rows) {
    const list = byRacer.get(row.racer_id) ?? [];
    list.push(row.finish_position);
    byRacer.set(row.racer_id, list);
  }

  for (const [racerId, places] of byRacer) {
    let totalWins = 0, curWins = 0, maxWins = 0, curLosses = 0, maxLosses = 0;
    for (const place of places) {
      if (place === 1) {
        totalWins++;
        curWins++; curLosses = 0;
        if (curWins > maxWins) maxWins = curWins;
      } else {
        curLosses++; curWins = 0;
        if (curLosses > maxLosses) maxLosses = curLosses;
      }
    }
    await pool.query(
      `INSERT INTO streaks (racer_id, current_wins, max_wins, current_losses, max_losses, total_races, total_wins)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (racer_id) DO UPDATE SET
         current_wins = $2, max_wins = $3, current_losses = $4,
         max_losses = $5, total_races = $6, total_wins = $7`,
      [racerId, curWins, maxWins, curLosses, maxLosses, places.length, totalWins]
    );
  }
  console.log(`initDB: streak counters rebuilt for ${byRacer.size} racers`);
}

export async function initDB() {
  // === MIGRATION BLOCK: rename old schema to new (safe to re-run) ===
  // Each statement is idempotent-by-try/catch: on an already-migrated database
  // every statement throws harmlessly and is swallowed.
  console.log("initDB: migrating legacy schema to theme-neutral schema...");

  // Historical table/column names and retired enum values live in a single
  // quarantine module so no live query path in this file has to spell them out.
  const migrations = [
    ...LEGACY_RENAMES,

    // Retirement of the pre-race spending mechanic and the winner-pick system.
    ...RETIRED_MECHANIC_MIGRATIONS,

    // --- retired enum values -> functional values ---
    // CHECK constraints must come off before the UPDATEs and go back on after.
    `ALTER TABLE racers DROP CONSTRAINT IF EXISTS racers_type_check`,
    `ALTER TABLE tactic_actions DROP CONSTRAINT IF EXISTS tactic_actions_action_type_check`,
    ...legacyValueUpdates(),
    `ALTER TABLE racers ADD CONSTRAINT racers_type_check CHECK(type IN ('free', 'pro'))`,
    `ALTER TABLE tactic_actions ADD CONSTRAINT tactic_actions_action_type_check CHECK(action_type IN ('boost', 'projectile'))`,

    // Restate the rating bound as an explicit range comparison.
    `ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_rating_check`,
    `ALTER TABLE feedback ADD CONSTRAINT feedback_rating_check CHECK(rating >= 1 AND rating <= 5)`,

  ];

  for (const sql of migrations) {
    try { await pool.query(sql); } catch { /* already migrated */ }
  }

  // === CREATE TABLES ===
  console.log("initDB: creating core tables...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS racers (
      id SERIAL PRIMARY KEY,
      wallet TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('free', 'pro')),
      name TEXT,
      rarity TEXT CHECK(rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
      race TEXT,
      -- Mint floor. Kept in sync with MINT_BASE_STAT in ../progression.ts: a
      -- free racer is inserted without stat columns and takes these defaults,
      -- while both upgrade paths write the constant explicitly.
      spd INTEGER DEFAULT 12,
      acc INTEGER DEFAULT 12,
      sta INTEGER DEFAULT 12,
      agi INTEGER DEFAULT 12,
      ref INTEGER DEFAULT 12,
      lck INTEGER DEFAULT 12,
      is_burned INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS races (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'lobby' CHECK(status IN ('lobby', 'racing', 'finished')),
      format TEXT NOT NULL DEFAULT 'sprint' CHECK(format IN ('exhibition', 'sprint', 'endurance', 'standard', 'grand_prix', 'tactic', 'gp_qualify', 'gp_final')),
      entry_fee INTEGER NOT NULL DEFAULT 50,
      -- Distance this race was run over. Recorded per race rather than looked
      -- up from the format, so retuning a format never rewrites history.
      track_length INTEGER NOT NULL DEFAULT 1600,
      -- One seed per race: the grid order and the whole simulation come from it,
      -- so a finished race can be reproduced by anyone holding it.
      seed TEXT,
      -- Server clock at the moment the race started running. The reveal
      -- frontier is derived from this and the tick rate rather than from
      -- anything the client reports, so an item can never be scheduled onto a
      -- tick the player has already watched.
      started_at TIMESTAMP,
      tuning_opened_at TIMESTAMP,
      result_hash TEXT,
      winner_wallet TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      finished_at TIMESTAMP
    );

    -- Items deployed during a race. The list, with the seed, is the entire
    -- input to the simulation — see simulation/items.ts for why that is enough
    -- to keep the race deterministic while still accepting live input.
    CREATE TABLE IF NOT EXISTS race_items (
      id SERIAL PRIMARY KEY,
      race_id TEXT NOT NULL,
      racer_id INTEGER NOT NULL,
      wallet TEXT NOT NULL,
      code TEXT NOT NULL CHECK(code IN ('boost', 'hinder')),
      -- Who a hinder lands on. Named by the player and stored, not derived from
      -- the running order at apply time — deriving it would make the same item
      -- list produce a different race, and the whole verifiability claim rests
      -- on it not doing that. NULL for boost, which acts on its user.
      target_id INTEGER,
      -- The tick the effect starts on. Always ahead of the reveal frontier at
      -- the moment of submission.
      tick INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS race_participants (
      id SERIAL PRIMARY KEY,
      race_id TEXT NOT NULL REFERENCES races(id),
      racer_id INTEGER NOT NULL,
      wallet TEXT NOT NULL,
      is_bot INTEGER DEFAULT 0,
      -- The two items this racer carries into the race, chosen before the start.
      -- Stored as the codes themselves rather than a count of each, so the
      -- order the player picked is preserved and the column reads as what it is.
      loadout TEXT NOT NULL DEFAULT 'boost,hinder',
      grid_position INTEGER,
      finish_position INTEGER,
      reward INTEGER DEFAULT 0,
      UNIQUE(race_id, racer_id)
    );

    CREATE TABLE IF NOT EXISTS streaks (
      racer_id INTEGER PRIMARY KEY,
      current_wins INTEGER DEFAULT 0,
      max_wins INTEGER DEFAULT 0,
      current_losses INTEGER DEFAULT 0,
      max_losses INTEGER DEFAULT 0,
      total_races INTEGER DEFAULT 0,
      total_wins INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_xp (
      wallet TEXT PRIMARY KEY,
      total_xp INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS race_points (
      id SERIAL PRIMARY KEY,
      wallet TEXT NOT NULL,
      racer_id INTEGER NOT NULL,
      season INTEGER DEFAULT 1,
      rp INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("initDB: creating training tables...");
  await pool.query(`

    CREATE TABLE IF NOT EXISTS daily_stat_gains (
      id SERIAL PRIMARY KEY,
      racer_id INTEGER NOT NULL,
      gain_date TEXT NOT NULL,
      total_gain REAL DEFAULT 0,
      UNIQUE(racer_id, gain_date)
    );

    CREATE TABLE IF NOT EXISTS daily_races (
      race_date TEXT PRIMARY KEY,
      race_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weather_log (
      id SERIAL PRIMARY KEY,
      wallet TEXT NOT NULL,
      weather TEXT NOT NULL,
      week_start TEXT NOT NULL,
      UNIQUE(wallet, weather, week_start)
    );
  `);

  console.log("initDB: creating Sprint 3-6 tables...");
  await pool.query(`
    -- Mini game daily plays tracking

    -- Seasons
    CREATE TABLE IF NOT EXISTS seasons (
      id SERIAL PRIMARY KEY,
      number INTEGER NOT NULL DEFAULT 1,
      start_date TIMESTAMP DEFAULT NOW(),
      end_date TIMESTAMP NOT NULL,
      is_active INTEGER DEFAULT 1
    );

    -- GP points
    CREATE TABLE IF NOT EXISTS gp_points (
      id SERIAL PRIMARY KEY,
      wallet TEXT NOT NULL,
      season INTEGER DEFAULT 1,
      gp_type TEXT NOT NULL,
      points INTEGER DEFAULT 0
    );

    -- Race replays (store frame data)
    CREATE TABLE IF NOT EXISTS race_replays (
      race_id TEXT PRIMARY KEY,
      frames JSONB,
      events JSONB,
      metadata JSONB
    );

    -- Hall of Fame
    CREATE TABLE IF NOT EXISTS hall_of_fame (
      id SERIAL PRIMARY KEY,
      achievement TEXT NOT NULL,
      wallet TEXT NOT NULL,
      achieved_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(achievement)
    );

    -- Cosmetics catalog

    -- Racer equipment (1 accessory per racer)

    -- Season rewards
    CREATE TABLE IF NOT EXISTS season_rewards (
      id SERIAL PRIMARY KEY,
      season INTEGER NOT NULL,
      league TEXT NOT NULL,
      rank_min INTEGER NOT NULL,
      rank_max INTEGER NOT NULL,
      coin_reward INTEGER DEFAULT 0,
      xp_reward INTEGER DEFAULT 0,
      cosmetic_id INTEGER
    );
  `);

  // Feedback system (Sprint 6)
  console.log("initDB: creating feedback tables...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id SERIAL PRIMARY KEY,
      wallet TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('bug','feature','balance','general')),
      text TEXT NOT NULL,
      rating INTEGER,
      ai_category TEXT,
      ai_sentiment TEXT,
      ai_priority TEXT,
      upvotes INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','reviewed','implemented','rejected')),
      created_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT feedback_rating_check CHECK(rating >= 1 AND rating <= 5)
    );

    CREATE TABLE IF NOT EXISTS feedback_reports (
      id SERIAL PRIMARY KEY,
      week_start DATE NOT NULL,
      week_end DATE NOT NULL,
      total_feedback INTEGER,
      avg_rating NUMERIC,
      top_requests JSONB,
      critical_bugs JSONB,
      sentiment_breakdown JSONB,
      full_report TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS feedback_upvotes (
      feedback_id INTEGER REFERENCES feedback(id),
      wallet TEXT NOT NULL,
      UNIQUE(feedback_id, wallet)
    );
  `);

  /**
   * Provenance moments that cannot be derived from anything else.
   *
   * Almost everything a collector's passport wants is already in the database:
   * how many races, how many wins, the first win, the longest streak, the mint
   * date. Those are read live rather than copied here, so there is one source
   * and it cannot drift.
   *
   * What is NOT recoverable is the moment a racer changed form. Tier is a pure
   * function of current stats, so once a racer is past 90 there is no way to
   * know when it crossed — the information was never written down. That is the
   * one thing worth a table.
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS racer_milestones (
      id SERIAL PRIMARY KEY,
      racer_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      detail TEXT,
      race_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_racer_milestones_racer ON racer_milestones(racer_id);
  `);

  console.log("initDB: altering columns and seeding data...");
  // ALTER stat columns to REAL if they are still INTEGER
  try {
    await pool.query(`
      ALTER TABLE racers ALTER COLUMN spd TYPE REAL;
      ALTER TABLE racers ALTER COLUMN acc TYPE REAL;
      ALTER TABLE racers ALTER COLUMN sta TYPE REAL;
      ALTER TABLE racers ALTER COLUMN agi TYPE REAL;
      ALTER TABLE racers ALTER COLUMN ref TYPE REAL;
      ALTER TABLE racers ALTER COLUMN lck TYPE REAL;
    `);
  } catch {
    // Already REAL — ignore
  }

  // The mint floor moved from 10 to 12, and CREATE TABLE IF NOT EXISTS does not
  // revisit an existing table's defaults — so without this an already-created
  // database keeps minting at the old floor forever while the constant says
  // otherwise. Existing racers are deliberately left alone: their stats include
  // whatever they have earned by racing, and there is no way to tell the floor
  // apart from the growth on top of it.
  try {
    await pool.query(`
      ALTER TABLE racers ALTER COLUMN spd SET DEFAULT 12;
      ALTER TABLE racers ALTER COLUMN acc SET DEFAULT 12;
      ALTER TABLE racers ALTER COLUMN sta SET DEFAULT 12;
      ALTER TABLE racers ALTER COLUMN agi SET DEFAULT 12;
      ALTER TABLE racers ALTER COLUMN ref SET DEFAULT 12;
      ALTER TABLE racers ALTER COLUMN lck SET DEFAULT 12;
    `);
  } catch (err) {
    console.error("initDB: could not update mint floor defaults:", err);
  }

  // Item stock. Items used to be two-per-race and free; they are a carried
  // stock now, so the racer needs somewhere to keep them. New racers start with
  // ITEM_STOCK_START; existing ones are seeded to the same, because a racer
  // that has been racing for weeks arriving at zero would read as a punishment
  // for having played before the change.
  try {
    await pool.query(`
      ALTER TABLE racers ADD COLUMN IF NOT EXISTS item_stock INTEGER DEFAULT 4;
      UPDATE racers SET item_stock = 4 WHERE item_stock IS NULL;
    `);
  } catch (err) {
    console.error("initDB: could not add item_stock:", err);
  }

  // Add evolution columns to racers table
  try {
    await pool.query(`
      ALTER TABLE racers ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 0;
      ALTER TABLE racers ADD COLUMN IF NOT EXISTS evolution_path TEXT;
      ALTER TABLE race_items ADD COLUMN IF NOT EXISTS target_id INTEGER;
    `);
    // Set defaults for existing rows
    await pool.query(`UPDATE racers SET tier = 0 WHERE type = 'free' AND tier IS NULL`);
    await pool.query(`UPDATE racers SET tier = 1 WHERE type = 'pro' AND tier IS NULL`);
  } catch {
    // Columns may already exist
  }

  // Seed first season (if none exists)
  const seasonCount = await getOne("SELECT COUNT(*) as count FROM seasons");
  if (parseInt(seasonCount.count) === 0) {
    await query(
      "INSERT INTO seasons (number, start_date, end_date, is_active) VALUES (1, NOW(), NOW() + interval '4 weeks', 1)"
    );
  }
  await repairStreaks();

  console.log("initDB: creating indexes...");
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_racers_wallet ON racers(wallet);
    CREATE INDEX IF NOT EXISTS idx_racers_wallet_burned ON racers(wallet, is_burned);
    CREATE INDEX IF NOT EXISTS idx_race_participants_race ON race_participants(race_id);
    CREATE INDEX IF NOT EXISTS idx_race_participants_wallet ON race_participants(wallet);
    CREATE INDEX IF NOT EXISTS idx_race_participants_racer ON race_participants(racer_id);
    CREATE INDEX IF NOT EXISTS idx_streaks_racer ON streaks(racer_id);
    CREATE INDEX IF NOT EXISTS idx_race_points_wallet_season ON race_points(wallet, season);
    CREATE INDEX IF NOT EXISTS idx_gp_points_wallet_season ON gp_points(wallet, season);
    CREATE INDEX IF NOT EXISTS idx_races_status ON races(status);
    CREATE INDEX IF NOT EXISTS idx_race_items_race ON race_items(race_id);
    CREATE INDEX IF NOT EXISTS idx_daily_races_date ON daily_races(race_date);
    CREATE INDEX IF NOT EXISTS idx_feedback_wallet ON feedback(wallet);
    CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
    CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
    CREATE INDEX IF NOT EXISTS idx_feedback_upvotes_feedback ON feedback_upvotes(feedback_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_reports_week ON feedback_reports(week_start);
  `);
}
