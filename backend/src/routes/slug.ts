import { Router, Request, Response } from "express";
import { query, getOne, getAll, runTransaction } from "../db";
import { awardXP, getXP, XP_AMOUNTS } from "../xp";
import { triggerQuestProgress } from "./race";
import { isValidWallet } from "../middleware/validateWallet";

const router = Router();

const VALID_STATS = ['spd', 'acc', 'sta', 'agi', 'ref', 'lck'] as const;
type StatName = typeof VALID_STATS[number];

function assertValidStat(stat: string): asserts stat is StatName {
  if (!(VALID_STATS as readonly string[]).includes(stat)) {
    throw new Error(`Invalid stat: ${stat}`);
  }
}

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
  try {
    const { wallet } = req.body;

    if (!wallet) {
      res.status(400).json({ error: "wallet address required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
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
  } catch (err) {
    console.error("POST /mint error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/slug/upgrade — Upgrade Free Slug to Snail
router.post("/upgrade", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.body;

    if (!wallet) {
      res.status(400).json({ error: "wallet address required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
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
  } catch (err) {
    console.error("POST /upgrade error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/stable/:wallet — Get all slugs/snails for a wallet
router.get("/stable/:wallet", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

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
  } catch (err) {
    console.error("GET /stable/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/slug/rename — Rename a snail
const NAME_BLACKLIST = ['fuck', 'shit', 'ass', 'dick', 'porn', 'nazi', 'sik', 'amk', 'orospu'];

router.post("/rename", async (req: Request, res: Response) => {
  try {
    const { wallet, snailId, name } = req.body;

    if (!wallet || !snailId || !name) {
      res.status(400).json({ error: "wallet, snailId, and name required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
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
  } catch (err) {
    console.error("POST /rename error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/slug/streaks/:wallet — Get streaks for a wallet's snails
router.get("/streaks/:wallet", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const streaks = await getAll(
      `SELECT s.snail_id, s.current_wins, s.max_wins, s.current_losses, s.total_races, s.total_wins
       FROM streaks s
       JOIN slugs sl ON s.snail_id = sl.id
       WHERE sl.wallet = $1 AND sl.is_burned = 0`,
      [wallet]
    );

    res.json({ streaks });
  } catch (err) {
    console.error("GET /streaks/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/coin/:wallet — Get SLUG Coin balance
router.get("/coin/:wallet", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const row = await getOne(
      "SELECT balance FROM coin_balances WHERE wallet = $1",
      [wallet]
    );

    res.json({ wallet, balance: row?.balance || 0 });
  } catch (err) {
    console.error("GET /coin/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/slug/xp/:wallet — Get XP for a wallet
router.get("/xp/:wallet", async (req: Request, res: Response) => {
  try {
    const wallet = req.params.wallet as string;

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const xp = await getXP(wallet);
    res.json({ wallet, xp });
  } catch (err) {
    console.error("GET /xp/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/slug/daily-login — Claim daily login bonus (15 SLUG)
router.post("/daily-login", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.body;
    if (!wallet) {
      res.status(400).json({ error: "wallet required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
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
  } catch (err) {
    console.error("POST /daily-login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Stat caps
const STAT_CAPS: Record<string, number> = {
  free_slug: 15, common: 22, uncommon: 25, rare: 28, epic: 31, legendary: 35,
};

function getStatCap(type: string, rarity: string, tier: number = 0, evolutionPath?: string, stat?: string): number {
  let cap = type === 'free_slug' ? 15 : (STAT_CAPS[rarity] || 22);
  if (tier >= 3 && evolutionPath && stat) {
    const pathStats: Record<string, string[]> = {
      velocity: ['spd', 'acc'],
      fortress: ['sta', 'ref'],
      mystic: ['lck', 'agi'],
    };
    if (pathStats[evolutionPath]?.includes(stat)) cap += 5;
    if (tier >= 4) cap += 3;
  }
  return cap;
}

// POST /api/slug/train — Start a training session (6h, 10 SLUG cost)
router.post("/train", async (req: Request, res: Response) => {
  try {
    const { wallet, snailId, stat } = req.body;
    if (!wallet || !snailId || !stat) {
      res.status(400).json({ error: "wallet, snailId, and stat required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const parsedSnailId = parseInt(snailId);
    if (isNaN(parsedSnailId) || parsedSnailId <= 0) {
      res.status(400).json({ error: "Invalid snailId" });
      return;
    }

    try {
      assertValidStat(stat);
    } catch {
      res.status(400).json({ error: "Invalid stat. Must be: spd, acc, sta, agi, ref, lck" });
      return;
    }

    // Verify ownership
    const slug = await getOne(
      "SELECT * FROM slugs WHERE id = $1 AND wallet = $2 AND is_burned = 0",
      [parsedSnailId, wallet]
    );
    if (!slug) {
      res.status(404).json({ error: "creature not found or not owned" });
      return;
    }

    // Check stat cap
    const cap = getStatCap(slug.type, slug.rarity, slug.tier || 0, slug.evolution_path, stat);
    if (slug[stat] >= cap) {
      res.status(400).json({ error: `${stat.toUpperCase()} is already at max (${cap}) for this rarity` });
      return;
    }

    // Check if already in training (unclaimed)
    const activeTraining = await getOne(
      "SELECT id FROM trainings WHERE snail_id = $1 AND claimed = 0",
      [parsedSnailId]
    );
    if (activeTraining) {
      res.status(400).json({ error: "This creature is already in training" });
      return;
    }

    // Check weekly training limit (free_slug: 1/week, snail: 2/week)
    const weeklyLimit = slug.type === 'free_slug' ? 1 : 2;
    const weekTrainings = await getOne(
      "SELECT COUNT(*) as count FROM trainings WHERE snail_id = $1 AND started_at >= date_trunc('week', CURRENT_TIMESTAMP)",
      [parsedSnailId]
    );
    if (parseInt(weekTrainings?.count || 0) >= weeklyLimit) {
      res.status(400).json({ error: `Weekly training limit reached (${weeklyLimit}/week)` });
      return;
    }

    // Check balance (10 SLUG cost)
    const balance = await getOne("SELECT balance FROM coin_balances WHERE wallet = $1", [wallet]);
    if ((balance?.balance || 0) < 10) {
      res.status(400).json({ error: "Need 10 SLUG for training" });
      return;
    }

    // Deduct cost and start training (6 hours)
    await query(
      "UPDATE coin_balances SET balance = balance - 10, updated_at = NOW() WHERE wallet = $1",
      [wallet]
    );
    await query(
      "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'training_cost', -10, $2)",
      [wallet, `Training ${stat.toUpperCase()} for snail #${parsedSnailId}`]
    );

    const completedAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    await query(
      "INSERT INTO trainings (snail_id, wallet, stat, completed_at) VALUES ($1, $2, $3, $4)",
      [parsedSnailId, wallet, stat, completedAt]
    );

    res.json({ started: true, snailId: parsedSnailId, stat, completedAt });
  } catch (err) {
    console.error("POST /train error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/slug/claim-training — Claim training reward
router.post("/claim-training", async (req: Request, res: Response) => {
  try {
    const { wallet, snailId } = req.body;
    if (!wallet || !snailId) {
      res.status(400).json({ error: "wallet and snailId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const training = await getOne(
      "SELECT * FROM trainings WHERE snail_id = $1 AND wallet = $2 AND claimed = 0",
      [snailId, wallet]
    );
    if (!training) {
      res.status(404).json({ error: "No active training found" });
      return;
    }

    if (new Date(training.completed_at) > new Date()) {
      res.status(400).json({ error: "Training not completed yet" });
      return;
    }

    const slug = await getOne("SELECT * FROM slugs WHERE id = $1", [snailId]);
    if (!slug) {
      res.status(404).json({ error: "creature not found" });
      return;
    }

    const stat = training.stat;
    const cap = getStatCap(slug.type, slug.rarity, slug.tier || 0, slug.evolution_path, stat);
    const gain = Math.min(0.3, Math.max(0, cap - (slug[stat] || 0)));

    if (gain > 0) {
      assertValidStat(stat);
      await query(`UPDATE slugs SET ${stat} = ${stat} + $1 WHERE id = $2`, [gain, snailId]);
    }
    await query("UPDATE trainings SET claimed = 1 WHERE id = $1", [training.id]);
    await awardXP(wallet, 5);

    // Trigger training_complete quest
    await triggerQuestProgress(wallet, "training_complete");

    res.json({ claimed: true, snailId, stat, gain, newStatValue: (slug[stat] || 0) + gain });
  } catch (err) {
    console.error("POST /claim-training error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/slug/training-status/:wallet — Get active trainings
router.get("/training-status/:wallet", async (req: Request, res: Response) => {
  try {
    const wallet = req.params.wallet as string;

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const trainings = await getAll(
      `SELECT t.*, s.name as snail_name FROM trainings t
       JOIN slugs s ON t.snail_id = s.id
       WHERE t.wallet = $1 AND t.claimed = 0
       ORDER BY t.started_at DESC`,
      [wallet]
    );

    const result = trainings.map((t: any) => ({
      snailId: t.snail_id,
      snailName: t.snail_name,
      stat: t.stat,
      startedAt: t.started_at,
      completedAt: t.completed_at,
      isReady: new Date(t.completed_at) <= new Date(),
    }));

    // Get weekly training counts per snail
    const weeklyCounts = await getAll(
      `SELECT s.id as snail_id, COUNT(t.id) as count FROM slugs s
       LEFT JOIN trainings t ON t.snail_id = s.id AND t.started_at >= date_trunc('week', CURRENT_TIMESTAMP)
       WHERE s.wallet = $1 AND s.is_burned = 0
       GROUP BY s.id`,
      [wallet]
    );
    const weeklyMap: Record<number, number> = {};
    for (const wc of weeklyCounts) {
      weeklyMap[wc.snail_id] = parseInt(wc.count) || 0;
    }

    res.json({ trainings: result, weeklyCounts: weeklyMap });
  } catch (err) {
    console.error("GET /training-status/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/slug/upgrade-progress/:wallet — Check free upgrade eligibility
router.get("/upgrade-progress/:wallet", async (req: Request, res: Response) => {
  try {
    const wallet = req.params.wallet as string;

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

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
  } catch (err) {
    console.error("GET /upgrade-progress/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/slug/free-upgrade — Free upgrade path (meet all 4 requirements)
router.post("/free-upgrade", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.body;
    if (!wallet) {
      res.status(400).json({ error: "wallet required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
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
  } catch (err) {
    console.error("POST /free-upgrade error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/slug/mini-game — Play a mini game for stat gain
router.post("/mini-game", async (req: Request, res: Response) => {
  try {
    const { wallet, snailId, gameType, score } = req.body;

    if (!wallet || !snailId || !gameType || score === undefined) {
      res.status(400).json({ error: "wallet, snailId, gameType, and score required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const parsedScore = parseInt(score);
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 1000) {
      res.status(400).json({ error: "Invalid score" });
      return;
    }

    const statMap: Record<string, string> = {
      salt_dodge: 'agi',
      slime_slide: 'spd',
      shell_lift: 'sta',
      lucky_leaf: 'lck',
      speed_tap: 'acc',
    };

    const stat = statMap[gameType];
    if (!stat) {
      res.status(400).json({ error: "Invalid gameType. Must be: salt_dodge, slime_slide, shell_lift, lucky_leaf, speed_tap" });
      return;
    }

    // Verify ownership
    const slug = await getOne(
      "SELECT * FROM slugs WHERE id = $1 AND wallet = $2 AND is_burned = 0",
      [snailId, wallet]
    );
    if (!slug) {
      res.status(404).json({ error: "creature not found or not owned" });
      return;
    }

    // Check daily limit — wallet-based (5/day total across all creatures)
    const today = new Date().toISOString().split("T")[0];
    const dailyLimit = 5;

    await query(
      "INSERT INTO daily_minigame_plays (snail_id, play_date, count) VALUES ($1, $2, 0) ON CONFLICT DO NOTHING",
      [snailId, today]
    );
    const walletPlays = await getOne(
      `SELECT COALESCE(SUM(dmp.count), 0) as total_count
       FROM daily_minigame_plays dmp
       JOIN slugs s ON dmp.snail_id = s.id
       WHERE s.wallet = $1 AND dmp.play_date = $2`,
      [wallet, today]
    );

    if ((walletPlays?.total_count || 0) >= dailyLimit) {
      res.status(400).json({ error: `Daily mini-game limit reached (${dailyLimit}/day across all creatures)` });
      return;
    }

    // Check stat cap
    const cap = getStatCap(slug.type, slug.rarity, slug.tier || 0, slug.evolution_path, stat);
    if (slug[stat] >= cap) {
      res.status(400).json({ error: `${stat.toUpperCase()} is already at max (${cap})` });
      return;
    }

    // Calculate gain
    const gain = Math.max(0.1, Math.min(0.5, parsedScore / 100 * 0.5));
    const actualGain = Math.min(gain, Math.max(0, cap - (slug[stat] || 0)));

    // Update stat and track play
    assertValidStat(stat);
    await query(`UPDATE slugs SET ${stat} = ${stat} + $1 WHERE id = $2`, [actualGain, snailId]);
    await query(
      "UPDATE daily_minigame_plays SET count = count + 1 WHERE snail_id = $1 AND play_date = $2",
      [snailId, today]
    );

    // Award 8 XP
    await awardXP(wallet, 8);

    // Trigger mini_game_complete quest
    await triggerQuestProgress(wallet, "mini_game_complete");

    res.json({
      played: true,
      snailId,
      gameType,
      stat,
      gain: actualGain,
      newStatValue: (slug[stat] || 0) + actualGain,
      playsToday: (walletPlays?.total_count || 0) + 1,
      dailyLimit,
    });
  } catch (err) {
    console.error("POST /mini-game error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/slug/evolution-progress/:snailId — Get evolution progress
router.get("/evolution-progress/:snailId", async (req: Request, res: Response) => {
  try {
    const { snailId } = req.params;

    const slug = await getOne(
      "SELECT * FROM slugs WHERE id = $1 AND is_burned = 0",
      [snailId]
    );
    if (!slug) {
      res.status(404).json({ error: "creature not found" });
      return;
    }

    const tier = slug.tier || 0;
    const wallet = slug.wallet;

    // Get race stats
    const totalRacesRow = await getOne(
      "SELECT COUNT(*) as count FROM race_participants WHERE wallet = $1 AND snail_id = $2 AND is_bot = 0",
      [wallet, snailId]
    );
    const totalRaces = parseInt(totalRacesRow?.count) || 0;

    const totalWinsRow = await getOne(
      "SELECT COUNT(*) as count FROM race_participants WHERE wallet = $1 AND snail_id = $2 AND is_bot = 0 AND finish_position = 1",
      [wallet, snailId]
    );
    const totalWins = parseInt(totalWinsRow?.count) || 0;

    const xp = await getXP(wallet);

    const balance = await getOne("SELECT balance FROM coin_balances WHERE wallet = $1", [wallet]);
    const slugBalance = balance?.balance || 0;

    // Get highest stat
    const stats = [slug.spd, slug.acc, slug.sta, slug.agi, slug.ref, slug.lck];
    const maxStat = Math.max(...stats);

    // Requirements per tier
    const tierReqs: Record<number, any> = {
      1: { xp: 2000, races: 50, wins: 18, slug: 800, stat: 20 },
      2: { xp: 4000, races: 150, wins: 55, slug: 2000, stat: 24, pathRequired: true },
      3: { xp: 6000, races: 300, wins: 120, slug: 3500, stat: 28 },
    };

    const nextTier = tier + 1;
    const reqs = tierReqs[nextTier] || null;

    let eligible = false;
    if (reqs) {
      eligible = xp >= reqs.xp &&
        totalRaces >= reqs.races &&
        totalWins >= reqs.wins &&
        slugBalance >= reqs.slug &&
        maxStat >= reqs.stat;
    }

    res.json({
      snailId: parseInt(snailId as string),
      currentTier: tier,
      evolutionPath: slug.evolution_path || null,
      passive: slug.passive || null,
      nextTierRequirements: reqs,
      progress: {
        xp,
        races: totalRaces,
        wins: totalWins,
        slugBalance,
        maxStat,
      },
      eligible,
    });
  } catch (err) {
    console.error("GET /evolution-progress/:snailId error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/slug/evolve — Evolve a snail to next tier
router.post("/evolve", async (req: Request, res: Response) => {
  try {
    const { wallet, snailId, path } = req.body;

    if (!wallet || !snailId) {
      res.status(400).json({ error: "wallet and snailId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const slug = await getOne(
      "SELECT * FROM slugs WHERE id = $1 AND wallet = $2 AND is_burned = 0 AND type = 'snail'",
      [snailId, wallet]
    );
    if (!slug) {
      res.status(404).json({ error: "snail not found or not owned" });
      return;
    }

    const tier = slug.tier || 1;
    const nextTier = tier + 1;

    if (nextTier > 4) {
      res.status(400).json({ error: "Already at max tier" });
      return;
    }

    // Get stats
    const totalRacesRow = await getOne(
      "SELECT COUNT(*) as count FROM race_participants WHERE wallet = $1 AND snail_id = $2 AND is_bot = 0",
      [wallet, snailId]
    );
    const totalRaces = parseInt(totalRacesRow?.count) || 0;

    const totalWinsRow = await getOne(
      "SELECT COUNT(*) as count FROM race_participants WHERE wallet = $1 AND snail_id = $2 AND is_bot = 0 AND finish_position = 1",
      [wallet, snailId]
    );
    const totalWins = parseInt(totalWinsRow?.count) || 0;

    const xp = await getXP(wallet);
    const balance = await getOne("SELECT balance FROM coin_balances WHERE wallet = $1", [wallet]);
    const slugBalance = balance?.balance || 0;

    const stats = [slug.spd, slug.acc, slug.sta, slug.agi, slug.ref, slug.lck];
    const maxStat = Math.max(...stats);

    // Requirements per tier
    const tierReqs: Record<number, { xp: number; races: number; wins: number; slug: number; stat: number; pathRequired?: boolean }> = {
      2: { xp: 2000, races: 50, wins: 18, slug: 800, stat: 20 },
      3: { xp: 4000, races: 150, wins: 55, slug: 2000, stat: 24, pathRequired: true },
      4: { xp: 6000, races: 300, wins: 120, slug: 3500, stat: 28 },
    };

    const reqs = tierReqs[nextTier];
    if (!reqs) {
      res.status(400).json({ error: "Invalid evolution tier" });
      return;
    }

    if (xp < reqs.xp || totalRaces < reqs.races || totalWins < reqs.wins || slugBalance < reqs.slug || maxStat < reqs.stat) {
      res.status(400).json({ error: "Requirements not met", requirements: reqs, progress: { xp, races: totalRaces, wins: totalWins, slugBalance, maxStat } });
      return;
    }

    // Tier 3 requires path selection
    if (reqs.pathRequired && !path) {
      res.status(400).json({ error: "Evolution path required for tier 3. Choose: velocity, fortress, or mystic" });
      return;
    }

    const validPaths = ['velocity', 'fortress', 'mystic'];
    if (reqs.pathRequired && !validPaths.includes(path)) {
      res.status(400).json({ error: "Invalid path. Choose: velocity, fortress, or mystic" });
      return;
    }

    // Determine passive ability based on path and tier
    const passiveMap: Record<string, Record<number, string>> = {
      velocity: { 3: 'speed_burst', 4: 'speed_overtake' },
      fortress: { 3: 'fatigue_slow', 4: 'shell_resist' },
      mystic: { 3: 'luck_magnet', 4: 'bad_to_good' },
    };

    const evolutionPath = path || slug.evolution_path;
    const passive = evolutionPath && passiveMap[evolutionPath] ? passiveMap[evolutionPath][nextTier] || slug.passive : slug.passive;

    await runTransaction(async (client) => {
      // Deduct SLUG
      await client.query(
        "UPDATE coin_balances SET balance = balance - $1, updated_at = NOW() WHERE wallet = $2",
        [reqs.slug, wallet]
      );
      await client.query(
        "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'evolution_cost', $2, $3)",
        [wallet, -reqs.slug, `Evolution to tier ${nextTier} for snail #${snailId}`]
      );

      // Update snail
      await client.query(
        "UPDATE slugs SET tier = $1, evolution_path = COALESCE($2, evolution_path), passive = $3 WHERE id = $4",
        [nextTier, evolutionPath || null, passive || null, snailId]
      );
    });

    res.json({
      evolved: true,
      snailId,
      newTier: nextTier,
      evolutionPath: evolutionPath || null,
      passive: passive || null,
    });
  } catch (err) {
    console.error("POST /evolve error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/slug/equip-cosmetic — Equip a cosmetic to a snail
router.post("/equip-cosmetic", async (req: Request, res: Response) => {
  try {
    const { wallet, snailId, cosmeticId } = req.body;

    if (!wallet || !snailId || !cosmeticId) {
      res.status(400).json({ error: "wallet, snailId, and cosmeticId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    // Verify ownership of snail
    const slug = await getOne(
      "SELECT id FROM slugs WHERE id = $1 AND wallet = $2 AND is_burned = 0",
      [snailId, wallet]
    );
    if (!slug) {
      res.status(404).json({ error: "snail not found or not owned" });
      return;
    }

    // Verify ownership of cosmetic
    const owned = await getOne(
      "SELECT id FROM user_cosmetics WHERE wallet = $1 AND cosmetic_id = $2",
      [wallet, cosmeticId]
    );
    if (!owned) {
      res.status(400).json({ error: "cosmetic not owned" });
      return;
    }

    // Equip: set equipped_snail_id
    await query(
      "UPDATE user_cosmetics SET equipped_snail_id = $1 WHERE wallet = $2 AND cosmetic_id = $3",
      [snailId, wallet, cosmeticId]
    );

    res.json({ equipped: true, snailId, cosmeticId });
  } catch (err) {
    console.error("POST /equip-cosmetic error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/slug/equip-accessory — Equip an accessory to a snail
router.post("/equip-accessory", async (req: Request, res: Response) => {
  try {
    const { wallet, snailId, accessoryId } = req.body;

    if (!wallet || !snailId || !accessoryId) {
      res.status(400).json({ error: "wallet, snailId, and accessoryId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    // Verify ownership of snail
    const slug = await getOne(
      "SELECT id FROM slugs WHERE id = $1 AND wallet = $2 AND is_burned = 0",
      [snailId, wallet]
    );
    if (!slug) {
      res.status(404).json({ error: "snail not found or not owned" });
      return;
    }

    // Verify ownership of accessory
    const owned = await getOne(
      "SELECT id FROM user_accessories WHERE wallet = $1 AND accessory_id = $2",
      [wallet, accessoryId]
    );
    if (!owned) {
      res.status(400).json({ error: "accessory not owned" });
      return;
    }

    // Equip: upsert into snail_equipment (1 per snail)
    await query(
      "INSERT INTO snail_equipment (snail_id, accessory_id) VALUES ($1, $2) ON CONFLICT (snail_id) DO UPDATE SET accessory_id = $2",
      [snailId, accessoryId]
    );

    res.json({ equipped: true, snailId, accessoryId });
  } catch (err) {
    console.error("POST /equip-accessory error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/slug/unequip-accessory — Unequip an accessory from a snail
router.post("/unequip-accessory", async (req: Request, res: Response) => {
  try {
    const { wallet, snailId } = req.body;

    if (!wallet || !snailId) {
      res.status(400).json({ error: "wallet and snailId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    // Verify ownership of snail
    const slug = await getOne(
      "SELECT id FROM slugs WHERE id = $1 AND wallet = $2 AND is_burned = 0",
      [snailId, wallet]
    );
    if (!slug) {
      res.status(404).json({ error: "snail not found or not owned" });
      return;
    }

    await query("DELETE FROM snail_equipment WHERE snail_id = $1", [snailId]);

    res.json({ unequipped: true, snailId });
  } catch (err) {
    console.error("POST /unequip-accessory error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/slug/profile/:wallet — Aggregated profile data
router.get("/profile/:wallet", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    // Get all creatures
    const slugs = await getAll("SELECT * FROM slugs WHERE wallet = $1 AND is_burned = false ORDER BY id", [wallet]);

    // Get coin balance
    const balRow = await getOne("SELECT balance FROM coin_balances WHERE wallet = $1", [wallet]);
    const balance = balRow?.balance || 0;

    // Get XP
    const xpRow = await getOne("SELECT total_xp FROM user_xp WHERE wallet = $1", [wallet]);
    const xp = xpRow?.total_xp || 0;

    // Get race stats
    const raceStats = await getOne(
      `SELECT COUNT(*) as total_races,
       COALESCE(SUM(CASE WHEN finish_position = 1 THEN 1 ELSE 0 END), 0) as total_wins,
       COALESCE(SUM(payout), 0) as total_earnings
       FROM race_participants WHERE wallet = $1 AND is_bot = 0`, [wallet]
    );

    // Get login streak
    const loginCount = await getOne(
      "SELECT COUNT(DISTINCT login_date) as days FROM daily_logins WHERE wallet = $1", [wallet]
    );

    res.json({
      wallet,
      balance,
      xp: parseInt(String(xp)) || 0,
      totalRaces: parseInt(String(raceStats?.total_races)) || 0,
      totalWins: parseInt(String(raceStats?.total_wins)) || 0,
      totalEarnings: parseInt(String(raceStats?.total_earnings)) || 0,
      loginDays: parseInt(String(loginCount?.days)) || 0,
      slugCount: slugs.filter((s: any) => s.type === 'free_slug').length,
      snailCount: slugs.filter((s: any) => s.type === 'snail').length,
    });
  } catch (err) {
    console.error("GET /profile/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/slug/profile/transactions/:wallet — Recent transactions
router.get("/profile/transactions/:wallet", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }
    const txns = await getAll(
      "SELECT type, amount, description, created_at FROM transactions WHERE wallet = $1 ORDER BY created_at DESC LIMIT 20",
      [wallet]
    );
    res.json({ transactions: txns });
  } catch (err) {
    console.error("GET /profile/transactions/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/slug/cosmetics/:snailId — Get equipped cosmetics for a snail
router.get("/cosmetics/:snailId", async (req: Request, res: Response) => {
  try {
    const { snailId } = req.params;

    const cosmetics = await getAll(
      `SELECT c.*, uc.equipped_snail_id
       FROM user_cosmetics uc
       JOIN cosmetics c ON uc.cosmetic_id = c.id
       WHERE uc.equipped_snail_id = $1`,
      [snailId]
    );

    const equipment = await getOne(
      `SELECT a.* FROM snail_equipment se JOIN accessories a ON se.accessory_id = a.id WHERE se.snail_id = $1`,
      [snailId]
    );

    res.json({ cosmetics, accessory: equipment || null });
  } catch (err) {
    console.error("GET /cosmetics/:snailId error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
