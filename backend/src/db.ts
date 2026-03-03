import Database from "better-sqlite3";
import path from "path";

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "..", "..", "data", "slug-rush.db");

// Ensure data directory exists
import fs from "fs";
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);

// WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS slugs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_free_races (
      wallet TEXT NOT NULL,
      race_date TEXT NOT NULL,
      PRIMARY KEY(wallet, race_date)
    );

    CREATE TABLE IF NOT EXISTS coin_balances (
      wallet TEXT PRIMARY KEY,
      balance INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
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
      created_at TEXT DEFAULT (datetime('now')),
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS race_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      race_id TEXT NOT NULL,
      snail_id INTEGER NOT NULL,
      wallet TEXT NOT NULL,
      is_bot INTEGER DEFAULT 0,
      bid_amount INTEGER DEFAULT 0,
      grid_position INTEGER,
      finish_position INTEGER,
      payout INTEGER DEFAULT 0,
      FOREIGN KEY (race_id) REFERENCES races(id),
      UNIQUE(race_id, snail_id)
    );

    CREATE TABLE IF NOT EXISTS tactic_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      race_id TEXT NOT NULL,
      snail_id INTEGER NOT NULL,
      wallet TEXT NOT NULL,
      action_type TEXT NOT NULL CHECK(action_type IN ('boost', 'shell')),
      tick INTEGER NOT NULL,
      FOREIGN KEY (race_id) REFERENCES races(id)
    );

    CREATE TABLE IF NOT EXISTS streaks (
      snail_id INTEGER PRIMARY KEY,
      current_wins INTEGER DEFAULT 0,
      max_wins INTEGER DEFAULT 0,
      current_losses INTEGER DEFAULT 0,
      max_losses INTEGER DEFAULT 0,
      total_races INTEGER DEFAULT 0,
      total_wins INTEGER DEFAULT 0,
      FOREIGN KEY (snail_id) REFERENCES slugs(id)
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      race_id TEXT NOT NULL,
      wallet TEXT NOT NULL,
      predicted_snail_id INTEGER NOT NULL,
      correct INTEGER DEFAULT 0,
      rewarded INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (race_id) REFERENCES races(id),
      UNIQUE(race_id, wallet)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_logins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet TEXT NOT NULL,
      login_date TEXT NOT NULL,
      bonus_amount INTEGER NOT NULL DEFAULT 15,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export default db;
