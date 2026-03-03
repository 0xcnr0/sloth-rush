import { Router, Request, Response } from "express";
import db from "../db";

const router = Router();

// Rarity probabilities from GDD
const RARITY_TABLE = [
  { rarity: "common", weight: 55 },
  { rarity: "uncommon", weight: 25 },
  { rarity: "rare", weight: 12 },
  { rarity: "epic", weight: 6.5 },
  { rarity: "legendary", weight: 1.5 },
] as const;

// Race types from GDD
const RACES = ["turbo_slug", "shell_knight", "goo_mage", "storm_racer"] as const;

// Starting stat biases per race (small 1-2 point differences)
const RACE_BIAS: Record<string, Partial<Record<string, number>>> = {
  turbo_slug: { spd: 2, acc: 1 },
  shell_knight: { sta: 2, ref: 1 },
  goo_mage: { lck: 2, agi: 1 },
  storm_racer: { agi: 2, ref: 1 },
};

function rollRarity(): string {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const { rarity, weight } of RARITY_TABLE) {
    cumulative += weight;
    if (roll < cumulative) return rarity;
  }
  return "common";
}

function generateName(): string {
  const prefixes = ["Speedy", "Gooey", "Turbo", "Slimy", "Shadow", "Crystal", "Thunder", "Mystic", "Iron", "Golden"];
  const suffixes = ["Shell", "Slime", "Crawler", "Racer", "Runner", "Dasher", "Glider", "Rocket", "Bolt", "Storm"];
  return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
}

// POST /api/slug/mint — Mint a Free Slug
router.post("/mint", (req: Request, res: Response) => {
  const { wallet } = req.body;

  if (!wallet) {
    res.status(400).json({ error: "wallet address required" });
    return;
  }

  // Check if wallet already has a free slug (not burned)
  const existing = db.prepare(
    "SELECT id FROM slugs WHERE wallet = ? AND type = 'free_slug' AND is_burned = 0"
  ).get(wallet);

  if (existing) {
    res.status(409).json({ error: "wallet already has a Free Slug" });
    return;
  }

  const name = generateName();
  const result = db.prepare(
    "INSERT INTO slugs (wallet, type, name) VALUES (?, 'free_slug', ?)"
  ).run(wallet, name);

  const slug = db.prepare("SELECT * FROM slugs WHERE id = ?").get(result.lastInsertRowid);

  res.status(201).json({ slug });
});

// POST /api/slug/upgrade — Upgrade Free Slug to Snail
router.post("/upgrade", (req: Request, res: Response) => {
  const { wallet } = req.body;

  if (!wallet) {
    res.status(400).json({ error: "wallet address required" });
    return;
  }

  // Find the free slug
  const freeSlug = db.prepare(
    "SELECT * FROM slugs WHERE wallet = ? AND type = 'free_slug' AND is_burned = 0"
  ).get(wallet) as any;

  if (!freeSlug) {
    res.status(404).json({ error: "no Free Slug found to upgrade" });
    return;
  }

  // Determine rarity and race
  const rarity = rollRarity();
  const race = RACES[Math.floor(Math.random() * RACES.length)];
  const bias = RACE_BIAS[race] || {};

  // Base stats: 10 each, with small race bias
  const stats = {
    spd: 10 + (bias.spd || 0),
    acc: 10 + (bias.acc || 0),
    sta: 10 + (bias.sta || 0),
    agi: 10 + (bias.agi || 0),
    ref: 10 + (bias.ref || 0),
    lck: 10 + (bias.lck || 0),
  };

  // Transaction: burn free slug + create snail + give 500 coins
  const upgrade = db.transaction(() => {
    // Burn the free slug
    db.prepare("UPDATE slugs SET is_burned = 1 WHERE id = ?").run(freeSlug.id);

    // Create snail
    const name = generateName();
    const snailResult = db.prepare(
      `INSERT INTO slugs (wallet, type, name, rarity, race, spd, acc, sta, agi, ref, lck)
       VALUES (?, 'snail', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(wallet, name, rarity, race, stats.spd, stats.acc, stats.sta, stats.agi, stats.ref, stats.lck);

    // Give 500 SLUG Coin
    db.prepare(
      `INSERT INTO coin_balances (wallet, balance) VALUES (?, 500)
       ON CONFLICT(wallet) DO UPDATE SET balance = balance + 500, updated_at = datetime('now')`
    ).run(wallet);

    // Record transaction
    db.prepare(
      "INSERT INTO transactions (wallet, type, amount, description) VALUES (?, 'upgrade_bonus', 500, 'Snail upgrade bonus')"
    ).run(wallet);

    const snail = db.prepare("SELECT * FROM slugs WHERE id = ?").get(snailResult.lastInsertRowid);
    return snail;
  });

  const snail = upgrade();

  res.status(201).json({
    snail,
    burnedSlugId: freeSlug.id,
    coinBonus: 500,
  });
});

// GET /api/stable/:wallet — Get all slugs/snails for a wallet
router.get("/stable/:wallet", (req: Request, res: Response) => {
  const { wallet } = req.params;

  const slugs = db.prepare(
    "SELECT * FROM slugs WHERE wallet = ? AND is_burned = 0 ORDER BY created_at DESC"
  ).all(wallet);

  const balance = db.prepare(
    "SELECT balance FROM coin_balances WHERE wallet = ?"
  ).get(wallet) as any;

  res.json({
    slugs,
    coinBalance: balance?.balance || 0,
  });
});

// POST /api/slug/rename — Rename a snail
const NAME_BLACKLIST = ['fuck', 'shit', 'ass', 'dick', 'porn', 'nazi', 'sik', 'amk', 'orospu'];

router.post("/rename", (req: Request, res: Response) => {
  const { wallet, snailId, name } = req.body;

  if (!wallet || !snailId || !name) {
    res.status(400).json({ error: "wallet, snailId, and name required" });
    return;
  }

  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 20) {
    res.status(400).json({ error: "name must be 3-20 characters" });
    return;
  }

  if (!/^[a-zA-Z0-9\s]+$/.test(trimmed)) {
    res.status(400).json({ error: "name must be alphanumeric" });
    return;
  }

  const lower = trimmed.toLowerCase();
  if (NAME_BLACKLIST.some(w => lower.includes(w))) {
    res.status(400).json({ error: "inappropriate name" });
    return;
  }

  const snail = db.prepare(
    "SELECT id FROM slugs WHERE id = ? AND wallet = ? AND is_burned = 0"
  ).get(snailId, wallet) as any;

  if (!snail) {
    res.status(404).json({ error: "snail not found or not owned" });
    return;
  }

  db.prepare("UPDATE slugs SET name = ? WHERE id = ?").run(trimmed, snailId);

  res.json({ renamed: true, snailId, newName: trimmed });
});

// GET /api/slug/streaks/:wallet — Get streaks for a wallet's snails
router.get("/streaks/:wallet", (req: Request, res: Response) => {
  const { wallet } = req.params;

  const streaks = db.prepare(
    `SELECT s.snail_id, s.current_wins, s.max_wins, s.current_losses, s.total_races, s.total_wins
     FROM streaks s
     JOIN slugs sl ON s.snail_id = sl.id
     WHERE sl.wallet = ? AND sl.is_burned = 0`
  ).all(wallet);

  res.json({ streaks });
});

// GET /api/coin/:wallet — Get SLUG Coin balance
router.get("/coin/:wallet", (req: Request, res: Response) => {
  const { wallet } = req.params;

  const row = db.prepare(
    "SELECT balance FROM coin_balances WHERE wallet = ?"
  ).get(wallet) as any;

  res.json({ wallet, balance: row?.balance || 0 });
});

// POST /api/slug/daily-login — Claim daily login bonus (15 SLUG)
router.post("/daily-login", (req: Request, res: Response) => {
  const { wallet } = req.body;
  if (!wallet) {
    res.status(400).json({ error: "wallet required" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const existing = db.prepare(
    "SELECT id FROM daily_logins WHERE wallet = ? AND login_date = ?"
  ).get(wallet, today) as any;

  if (existing) {
    res.json({ claimed: false, message: "Already claimed today", nextClaimAt: "tomorrow" });
    return;
  }

  const bonus = 15;
  db.prepare("INSERT INTO daily_logins (wallet, login_date, bonus_amount) VALUES (?, ?, ?)").run(wallet, today, bonus);
  db.prepare(
    "INSERT INTO coin_balances (wallet, balance) VALUES (?, ?) ON CONFLICT(wallet) DO UPDATE SET balance = balance + ?, updated_at = datetime('now')"
  ).run(wallet, bonus, bonus);

  const newBalance = (db.prepare("SELECT balance FROM coin_balances WHERE wallet = ?").get(wallet) as any)?.balance || 0;

  res.json({ claimed: true, bonus, newBalance });
});

export default router;
