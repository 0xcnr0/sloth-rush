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
      spd INTEGER DEFAULT 10,
      acc INTEGER DEFAULT 10,
      sta INTEGER DEFAULT 10,
      agi INTEGER DEFAULT 10,
      ref INTEGER DEFAULT 10,
      lck INTEGER DEFAULT 10,
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

  // Referral system
  await pool.query(`
    CREATE TABLE IF NOT EXISTS referrals (
      id SERIAL PRIMARY KEY,
      referrer_wallet TEXT NOT NULL,
      referee_wallet TEXT NOT NULL,
      code TEXT NOT NULL,
      rewarded INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(referee_wallet)
    );
    CREATE TABLE IF NOT EXISTS referral_codes (
      wallet TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
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

  // Add evolution columns to racers table
  try {
    await pool.query(`
      ALTER TABLE racers ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 0;
      ALTER TABLE racers ADD COLUMN IF NOT EXISTS evolution_path TEXT;
      ALTER TABLE racers ADD COLUMN IF NOT EXISTS passive TEXT;
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
