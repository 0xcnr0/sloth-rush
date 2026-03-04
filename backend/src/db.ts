import { Pool, PoolClient } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production" ||
    process.env.RAILWAY_ENVIRONMENT === "production"
      ? { rejectUnauthorized: false }
      : undefined,
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS slugs (
      id SERIAL PRIMARY KEY,
      wallet TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('free_slug', 'snail')),
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
      snail_id INTEGER NOT NULL,
      wallet TEXT NOT NULL,
      is_bot INTEGER DEFAULT 0,
      bid_amount INTEGER DEFAULT 0,
      grid_position INTEGER,
      finish_position INTEGER,
      payout INTEGER DEFAULT 0,
      UNIQUE(race_id, snail_id)
    );

    CREATE TABLE IF NOT EXISTS tactic_actions (
      id SERIAL PRIMARY KEY,
      race_id TEXT NOT NULL REFERENCES races(id),
      snail_id INTEGER NOT NULL,
      wallet TEXT NOT NULL,
      action_type TEXT NOT NULL CHECK(action_type IN ('boost', 'shell')),
      tick INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS streaks (
      snail_id INTEGER PRIMARY KEY,
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
      predicted_snail_id INTEGER NOT NULL,
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
      slug_reward INTEGER DEFAULT 0,
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
      snail_id INTEGER NOT NULL,
      season INTEGER DEFAULT 1,
      rp INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Seed daily quests (only if empty)
  const questCount = await getOne("SELECT COUNT(*) as count FROM quests");
  if (parseInt(questCount.count) === 0) {
    await query(
      "INSERT INTO quests (type, title, description, requirement_type, requirement_value, slug_reward, xp_reward) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      ["daily", "Complete 1 Race", "Finish any race to earn rewards", "race_complete", 1, 5, 10]
    );
    await query(
      "INSERT INTO quests (type, title, description, requirement_type, requirement_value, slug_reward, xp_reward) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      ["daily", "Finish Top 2", "Place 1st or 2nd in a race", "top_2_finish", 1, 10, 10]
    );
    await query(
      "INSERT INTO quests (type, title, description, requirement_type, requirement_value, slug_reward, xp_reward) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      ["daily", "Visit Stable", "Check on your slugs in the stable", "stable_visit", 1, 5, 10]
    );
  }
}
