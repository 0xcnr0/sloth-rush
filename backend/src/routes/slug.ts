import { Router, Request, Response } from "express";
import { query, getOne, getAll, runTransaction } from "../db";
import { awardXP, getXP, XP_AMOUNTS } from "../xp";

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
router.post("/mint", async (req: Request, res: Response) => {
  const { wallet } = req.body;

  if (!wallet) {
    res.status(400).json({ error: "wallet address required" });
    return;
  }

  // Check if wallet already has a free slug (not burned)
  const existing = await getOne(
    "SELECT id FROM slugs WHERE wallet = $1 AND type = 'free_slug' AND is_burned = 0",
    [wallet]
  );

  if (existing) {
    res.status(409).json({ error: "wallet already has a Free Slug" });
    return;
  }

  const name = generateName();
  const result = await getOne(
    "INSERT INTO slugs (wallet, type, name) VALUES ($1, 'free_slug', $2) RETURNING id",
    [wallet, name]
  );

  const slug = await getOne("SELECT * FROM slugs WHERE id = $1", [result.id]);

  res.status(201).json({ slug });
});

// POST /api/slug/upgrade — Upgrade Free Slug to Snail
router.post("/upgrade", async (req: Request, res: Response) => {
  const { wallet } = req.body;

  if (!wallet) {
    res.status(400).json({ error: "wallet address required" });
    return;
  }

  // Find the free slug
  const freeSlug = await getOne(
    "SELECT * FROM slugs WHERE wallet = $1 AND type = 'free_slug' AND is_burned = 0",
    [wallet]
  );

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
  const snail = await runTransaction(async (client) => {
    // Burn the free slug
    await client.query("UPDATE slugs SET is_burned = 1 WHERE id = $1", [freeSlug.id]);

    // Create snail
    const name = generateName();
    const snailResult = await client.query(
      `INSERT INTO slugs (wallet, type, name, rarity, race, spd, acc, sta, agi, ref, lck)
       VALUES ($1, 'snail', $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [wallet, name, rarity, race, stats.spd, stats.acc, stats.sta, stats.agi, stats.ref, stats.lck]
    );

    // Give 500 SLUG Coin
    await client.query(
      `INSERT INTO coin_balances (wallet, balance) VALUES ($1, 500)
       ON CONFLICT(wallet) DO UPDATE SET balance = coin_balances.balance + 500, updated_at = NOW()`,
      [wallet]
    );

    // Record transaction
    await client.query(
      "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'upgrade_bonus', 500, 'Snail upgrade bonus')",
      [wallet]
    );

    const snailRow = await client.query("SELECT * FROM slugs WHERE id = $1", [snailResult.rows[0].id]);
    return snailRow.rows[0];
  });

  res.status(201).json({
    snail,
    burnedSlugId: freeSlug.id,
    coinBonus: 500,
  });
});

// GET /api/stable/:wallet — Get all slugs/snails for a wallet
router.get("/stable/:wallet", async (req: Request, res: Response) => {
  const { wallet } = req.params;

  const slugs = await getAll(
    "SELECT * FROM slugs WHERE wallet = $1 AND is_burned = 0 ORDER BY created_at DESC",
    [wallet]
  );

  const balance = await getOne(
    "SELECT balance FROM coin_balances WHERE wallet = $1",
    [wallet]
  );

  res.json({
    slugs,
    coinBalance: balance?.balance || 0,
  });
});

// POST /api/slug/rename — Rename a snail
const NAME_BLACKLIST = ['fuck', 'shit', 'ass', 'dick', 'porn', 'nazi', 'sik', 'amk', 'orospu'];

router.post("/rename", async (req: Request, res: Response) => {
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

  const snail = await getOne(
    "SELECT id FROM slugs WHERE id = $1 AND wallet = $2 AND is_burned = 0",
    [snailId, wallet]
  );

  if (!snail) {
    res.status(404).json({ error: "snail not found or not owned" });
    return;
  }

  await query("UPDATE slugs SET name = $1 WHERE id = $2", [trimmed, snailId]);

  res.json({ renamed: true, snailId, newName: trimmed });
});

// GET /api/slug/streaks/:wallet — Get streaks for a wallet's snails
router.get("/streaks/:wallet", async (req: Request, res: Response) => {
  const { wallet } = req.params;

  const streaks = await getAll(
    `SELECT s.snail_id, s.current_wins, s.max_wins, s.current_losses, s.total_races, s.total_wins
     FROM streaks s
     JOIN slugs sl ON s.snail_id = sl.id
     WHERE sl.wallet = $1 AND sl.is_burned = 0`,
    [wallet]
  );

  res.json({ streaks });
});

// GET /api/coin/:wallet — Get SLUG Coin balance
router.get("/coin/:wallet", async (req: Request, res: Response) => {
  const { wallet } = req.params;

  const row = await getOne(
    "SELECT balance FROM coin_balances WHERE wallet = $1",
    [wallet]
  );

  res.json({ wallet, balance: row?.balance || 0 });
});

// GET /api/slug/xp/:wallet — Get XP for a wallet
router.get("/xp/:wallet", async (req: Request, res: Response) => {
  const wallet = req.params.wallet as string;
  const xp = await getXP(wallet);
  res.json({ wallet, xp });
});

// POST /api/slug/daily-login — Claim daily login bonus (15 SLUG)
router.post("/daily-login", async (req: Request, res: Response) => {
  const { wallet } = req.body;
  if (!wallet) {
    res.status(400).json({ error: "wallet required" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const existing = await getOne(
    "SELECT id FROM daily_logins WHERE wallet = $1 AND login_date = $2",
    [wallet, today]
  );

  if (existing) {
    res.json({ claimed: false, message: "Already claimed today", nextClaimAt: "tomorrow" });
    return;
  }

  const bonus = 15;
  await query("INSERT INTO daily_logins (wallet, login_date, bonus_amount) VALUES ($1, $2, $3)", [wallet, today, bonus]);
  await query(
    "INSERT INTO coin_balances (wallet, balance) VALUES ($1, $2) ON CONFLICT(wallet) DO UPDATE SET balance = coin_balances.balance + $3, updated_at = NOW()",
    [wallet, bonus, bonus]
  );

  // Award daily login XP
  await awardXP(wallet, XP_AMOUNTS.DAILY_LOGIN);

  const newBalance = await getOne("SELECT balance FROM coin_balances WHERE wallet = $1", [wallet]);

  res.json({ claimed: true, bonus, newBalance: newBalance?.balance || 0 });
});

// GET /api/slug/upgrade-progress/:wallet — Check free upgrade eligibility
router.get("/upgrade-progress/:wallet", async (req: Request, res: Response) => {
  const wallet = req.params.wallet as string;

  const xp = await getXP(wallet);

  const totalRacesRow = await getOne(
    "SELECT COUNT(*) as count FROM race_participants WHERE wallet = $1 AND is_bot = 0",
    [wallet]
  );
  const totalRaces = parseInt(totalRacesRow?.count) || 0;

  const totalWinsRow = await getOne(
    "SELECT COUNT(*) as count FROM race_participants WHERE wallet = $1 AND is_bot = 0 AND finish_position = 1",
    [wallet]
  );
  const totalWins = parseInt(totalWinsRow?.count) || 0;

  const loginDaysRow = await getOne(
    "SELECT COUNT(DISTINCT login_date) as count FROM daily_logins WHERE wallet = $1",
    [wallet]
  );
  const loginDays = parseInt(loginDaysRow?.count) || 0;

  const requirements = { xp: 1500, races: 30, wins: 10, loginDays: 25 };
  const eligible = xp >= requirements.xp &&
    totalRaces >= requirements.races &&
    totalWins >= requirements.wins &&
    loginDays >= requirements.loginDays;

  res.json({
    xp,
    races: totalRaces,
    wins: totalWins,
    loginDays,
    requirements,
    eligible,
  });
});

// POST /api/slug/free-upgrade — Free upgrade path (meet all 4 requirements)
router.post("/free-upgrade", async (req: Request, res: Response) => {
  const { wallet } = req.body;
  if (!wallet) {
    res.status(400).json({ error: "wallet required" });
    return;
  }

  // Verify eligibility
  const xp = await getXP(wallet);
  const totalRacesRow = await getOne(
    "SELECT COUNT(*) as count FROM race_participants WHERE wallet = $1 AND is_bot = 0",
    [wallet]
  );
  const totalRaces = parseInt(totalRacesRow?.count) || 0;

  const totalWinsRow = await getOne(
    "SELECT COUNT(*) as count FROM race_participants WHERE wallet = $1 AND is_bot = 0 AND finish_position = 1",
    [wallet]
  );
  const totalWins = parseInt(totalWinsRow?.count) || 0;

  const loginDaysRow = await getOne(
    "SELECT COUNT(DISTINCT login_date) as count FROM daily_logins WHERE wallet = $1",
    [wallet]
  );
  const loginDays = parseInt(loginDaysRow?.count) || 0;

  if (xp < 1500 || totalRaces < 30 || totalWins < 10 || loginDays < 25) {
    res.status(400).json({ error: "Requirements not met for free upgrade" });
    return;
  }

  // Find the free slug
  const freeSlug = await getOne(
    "SELECT * FROM slugs WHERE wallet = $1 AND type = 'free_slug' AND is_burned = 0",
    [wallet]
  );

  if (!freeSlug) {
    res.status(404).json({ error: "no Free Slug found to upgrade" });
    return;
  }

  // Same upgrade logic as paid path
  const rarity = rollRarity();
  const race = RACES[Math.floor(Math.random() * RACES.length)];
  const bias = RACE_BIAS[race] || {};

  const stats = {
    spd: 10 + (bias.spd || 0),
    acc: 10 + (bias.acc || 0),
    sta: 10 + (bias.sta || 0),
    agi: 10 + (bias.agi || 0),
    ref: 10 + (bias.ref || 0),
    lck: 10 + (bias.lck || 0),
  };

  const snail = await runTransaction(async (client) => {
    await client.query("UPDATE slugs SET is_burned = 1 WHERE id = $1", [freeSlug.id]);

    const name = generateName();
    const snailResult = await client.query(
      `INSERT INTO slugs (wallet, type, name, rarity, race, spd, acc, sta, agi, ref, lck)
       VALUES ($1, 'snail', $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [wallet, name, rarity, race, stats.spd, stats.acc, stats.sta, stats.agi, stats.ref, stats.lck]
    );

    await client.query(
      `INSERT INTO coin_balances (wallet, balance) VALUES ($1, 500)
       ON CONFLICT(wallet) DO UPDATE SET balance = coin_balances.balance + 500, updated_at = NOW()`,
      [wallet]
    );

    await client.query(
      "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'free_upgrade_bonus', 500, 'Free upgrade bonus')",
      [wallet]
    );

    const snailRow = await client.query("SELECT * FROM slugs WHERE id = $1", [snailResult.rows[0].id]);
    return snailRow.rows[0];
  });

  res.status(201).json({
    snail,
    burnedSlugId: freeSlug.id,
    coinBonus: 500,
  });
});

export default router;
