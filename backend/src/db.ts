import { Pool, PoolClient } from "pg";

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
  console.log("initDB: running migration from slug to sloth schema...");

  const migrations = [
    `ALTER TABLE IF EXISTS slugs RENAME TO sloths`,
    `ALTER TABLE IF EXISTS sloths RENAME COLUMN snail_id TO sloth_id`,
    `ALTER TABLE IF EXISTS race_participants RENAME COLUMN snail_id TO sloth_id`,
    `ALTER TABLE IF EXISTS tactic_actions RENAME COLUMN snail_id TO sloth_id`,
    `ALTER TABLE IF EXISTS streaks RENAME COLUMN snail_id TO sloth_id`,
    `ALTER TABLE IF EXISTS predictions RENAME COLUMN predicted_snail_id TO predicted_sloth_id`,
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
    `UPDATE sloths SET type = 'free_sloth' WHERE type = 'free_slug'`,
    `UPDATE sloths SET type = 'sloth' WHERE type = 'snail'`,
    `UPDATE sloths SET race = 'caffeine_junkie' WHERE race = 'turbo_slug'`,
    `UPDATE sloths SET race = 'pillow_knight' WHERE race = 'shell_knight'`,
    `UPDATE sloths SET race = 'dream_weaver' WHERE race = 'goo_mage'`,
    `UPDATE sloths SET race = 'thunder_nap' WHERE race = 'storm_racer'`,
    `UPDATE sloths SET passive = 'caffeine_rush' WHERE passive = 'speed_burst'`,
    `UPDATE sloths SET passive = 'adrenaline_wake' WHERE passive = 'speed_overtake'`,
    `UPDATE sloths SET passive = 'deep_sleep' WHERE passive = 'fatigue_slow'`,
    `UPDATE sloths SET passive = 'thick_fur' WHERE passive = 'shell_resist'`,
    `UPDATE sloths SET passive = 'dream_catcher' WHERE passive = 'luck_magnet'`,
    `UPDATE sloths SET passive = 'lucid_dream' WHERE passive = 'bad_to_good'`,
    `UPDATE tactic_actions SET action_type = 'pillow' WHERE action_type = 'shell'`,
  ];

  for (const sql of migrations) {
    try { await pool.query(sql); } catch { /* already migrated */ }
  }

  // === CREATE TABLES ===
  console.log("initDB: creating core tables...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sloths (
      id SERIAL PRIMARY KEY,
      wallet TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('free_sloth', 'sloth')),
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

    CREATE TABLE IF NOT EXISTS daily_free_races (
      wallet TEXT NOT NULL,
      race_date TEXT NOT NULL,
      PRIMARY KEY(wallet, race_date)
    );

    CREATE TABLE IF NOT EXISTS coin_balances (
      wallet TEXT PRIMARY KEY,
      balance INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS races (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'lobby' CHECK(status IN ('lobby', 'bidding', 'racing', 'finished')),
      format TEXT NOT NULL DEFAULT 'standard' CHECK(format IN ('exhibition', 'standard', 'grand_prix', 'tactic', 'gp_qualify', 'gp_final')),
      entry_fee INTEGER NOT NULL DEFAULT 50,
      max_raise INTEGER NOT NULL DEFAULT 100,
      seed TEXT,
      result_hash TEXT,
      winner_wallet TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      finished_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS race_participants (
      id SERIAL PRIMARY KEY,
      race_id TEXT NOT NULL REFERENCES races(id),
      sloth_id INTEGER NOT NULL,
      wallet TEXT NOT NULL,
      is_bot INTEGER DEFAULT 0,
      bid_amount INTEGER DEFAULT 0,
      grid_position INTEGER,
      finish_position INTEGER,
      payout INTEGER DEFAULT 0,
      UNIQUE(race_id, sloth_id)
    );

    CREATE TABLE IF NOT EXISTS tactic_actions (
      id SERIAL PRIMARY KEY,
      race_id TEXT NOT NULL REFERENCES races(id),
      sloth_id INTEGER NOT NULL,
      wallet TEXT NOT NULL,
      action_type TEXT NOT NULL CHECK(action_type IN ('boost', 'pillow')),
      tick INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS streaks (
      sloth_id INTEGER PRIMARY KEY,
      current_wins INTEGER DEFAULT 0,
      max_wins INTEGER DEFAULT 0,
      current_losses INTEGER DEFAULT 0,
      max_losses INTEGER DEFAULT 0,
      total_races INTEGER DEFAULT 0,
      total_wins INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id SERIAL PRIMARY KEY,
      race_id TEXT NOT NULL REFERENCES races(id),
      wallet TEXT NOT NULL,
      predicted_sloth_id INTEGER NOT NULL,
      correct INTEGER DEFAULT 0,
      rewarded INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(race_id, wallet)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      wallet TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS daily_logins (
      id SERIAL PRIMARY KEY,
      wallet TEXT NOT NULL,
      login_date TEXT NOT NULL,
      bonus_amount INTEGER NOT NULL DEFAULT 15,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_xp (
      wallet TEXT PRIMARY KEY,
      total_xp INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS quests (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      requirement_type TEXT NOT NULL,
      requirement_value INTEGER DEFAULT 1,
      sloth_reward INTEGER DEFAULT 0,
      xp_reward INTEGER DEFAULT 0,
      period TEXT DEFAULT 'daily'
    );

    CREATE TABLE IF NOT EXISTS user_quest_progress (
      id SERIAL PRIMARY KEY,
      wallet TEXT NOT NULL,
      quest_id INTEGER NOT NULL,
      progress INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      completed_at TIMESTAMP,
      reset_date TEXT NOT NULL,
      UNIQUE(wallet, quest_id, reset_date)
    );

    CREATE TABLE IF NOT EXISTS race_points (
      id SERIAL PRIMARY KEY,
      wallet TEXT NOT NULL,
      sloth_id INTEGER NOT NULL,
      season INTEGER DEFAULT 1,
      rp INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("initDB: creating training tables...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trainings (
      id SERIAL PRIMARY KEY,
      sloth_id INTEGER NOT NULL,
      wallet TEXT NOT NULL,
      stat TEXT NOT NULL,
      started_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP NOT NULL,
      claimed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS daily_stat_gains (
      id SERIAL PRIMARY KEY,
      sloth_id INTEGER NOT NULL,
      gain_date TEXT NOT NULL,
      total_gain REAL DEFAULT 0,
      UNIQUE(sloth_id, gain_date)
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
    CREATE TABLE IF NOT EXISTS daily_minigame_plays (
      id SERIAL PRIMARY KEY,
      sloth_id INTEGER NOT NULL,
      play_date TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      UNIQUE(sloth_id, play_date)
    );

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
    CREATE TABLE IF NOT EXISTS cosmetics (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('hat','trail','celebration')),
      sloth_price INTEGER NOT NULL,
      description TEXT,
      rarity TEXT DEFAULT 'common'
    );

    -- User owned cosmetics
    CREATE TABLE IF NOT EXISTS user_cosmetics (
      id SERIAL PRIMARY KEY,
      wallet TEXT NOT NULL,
      cosmetic_id INTEGER NOT NULL,
      equipped_sloth_id INTEGER,
      purchased_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(wallet, cosmetic_id)
    );

    -- Accessories catalog
    CREATE TABLE IF NOT EXISTS accessories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      stat_bonus JSONB NOT NULL DEFAULT '{}',
      description TEXT,
      rarity TEXT DEFAULT 'common',
      sloth_price INTEGER NOT NULL
    );

    -- User owned accessories
    CREATE TABLE IF NOT EXISTS user_accessories (
      id SERIAL PRIMARY KEY,
      wallet TEXT NOT NULL,
      accessory_id INTEGER NOT NULL,
      UNIQUE(wallet, accessory_id)
    );

    -- Sloth equipment (1 accessory per sloth)
    CREATE TABLE IF NOT EXISTS sloth_equipment (
      sloth_id INTEGER PRIMARY KEY,
      accessory_id INTEGER NOT NULL
    );

    -- Season rewards
    CREATE TABLE IF NOT EXISTS season_rewards (
      id SERIAL PRIMARY KEY,
      season INTEGER NOT NULL,
      league TEXT NOT NULL,
      rank_min INTEGER NOT NULL,
      rank_max INTEGER NOT NULL,
      sloth_reward INTEGER DEFAULT 0,
      xp_reward INTEGER DEFAULT 0,
      cosmetic_id INTEGER
    );
  `);

  console.log("initDB: altering columns and seeding data...");
  // ALTER stat columns to REAL if they are still INTEGER
  try {
    await pool.query(`
      ALTER TABLE sloths ALTER COLUMN spd TYPE REAL;
      ALTER TABLE sloths ALTER COLUMN acc TYPE REAL;
      ALTER TABLE sloths ALTER COLUMN sta TYPE REAL;
      ALTER TABLE sloths ALTER COLUMN agi TYPE REAL;
      ALTER TABLE sloths ALTER COLUMN ref TYPE REAL;
      ALTER TABLE sloths ALTER COLUMN lck TYPE REAL;
    `);
  } catch {
    // Already REAL — ignore
  }

  // Add evolution columns to sloths table
  try {
    await pool.query(`
      ALTER TABLE sloths ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 0;
      ALTER TABLE sloths ADD COLUMN IF NOT EXISTS evolution_path TEXT;
      ALTER TABLE sloths ADD COLUMN IF NOT EXISTS passive TEXT;
    `);
    // Set defaults for existing rows
    await pool.query(`UPDATE sloths SET tier = 0 WHERE type = 'free_sloth' AND tier IS NULL`);
    await pool.query(`UPDATE sloths SET tier = 1 WHERE type = 'sloth' AND tier IS NULL`);
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

  // Seed cosmetics (if none exist)
  const cosmeticCount = await getOne("SELECT COUNT(*) as count FROM cosmetics");
  if (parseInt(cosmeticCount.count) === 0) {
    const cosmeticSeeds = [
      ['Top Hat', 'hat', 200, 'A dapper top hat', 'common'],
      ['Crown', 'hat', 500, 'A golden crown for champions', 'rare'],
      ['Pirate Hat', 'hat', 300, 'Arr! A pirate hat', 'uncommon'],
      ['Wizard Hat', 'hat', 400, 'A mystical wizard hat', 'uncommon'],
      ['Rainbow Trail', 'trail', 300, 'Leave a rainbow behind', 'uncommon'],
      ['Fire Trail', 'trail', 500, 'Blazing fire trail', 'rare'],
      ['Ice Trail', 'trail', 400, 'Frosty ice trail', 'uncommon'],
      ['Confetti Burst', 'celebration', 200, 'Confetti celebration!', 'common'],
      ['Fireworks', 'celebration', 500, 'Spectacular fireworks', 'rare'],
      ['Lightning Strike', 'celebration', 400, 'Electric celebration', 'uncommon'],
    ];
    for (const [name, type, price, desc, rarity] of cosmeticSeeds) {
      await query(
        "INSERT INTO cosmetics (name, type, sloth_price, description, rarity) VALUES ($1, $2, $3, $4, $5)",
        [name, type, price, desc, rarity]
      );
    }
  }

  // Seed accessories (if none exist)
  const accessoryCount = await getOne("SELECT COUNT(*) as count FROM accessories");
  if (parseInt(accessoryCount.count) === 0) {
    const accessorySeeds = [
      ['Running Slippers', '{"spd": 1}', 'Comfy slippers for extra speed', 'common', 300],
      ['Cozy Blanket', '{"sta": 2, "spd": -1}', 'Warm blanket for endurance', 'uncommon', 400],
      ['Dream Catcher Charm', '{"lck": 2}', 'A dream catcher for luck', 'common', 350],
      ['Cloud Sandals', '{"acc": 1, "agi": 1}', 'Lightweight sandals for agility', 'uncommon', 500],
      ['Sleep Mask', '{"ref": 2}', 'A reflective sleep mask', 'common', 350],
      ['Double Espresso', '{"spd": 3, "sta": -2}', 'Max speed, less endurance', 'rare', 600],
    ];
    for (const [name, bonus, desc, rarity, price] of accessorySeeds) {
      await query(
        "INSERT INTO accessories (name, stat_bonus, description, rarity, sloth_price) VALUES ($1, $2, $3, $4, $5)",
        [name, bonus, desc, rarity, price]
      );
    }
  }

  // Seed daily quests (only if empty)
  const questCount = await getOne("SELECT COUNT(*) as count FROM quests");
  if (parseInt(questCount.count) === 0) {
    await query(
      "INSERT INTO quests (type, title, description, requirement_type, requirement_value, sloth_reward, xp_reward) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      ["daily", "Complete 1 Race", "Finish any race to earn rewards", "race_complete", 1, 5, 10]
    );
    await query(
      "INSERT INTO quests (type, title, description, requirement_type, requirement_value, sloth_reward, xp_reward) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      ["daily", "Finish Top 2", "Place 1st or 2nd in a race", "top_2_finish", 1, 10, 10]
    );
    await query(
      "INSERT INTO quests (type, title, description, requirement_type, requirement_value, sloth_reward, xp_reward) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      ["daily", "Visit Treehouse", "Check on your sloths in the treehouse", "stable_visit", 1, 5, 10]
    );
  }

  // Seed weekly quests (only if none exist)
  const weeklyCount = await getOne("SELECT COUNT(*) as count FROM quests WHERE period = 'weekly'");
  if (parseInt(weeklyCount.count) === 0) {
    await query(
      "INSERT INTO quests (type, title, description, requirement_type, requirement_value, sloth_reward, xp_reward, period) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      ["weekly", "Complete 5 Races", "Finish 5 races this week", "race_complete", 5, 25, 25, "weekly"]
    );
    await query(
      "INSERT INTO quests (type, title, description, requirement_type, requirement_value, sloth_reward, xp_reward, period) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      ["weekly", "Race in 3 Weather Types", "Race in 3 different weather conditions", "weather_variety", 3, 25, 25, "weekly"]
    );
    await query(
      "INSERT INTO quests (type, title, description, requirement_type, requirement_value, sloth_reward, xp_reward, period) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      ["weekly", "Complete 1 Training", "Finish a training session", "training_complete", 1, 25, 25, "weekly"]
    );
  }

  // Seed milestone quests (only if none exist)
  const milestoneCount = await getOne("SELECT COUNT(*) as count FROM quests WHERE period = 'milestone'");
  if (parseInt(milestoneCount.count) === 0) {
    await query(
      "INSERT INTO quests (type, title, description, requirement_type, requirement_value, sloth_reward, xp_reward, period) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      ["milestone", "First Race", "Complete your first race", "race_complete", 1, 50, 25, "milestone"]
    );
    await query(
      "INSERT INTO quests (type, title, description, requirement_type, requirement_value, sloth_reward, xp_reward, period) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      ["milestone", "First Victory", "Win your first race", "milestone_wins", 1, 100, 50, "milestone"]
    );
    await query(
      "INSERT INTO quests (type, title, description, requirement_type, requirement_value, sloth_reward, xp_reward, period) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      ["milestone", "10 Races Completed", "Complete 10 races total", "milestone_races", 10, 200, 100, "milestone"]
    );
    await query(
      "INSERT INTO quests (type, title, description, requirement_type, requirement_value, sloth_reward, xp_reward, period) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      ["milestone", "3 Win Streak", "Win 3 races in a row", "milestone_streak", 3, 150, 75, "milestone"]
    );
    await query(
      "INSERT INTO quests (type, title, description, requirement_type, requirement_value, sloth_reward, xp_reward, period) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      ["milestone", "First Training", "Complete your first training session", "training_complete", 1, 50, 25, "milestone"]
    );
  }

  // Seed mini game milestone quest (if not exists)
  const miniGameQuestCount = await getOne("SELECT COUNT(*) as count FROM quests WHERE requirement_type = 'mini_game_complete' AND period = 'milestone'");
  if (parseInt(miniGameQuestCount.count) === 0) {
    await query(
      "INSERT INTO quests (type, title, description, requirement_type, requirement_value, sloth_reward, xp_reward, period) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      ["milestone", "First Mini Game", "Complete your first mini game", "mini_game_complete", 1, 30, 15, "milestone"]
    );
  }

  console.log("initDB: creating indexes...");
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sloths_wallet ON sloths(wallet);
    CREATE INDEX IF NOT EXISTS idx_sloths_wallet_burned ON sloths(wallet, is_burned);
    CREATE INDEX IF NOT EXISTS idx_coin_balances_wallet ON coin_balances(wallet);
    CREATE INDEX IF NOT EXISTS idx_race_participants_race ON race_participants(race_id);
    CREATE INDEX IF NOT EXISTS idx_race_participants_wallet ON race_participants(wallet);
    CREATE INDEX IF NOT EXISTS idx_race_participants_sloth ON race_participants(sloth_id);
    CREATE INDEX IF NOT EXISTS idx_streaks_sloth ON streaks(sloth_id);
    CREATE INDEX IF NOT EXISTS idx_user_quest_progress_wallet ON user_quest_progress(wallet);
    CREATE INDEX IF NOT EXISTS idx_trainings_sloth ON trainings(sloth_id);
    CREATE INDEX IF NOT EXISTS idx_race_points_wallet_season ON race_points(wallet, season);
    CREATE INDEX IF NOT EXISTS idx_gp_points_wallet_season ON gp_points(wallet, season);
    CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet);
    CREATE INDEX IF NOT EXISTS idx_daily_logins_wallet ON daily_logins(wallet);
    CREATE INDEX IF NOT EXISTS idx_races_status ON races(status);
    CREATE INDEX IF NOT EXISTS idx_user_cosmetics_wallet ON user_cosmetics(wallet);
    CREATE INDEX IF NOT EXISTS idx_user_accessories_wallet ON user_accessories(wallet);
    CREATE INDEX IF NOT EXISTS idx_sloth_equipment_sloth ON sloth_equipment(sloth_id);
    CREATE INDEX IF NOT EXISTS idx_predictions_race ON predictions(race_id);
    CREATE INDEX IF NOT EXISTS idx_tactic_actions_race ON tactic_actions(race_id);
    CREATE INDEX IF NOT EXISTS idx_daily_races_date ON daily_races(race_date);
  `);
}
