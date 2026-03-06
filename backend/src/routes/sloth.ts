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
const RACES = ["caffeine_junkie", "pillow_knight", "dream_weaver", "thunder_nap"] as const;

// Starting stat biases per race (small 1-2 point differences)
const RACE_BIAS: Record<string, Partial<Record<string, number>>> = {
  caffeine_junkie: { spd: 2, acc: 1 },
  pillow_knight: { sta: 2, ref: 1 },
  dream_weaver: { lck: 2, agi: 1 },
  thunder_nap: { agi: 2, ref: 1 },
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
  const prefixes = ["Speedy", "Sleepy", "Turbo", "Drowsy", "Shadow", "Crystal", "Thunder", "Dreamwalk", "Iron", "Golden"];
  const suffixes = ["Napper", "Snooze", "Yawner", "Racer", "Runner", "Dasher", "Glider", "Rocket", "Bolt", "Storm"];
  return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
}

// POST /api/sloth/mint — Mint a Free Sloth
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

    // Check if wallet already has a free sloth (not burned)
    const existing = await getOne(
      "SELECT id FROM sloths WHERE wallet = $1 AND type = 'free_sloth' AND is_burned = 0",
      [wallet]
    );

    if (existing) {
      res.status(409).json({ error: "wallet already has a Free Sloth" });
      return;
    }

    const name = generateName();
    const result = await getOne(
      "INSERT INTO sloths (wallet, type, name) VALUES ($1, 'free_sloth', $2) RETURNING id",
      [wallet, name]
    );

    const sloth = await getOne("SELECT * FROM sloths WHERE id = $1", [result.id]);

    res.status(201).json({ sloth });
  } catch (err) {
    console.error("POST /mint error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sloth/upgrade — Upgrade Free Sloth to Sloth
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

    // Find the free sloth
    const freeSloth = await getOne(
      "SELECT * FROM sloths WHERE wallet = $1 AND type = 'free_sloth' AND is_burned = 0",
      [wallet]
    );

    if (!freeSloth) {
      res.status(404).json({ error: "no Free Sloth found to upgrade" });
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

    // Transaction: burn free sloth + create sloth + give 500 coins
    const sloth = await runTransaction(async (client) => {
      // Burn the free sloth
      await client.query("UPDATE sloths SET is_burned = 1 WHERE id = $1", [freeSloth.id]);

      // Create sloth
      const name = generateName();
      const slothResult = await client.query(
        `INSERT INTO sloths (wallet, type, name, rarity, race, spd, acc, sta, agi, ref, lck)
         VALUES ($1, 'sloth', $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [wallet, name, rarity, race, stats.spd, stats.acc, stats.sta, stats.agi, stats.ref, stats.lck]
      );

      // Give 500 ZZZ Coin
      await client.query(
        `INSERT INTO coin_balances (wallet, balance) VALUES ($1, 500)
         ON CONFLICT(wallet) DO UPDATE SET balance = coin_balances.balance + 500, updated_at = NOW()`,
        [wallet]
      );

      // Record transaction
      await client.query(
        "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'upgrade_bonus', 500, 'Sloth upgrade bonus')",
        [wallet]
      );

      const slothRow = await client.query("SELECT * FROM sloths WHERE id = $1", [slothResult.rows[0].id]);
      return slothRow.rows[0];
    });

    res.status(201).json({
      sloth,
      burnedSlothId: freeSloth.id,
      coinBonus: 500,
    });
  } catch (err) {
    console.error("POST /upgrade error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sloth/treehouse/:wallet — Get all sloths for a wallet
router.get("/treehouse/:wallet", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const sloths = await getAll(
      "SELECT * FROM sloths WHERE wallet = $1 AND is_burned = 0 ORDER BY created_at DESC",
      [wallet]
    );

    const balance = await getOne(
      "SELECT balance FROM coin_balances WHERE wallet = $1",
      [wallet]
    );

    res.json({
      sloths,
      coinBalance: balance?.balance || 0,
    });
  } catch (err) {
    console.error("GET /treehouse/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sloth/rename — Rename a sloth
const NAME_BLACKLIST = ['fuck', 'shit', 'ass', 'dick', 'porn', 'nazi', 'sik', 'amk', 'orospu'];

router.post("/rename", async (req: Request, res: Response) => {
  try {
    const { wallet, slothId, name } = req.body;

    if (!wallet || !slothId || !name) {
      res.status(400).json({ error: "wallet, slothId, and name required" });
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

    const sloth = await getOne(
      "SELECT id FROM sloths WHERE id = $1 AND wallet = $2 AND is_burned = 0",
      [slothId, wallet]
    );

    if (!sloth) {
      res.status(404).json({ error: "sloth not found or not owned" });
      return;
    }

    await query("UPDATE sloths SET name = $1 WHERE id = $2", [trimmed, slothId]);

    res.json({ renamed: true, slothId, newName: trimmed });
  } catch (err) {
    console.error("POST /rename error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sloth/streaks/:wallet — Get streaks for a wallet's sloths
router.get("/streaks/:wallet", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const streaks = await getAll(
      `SELECT s.sloth_id, s.current_wins, s.max_wins, s.current_losses, s.total_races, s.total_wins
       FROM streaks s
       JOIN sloths sl ON s.sloth_id = sl.id
       WHERE sl.wallet = $1 AND sl.is_burned = 0`,
      [wallet]
    );

    res.json({ streaks });
  } catch (err) {
    console.error("GET /streaks/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/coin/:wallet — Get ZZZ Coin balance
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

// GET /api/sloth/xp/:wallet — Get XP for a wallet
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

// POST /api/sloth/daily-login — Claim daily login bonus (15 ZZZ)
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
  free_sloth: 15, common: 22, uncommon: 25, rare: 28, epic: 31, legendary: 35,
};

function getStatCap(type: string, rarity: string, tier: number = 0, evolutionPath?: string, stat?: string): number {
  let cap = type === 'free_sloth' ? 15 : (STAT_CAPS[rarity] || 22);
  if (tier >= 3 && evolutionPath && stat) {
    const pathStats: Record<string, string[]> = {
      caffeine: ['spd', 'acc'],
      hibernate: ['sta', 'ref'],
      dreamwalk: ['lck', 'agi'],
    };
    if (pathStats[evolutionPath]?.includes(stat)) cap += 5;
    if (tier >= 4) cap += 3;
  }
  return cap;
}

// POST /api/sloth/train — Start a training session (6h, 10 ZZZ cost)
router.post("/train", async (req: Request, res: Response) => {
  try {
    const { wallet, slothId, stat } = req.body;
    if (!wallet || !slothId || !stat) {
      res.status(400).json({ error: "wallet, slothId, and stat required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const parsedSlothId = parseInt(slothId);
    if (isNaN(parsedSlothId) || parsedSlothId <= 0) {
      res.status(400).json({ error: "Invalid slothId" });
      return;
    }

    try {
      assertValidStat(stat);
    } catch {
      res.status(400).json({ error: "Invalid stat. Must be: spd, acc, sta, agi, ref, lck" });
      return;
    }

    // Verify ownership
    const sloth = await getOne(
      "SELECT * FROM sloths WHERE id = $1 AND wallet = $2 AND is_burned = 0",
      [parsedSlothId, wallet]
    );
    if (!sloth) {
      res.status(404).json({ error: "creature not found or not owned" });
      return;
    }

    // Check stat cap
    const cap = getStatCap(sloth.type, sloth.rarity, sloth.tier || 0, sloth.evolution_path, stat);
    if (sloth[stat] >= cap) {
      res.status(400).json({ error: `${stat.toUpperCase()} is already at max (${cap}) for this rarity` });
      return;
    }

    // Check if already in training (unclaimed)
    const activeTraining = await getOne(
      "SELECT id FROM trainings WHERE sloth_id = $1 AND claimed = 0",
      [parsedSlothId]
    );
    if (activeTraining) {
      res.status(400).json({ error: "This creature is already in training" });
      return;
    }

    // Check weekly training limit (free_sloth: 1/week, sloth: 2/week)
    const weeklyLimit = sloth.type === 'free_sloth' ? 1 : 2;
    const weekTrainings = await getOne(
      "SELECT COUNT(*) as count FROM trainings WHERE sloth_id = $1 AND started_at >= date_trunc('week', CURRENT_TIMESTAMP)",
      [parsedSlothId]
    );
    if (parseInt(weekTrainings?.count || 0) >= weeklyLimit) {
      res.status(400).json({ error: `Weekly training limit reached (${weeklyLimit}/week)` });
      return;
    }

    // Check balance (10 ZZZ cost)
    const balance = await getOne("SELECT balance FROM coin_balances WHERE wallet = $1", [wallet]);
    if ((balance?.balance || 0) < 10) {
      res.status(400).json({ error: "Need 10 ZZZ for training" });
      return;
    }

    // Deduct cost and start training (6 hours)
    await query(
      "UPDATE coin_balances SET balance = balance - 10, updated_at = NOW() WHERE wallet = $1",
      [wallet]
    );
    await query(
      "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'training_cost', -10, $2)",
      [wallet, `Training ${stat.toUpperCase()} for sloth #${parsedSlothId}`]
    );

    const completedAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    await query(
      "INSERT INTO trainings (sloth_id, wallet, stat, completed_at) VALUES ($1, $2, $3, $4)",
      [parsedSlothId, wallet, stat, completedAt]
    );

    res.json({ started: true, slothId: parsedSlothId, stat, completedAt });
  } catch (err) {
    console.error("POST /train error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sloth/claim-training — Claim training reward
router.post("/claim-training", async (req: Request, res: Response) => {
  try {
    const { wallet, slothId } = req.body;
    if (!wallet || !slothId) {
      res.status(400).json({ error: "wallet and slothId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const training = await getOne(
      "SELECT * FROM trainings WHERE sloth_id = $1 AND wallet = $2 AND claimed = 0",
      [slothId, wallet]
    );
    if (!training) {
      res.status(404).json({ error: "No active training found" });
      return;
    }

    if (new Date(training.completed_at) > new Date()) {
      res.status(400).json({ error: "Training not completed yet" });
      return;
    }

    const sloth = await getOne("SELECT * FROM sloths WHERE id = $1", [slothId]);
    if (!sloth) {
      res.status(404).json({ error: "creature not found" });
      return;
    }

    const stat = training.stat;
    const cap = getStatCap(sloth.type, sloth.rarity, sloth.tier || 0, sloth.evolution_path, stat);
    const gain = Math.min(0.3, Math.max(0, cap - (sloth[stat] || 0)));

    if (gain > 0) {
      assertValidStat(stat);
      await query(`UPDATE sloths SET ${stat} = ${stat} + $1 WHERE id = $2`, [gain, slothId]);
    }
    await query("UPDATE trainings SET claimed = 1 WHERE id = $1", [training.id]);
    await awardXP(wallet, 5);

    // Trigger training_complete quest
    await triggerQuestProgress(wallet, "training_complete");

    res.json({ claimed: true, slothId, stat, gain, newStatValue: (sloth[stat] || 0) + gain });
  } catch (err) {
    console.error("POST /claim-training error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sloth/training-status/:wallet — Get active trainings
router.get("/training-status/:wallet", async (req: Request, res: Response) => {
  try {
    const wallet = req.params.wallet as string;

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const trainings = await getAll(
      `SELECT t.*, s.name as sloth_name FROM trainings t
       JOIN sloths s ON t.sloth_id = s.id
       WHERE t.wallet = $1 AND t.claimed = 0
       ORDER BY t.started_at DESC`,
      [wallet]
    );

    const result = trainings.map((t: any) => ({
      slothId: t.sloth_id,
      slothName: t.sloth_name,
      stat: t.stat,
      startedAt: t.started_at,
      completedAt: t.completed_at,
      isReady: new Date(t.completed_at) <= new Date(),
    }));

    // Get weekly training counts per sloth
    const weeklyCounts = await getAll(
      `SELECT s.id as sloth_id, COUNT(t.id) as count FROM sloths s
       LEFT JOIN trainings t ON t.sloth_id = s.id AND t.started_at >= date_trunc('week', CURRENT_TIMESTAMP)
       WHERE s.wallet = $1 AND s.is_burned = 0
       GROUP BY s.id`,
      [wallet]
    );
    const weeklyMap: Record<number, number> = {};
    for (const wc of weeklyCounts) {
      weeklyMap[wc.sloth_id] = parseInt(wc.count) || 0;
    }

    res.json({ trainings: result, weeklyCounts: weeklyMap });
  } catch (err) {
    console.error("GET /training-status/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sloth/upgrade-progress/:wallet — Check free upgrade eligibility
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

// POST /api/sloth/free-upgrade — Free upgrade path (meet all 4 requirements)
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

    // Find the free sloth
    const freeSloth = await getOne(
      "SELECT * FROM sloths WHERE wallet = $1 AND type = 'free_sloth' AND is_burned = 0",
      [wallet]
    );

    if (!freeSloth) {
      res.status(404).json({ error: "no Free Sloth found to upgrade" });
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

    const sloth = await runTransaction(async (client) => {
      await client.query("UPDATE sloths SET is_burned = 1 WHERE id = $1", [freeSloth.id]);

      const name = generateName();
      const slothResult = await client.query(
        `INSERT INTO sloths (wallet, type, name, rarity, race, spd, acc, sta, agi, ref, lck)
         VALUES ($1, 'sloth', $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
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

      const slothRow = await client.query("SELECT * FROM sloths WHERE id = $1", [slothResult.rows[0].id]);
      return slothRow.rows[0];
    });

    res.status(201).json({
      sloth,
      burnedSlothId: freeSloth.id,
      coinBonus: 500,
    });
  } catch (err) {
    console.error("POST /free-upgrade error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sloth/mini-game — Play a mini game for stat gain
router.post("/mini-game", async (req: Request, res: Response) => {
  try {
    const { wallet, slothId, gameType, score } = req.body;

    if (!wallet || !slothId || !gameType || score === undefined) {
      res.status(400).json({ error: "wallet, slothId, gameType, and score required" });
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
      yawn_stretch: 'spd',
      pillow_lift: 'sta',
      lucky_leaf: 'lck',
      speed_tap: 'acc',
    };

    const stat = statMap[gameType];
    if (!stat) {
      res.status(400).json({ error: "Invalid gameType. Must be: salt_dodge, yawn_stretch, pillow_lift, lucky_leaf, speed_tap" });
      return;
    }

    // Verify ownership
    const sloth = await getOne(
      "SELECT * FROM sloths WHERE id = $1 AND wallet = $2 AND is_burned = 0",
      [slothId, wallet]
    );
    if (!sloth) {
      res.status(404).json({ error: "creature not found or not owned" });
      return;
    }

    // Check daily limit — wallet-based (5/day total across all creatures)
    const today = new Date().toISOString().split("T")[0];
    const dailyLimit = 5;

    await query(
      "INSERT INTO daily_minigame_plays (sloth_id, play_date, count) VALUES ($1, $2, 0) ON CONFLICT DO NOTHING",
      [slothId, today]
    );
    const walletPlays = await getOne(
      `SELECT COALESCE(SUM(dmp.count), 0) as total_count
       FROM daily_minigame_plays dmp
       JOIN sloths s ON dmp.sloth_id = s.id
       WHERE s.wallet = $1 AND dmp.play_date = $2`,
      [wallet, today]
    );

    if ((walletPlays?.total_count || 0) >= dailyLimit) {
      res.status(400).json({ error: `Daily mini-game limit reached (${dailyLimit}/day across all creatures)` });
      return;
    }

    // Check stat cap
    const cap = getStatCap(sloth.type, sloth.rarity, sloth.tier || 0, sloth.evolution_path, stat);
    if (sloth[stat] >= cap) {
      res.status(400).json({ error: `${stat.toUpperCase()} is already at max (${cap})` });
      return;
    }

    // Calculate gain
    const gain = Math.max(0.1, Math.min(0.5, parsedScore / 100 * 0.5));
    const actualGain = Math.min(gain, Math.max(0, cap - (sloth[stat] || 0)));

    // Update stat and track play
    assertValidStat(stat);
    await query(`UPDATE sloths SET ${stat} = ${stat} + $1 WHERE id = $2`, [actualGain, slothId]);
    await query(
      "UPDATE daily_minigame_plays SET count = count + 1 WHERE sloth_id = $1 AND play_date = $2",
      [slothId, today]
    );

    // Award 8 XP
    await awardXP(wallet, 8);

    // Trigger mini_game_complete quest
    await triggerQuestProgress(wallet, "mini_game_complete");

    res.json({
      played: true,
      slothId,
      gameType,
      stat,
      gain: actualGain,
      newStatValue: (sloth[stat] || 0) + actualGain,
      playsToday: (walletPlays?.total_count || 0) + 1,
      dailyLimit,
    });
  } catch (err) {
    console.error("POST /mini-game error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sloth/evolution-progress/:slothId — Get evolution progress
router.get("/evolution-progress/:slothId", async (req: Request, res: Response) => {
  try {
    const { slothId } = req.params;

    const sloth = await getOne(
      "SELECT * FROM sloths WHERE id = $1 AND is_burned = 0",
      [slothId]
    );
    if (!sloth) {
      res.status(404).json({ error: "creature not found" });
      return;
    }

    const tier = sloth.tier || 0;
    const wallet = sloth.wallet;

    // Get race stats
    const totalRacesRow = await getOne(
      "SELECT COUNT(*) as count FROM race_participants WHERE wallet = $1 AND sloth_id = $2 AND is_bot = 0",
      [wallet, slothId]
    );
    const totalRaces = parseInt(totalRacesRow?.count) || 0;

    const totalWinsRow = await getOne(
      "SELECT COUNT(*) as count FROM race_participants WHERE wallet = $1 AND sloth_id = $2 AND is_bot = 0 AND finish_position = 1",
      [wallet, slothId]
    );
    const totalWins = parseInt(totalWinsRow?.count) || 0;

    const xp = await getXP(wallet);

    const balance = await getOne("SELECT balance FROM coin_balances WHERE wallet = $1", [wallet]);
    const zzzBalance = balance?.balance || 0;

    // Get highest stat
    const stats = [sloth.spd, sloth.acc, sloth.sta, sloth.agi, sloth.ref, sloth.lck];
    const maxStat = Math.max(...stats);

    // Requirements per tier
    const tierReqs: Record<number, any> = {
      1: { xp: 2000, races: 50, wins: 18, zzz: 800, stat: 20 },
      2: { xp: 4000, races: 150, wins: 55, zzz: 2000, stat: 24, pathRequired: true },
      3: { xp: 6000, races: 300, wins: 120, zzz: 3500, stat: 28 },
    };

    const nextTier = tier + 1;
    const reqs = tierReqs[nextTier] || null;

    let eligible = false;
    if (reqs) {
      eligible = xp >= reqs.xp &&
        totalRaces >= reqs.races &&
        totalWins >= reqs.wins &&
        zzzBalance >= reqs.zzz &&
        maxStat >= reqs.stat;
    }

    res.json({
      slothId: parseInt(slothId as string),
      currentTier: tier,
      evolutionPath: sloth.evolution_path || null,
      passive: sloth.passive || null,
      nextTierRequirements: reqs,
      progress: {
        xp,
        races: totalRaces,
        wins: totalWins,
        zzzBalance,
        maxStat,
      },
      eligible,
    });
  } catch (err) {
    console.error("GET /evolution-progress/:slothId error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sloth/evolve — Evolve a sloth to next tier
router.post("/evolve", async (req: Request, res: Response) => {
  try {
    const { wallet, slothId, path } = req.body;

    if (!wallet || !slothId) {
      res.status(400).json({ error: "wallet and slothId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const sloth = await getOne(
      "SELECT * FROM sloths WHERE id = $1 AND wallet = $2 AND is_burned = 0 AND type = 'sloth'",
      [slothId, wallet]
    );
    if (!sloth) {
      res.status(404).json({ error: "sloth not found or not owned" });
      return;
    }

    const tier = sloth.tier || 1;
    const nextTier = tier + 1;

    if (nextTier > 4) {
      res.status(400).json({ error: "Already at max tier" });
      return;
    }

    // Get stats
    const totalRacesRow = await getOne(
      "SELECT COUNT(*) as count FROM race_participants WHERE wallet = $1 AND sloth_id = $2 AND is_bot = 0",
      [wallet, slothId]
    );
    const totalRaces = parseInt(totalRacesRow?.count) || 0;

    const totalWinsRow = await getOne(
      "SELECT COUNT(*) as count FROM race_participants WHERE wallet = $1 AND sloth_id = $2 AND is_bot = 0 AND finish_position = 1",
      [wallet, slothId]
    );
    const totalWins = parseInt(totalWinsRow?.count) || 0;

    const xp = await getXP(wallet);
    const balance = await getOne("SELECT balance FROM coin_balances WHERE wallet = $1", [wallet]);
    const zzzBalance = balance?.balance || 0;

    const stats = [sloth.spd, sloth.acc, sloth.sta, sloth.agi, sloth.ref, sloth.lck];
    const maxStat = Math.max(...stats);

    // Requirements per tier
    const tierReqs: Record<number, { xp: number; races: number; wins: number; zzz: number; stat: number; pathRequired?: boolean }> = {
      2: { xp: 2000, races: 50, wins: 18, zzz: 800, stat: 20 },
      3: { xp: 4000, races: 150, wins: 55, zzz: 2000, stat: 24, pathRequired: true },
      4: { xp: 6000, races: 300, wins: 120, zzz: 3500, stat: 28 },
    };

    const reqs = tierReqs[nextTier];
    if (!reqs) {
      res.status(400).json({ error: "Invalid evolution tier" });
      return;
    }

    if (xp < reqs.xp || totalRaces < reqs.races || totalWins < reqs.wins || zzzBalance < reqs.zzz || maxStat < reqs.stat) {
      res.status(400).json({ error: "Requirements not met", requirements: reqs, progress: { xp, races: totalRaces, wins: totalWins, zzzBalance, maxStat } });
      return;
    }

    // Tier 3 requires path selection
    if (reqs.pathRequired && !path) {
      res.status(400).json({ error: "Evolution path required for tier 3. Choose: caffeine, hibernate, or dreamwalk" });
      return;
    }

    const validPaths = ['caffeine', 'hibernate', 'dreamwalk'];
    if (reqs.pathRequired && !validPaths.includes(path)) {
      res.status(400).json({ error: "Invalid path. Choose: caffeine, hibernate, or dreamwalk" });
      return;
    }

    // Determine passive ability based on path and tier
    const passiveMap: Record<string, Record<number, string>> = {
      caffeine: { 3: 'caffeine_rush', 4: 'adrenaline_wake' },
      hibernate: { 3: 'deep_sleep', 4: 'thick_fur' },
      dreamwalk: { 3: 'dream_catcher', 4: 'lucid_dream' },
    };

    const evolutionPath = path || sloth.evolution_path;
    const passive = evolutionPath && passiveMap[evolutionPath] ? passiveMap[evolutionPath][nextTier] || sloth.passive : sloth.passive;

    await runTransaction(async (client) => {
      // Deduct ZZZ
      await client.query(
        "UPDATE coin_balances SET balance = balance - $1, updated_at = NOW() WHERE wallet = $2",
        [reqs.zzz, wallet]
      );
      await client.query(
        "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'evolution_cost', $2, $3)",
        [wallet, -reqs.zzz, `Evolution to tier ${nextTier} for sloth #${slothId}`]
      );

      // Update sloth
      await client.query(
        "UPDATE sloths SET tier = $1, evolution_path = COALESCE($2, evolution_path), passive = $3 WHERE id = $4",
        [nextTier, evolutionPath || null, passive || null, slothId]
      );
    });

    res.json({
      evolved: true,
      slothId,
      newTier: nextTier,
      evolutionPath: evolutionPath || null,
      passive: passive || null,
    });
  } catch (err) {
    console.error("POST /evolve error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sloth/equip-cosmetic — Equip a cosmetic to a sloth
router.post("/equip-cosmetic", async (req: Request, res: Response) => {
  try {
    const { wallet, slothId, cosmeticId } = req.body;

    if (!wallet || !slothId || !cosmeticId) {
      res.status(400).json({ error: "wallet, slothId, and cosmeticId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    // Verify ownership of sloth
    const sloth = await getOne(
      "SELECT id FROM sloths WHERE id = $1 AND wallet = $2 AND is_burned = 0",
      [slothId, wallet]
    );
    if (!sloth) {
      res.status(404).json({ error: "sloth not found or not owned" });
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

    // Equip: set equipped_sloth_id
    await query(
      "UPDATE user_cosmetics SET equipped_sloth_id = $1 WHERE wallet = $2 AND cosmetic_id = $3",
      [slothId, wallet, cosmeticId]
    );

    res.json({ equipped: true, slothId, cosmeticId });
  } catch (err) {
    console.error("POST /equip-cosmetic error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sloth/equip-accessory — Equip an accessory to a sloth
router.post("/equip-accessory", async (req: Request, res: Response) => {
  try {
    const { wallet, slothId, accessoryId } = req.body;

    if (!wallet || !slothId || !accessoryId) {
      res.status(400).json({ error: "wallet, slothId, and accessoryId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    // Verify ownership of sloth
    const sloth = await getOne(
      "SELECT id FROM sloths WHERE id = $1 AND wallet = $2 AND is_burned = 0",
      [slothId, wallet]
    );
    if (!sloth) {
      res.status(404).json({ error: "sloth not found or not owned" });
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

    // Equip: upsert into sloth_equipment (1 per sloth)
    await query(
      "INSERT INTO sloth_equipment (sloth_id, accessory_id) VALUES ($1, $2) ON CONFLICT (sloth_id) DO UPDATE SET accessory_id = $2",
      [slothId, accessoryId]
    );

    res.json({ equipped: true, slothId, accessoryId });
  } catch (err) {
    console.error("POST /equip-accessory error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sloth/unequip-accessory — Unequip an accessory from a sloth
router.post("/unequip-accessory", async (req: Request, res: Response) => {
  try {
    const { wallet, slothId } = req.body;

    if (!wallet || !slothId) {
      res.status(400).json({ error: "wallet and slothId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    // Verify ownership of sloth
    const sloth = await getOne(
      "SELECT id FROM sloths WHERE id = $1 AND wallet = $2 AND is_burned = 0",
      [slothId, wallet]
    );
    if (!sloth) {
      res.status(404).json({ error: "sloth not found or not owned" });
      return;
    }

    await query("DELETE FROM sloth_equipment WHERE sloth_id = $1", [slothId]);

    res.json({ unequipped: true, slothId });
  } catch (err) {
    console.error("POST /unequip-accessory error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sloth/profile/:wallet — Aggregated profile data
router.get("/profile/:wallet", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    // Get all creatures
    const sloths = await getAll("SELECT * FROM sloths WHERE wallet = $1 AND is_burned = false ORDER BY id", [wallet]);

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
      freeSlothCount: sloths.filter((s: any) => s.type === 'free_sloth').length,
      slothCount: sloths.filter((s: any) => s.type === 'sloth').length,
    });
  } catch (err) {
    console.error("GET /profile/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sloth/profile/transactions/:wallet — Recent transactions
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

// GET /api/sloth/cosmetics/:slothId — Get equipped cosmetics for a sloth
router.get("/cosmetics/:slothId", async (req: Request, res: Response) => {
  try {
    const { slothId } = req.params;

    const cosmetics = await getAll(
      `SELECT c.*, uc.equipped_sloth_id
       FROM user_cosmetics uc
       JOIN cosmetics c ON uc.cosmetic_id = c.id
       WHERE uc.equipped_sloth_id = $1`,
      [slothId]
    );

    const equipment = await getOne(
      `SELECT a.* FROM sloth_equipment se JOIN accessories a ON se.accessory_id = a.id WHERE se.sloth_id = $1`,
      [slothId]
    );

    res.json({ cosmetics, accessory: equipment || null });
  } catch (err) {
    console.error("GET /cosmetics/:slothId error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
