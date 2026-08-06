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
const RACES = ["speedster", "tank", "trickster", "burst"] as const;

// Starting stat biases per race (small 1-2 point differences)
const RACE_BIAS: Record<string, Partial<Record<string, number>>> = {
  speedster: { spd: 2, acc: 1 },
  tank: { sta: 2, ref: 1 },
  trickster: { lck: 2, agi: 1 },
  burst: { agi: 2, ref: 1 },
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

// Starter names are deliberately theme-neutral: they describe motion and
// material, not any particular brand's creature. Players rename freely.
function generateName(): string {
  const prefixes = ["Speedy", "Turbo", "Shadow", "Crystal", "Thunder", "Copper", "Iron", "Golden", "Swift", "Scarlet"];
  const suffixes = ["Racer", "Runner", "Dasher", "Glider", "Rocket", "Bolt", "Storm", "Spark", "Comet", "Dart"];
  return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
}

// POST /api/racer/mint — Mint a Free Racer
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

    // Check if wallet already has ANY active (non-burned) creature
    const existingActive = await getOne(
      "SELECT id, type FROM racers WHERE wallet = $1 AND is_burned = 0",
      [wallet]
    );

    if (existingActive) {
      if (existingActive.type === 'free') {
        res.status(409).json({ error: "wallet already has a Free Racer" });
      } else {
        res.status(409).json({ error: "wallet already has a Racer. Free Racer mint is not available after upgrade." });
      }
      return;
    }

    const name = generateName();
    const result = await getOne(
      "INSERT INTO racers (wallet, type, name) VALUES ($1, 'free', $2) RETURNING id",
      [wallet, name]
    );

    // Welcome Bonus: 10 coins for new players
    await query(
      `INSERT INTO coin_balances (wallet, balance) VALUES ($1, 10)
       ON CONFLICT(wallet) DO UPDATE SET balance = coin_balances.balance + 10, updated_at = NOW()`,
      [wallet]
    );
    await query(
      "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'welcome_bonus', 10, 'Welcome Bonus — first mint!')",
      [wallet]
    );

    const racer = await getOne("SELECT * FROM racers WHERE id = $1", [result.id]);

    res.status(201).json({ racer, welcomeBonus: 10 });
  } catch (err) {
    console.error("POST /mint error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/racer/upgrade — Upgrade Free Racer to Racer
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

    // Find the free racer
    const freeRacer = await getOne(
      "SELECT * FROM racers WHERE wallet = $1 AND type = 'free' AND is_burned = 0",
      [wallet]
    );

    if (!freeRacer) {
      res.status(404).json({ error: "no Free Racer found to upgrade" });
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

    // Transaction: burn free racer + create racer + give 500 coins
    const racer = await runTransaction(async (client) => {
      // Burn the free racer
      await client.query("UPDATE racers SET is_burned = 1 WHERE id = $1", [freeRacer.id]);

      // Create racer
      const name = generateName();
      const racerResult = await client.query(
        `INSERT INTO racers (wallet, type, name, rarity, race, spd, acc, sta, agi, ref, lck)
         VALUES ($1, 'pro', $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [wallet, name, rarity, race, stats.spd, stats.acc, stats.sta, stats.agi, stats.ref, stats.lck]
      );

      // Give 500 coins
      await client.query(
        `INSERT INTO coin_balances (wallet, balance) VALUES ($1, 500)
         ON CONFLICT(wallet) DO UPDATE SET balance = coin_balances.balance + 500, updated_at = NOW()`,
        [wallet]
      );

      // Record transaction
      await client.query(
        "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'upgrade_bonus', 500, 'Racer upgrade bonus')",
        [wallet]
      );

      const racerRow = await client.query("SELECT * FROM racers WHERE id = $1", [racerResult.rows[0].id]);
      return racerRow.rows[0];
    });

    res.status(201).json({
      racer,
      burnedRacerId: freeRacer.id,
      coinBonus: 500,
    });
  } catch (err) {
    console.error("POST /upgrade error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/racer/collection/:wallet — Get all racers for a wallet
router.get("/collection/:wallet", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const racers = await getAll(
      "SELECT * FROM racers WHERE wallet = $1 AND is_burned = 0 ORDER BY created_at DESC",
      [wallet]
    );

    const balance = await getOne(
      "SELECT balance FROM coin_balances WHERE wallet = $1",
      [wallet]
    );

    res.json({
      racers,
      coinBalance: balance?.balance || 0,
    });
  } catch (err) {
    console.error("GET /collection/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/racer/rename — Rename a racer
const NAME_BLACKLIST = ['fuck', 'shit', 'ass', 'dick', 'porn', 'nazi', 'sik', 'amk', 'orospu'];

router.post("/rename", async (req: Request, res: Response) => {
  try {
    const { wallet, racerId, name } = req.body;

    if (!wallet || !racerId || !name) {
      res.status(400).json({ error: "wallet, racerId, and name required" });
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

    const racer = await getOne(
      "SELECT id FROM racers WHERE id = $1 AND wallet = $2 AND is_burned = 0",
      [racerId, wallet]
    );

    if (!racer) {
      res.status(404).json({ error: "racer not found or not owned" });
      return;
    }

    await query("UPDATE racers SET name = $1 WHERE id = $2", [trimmed, racerId]);

    res.json({ renamed: true, racerId, newName: trimmed });
  } catch (err) {
    console.error("POST /rename error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/racer/streaks/:wallet — Get streaks for a wallet's racers
router.get("/streaks/:wallet", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const streaks = await getAll(
      `SELECT s.racer_id, s.current_wins, s.max_wins, s.current_losses, s.total_races, s.total_wins
       FROM streaks s
       JOIN racers sl ON s.racer_id = sl.id
       WHERE sl.wallet = $1 AND sl.is_burned = 0`,
      [wallet]
    );

    res.json({ streaks });
  } catch (err) {
    console.error("GET /streaks/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/coin/:wallet — Get coin balance
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

// GET /api/racer/xp/:wallet — Get XP for a wallet
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

// POST /api/racer/daily-login — Claim daily login bonus (15 coins)
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
  free: 15, common: 22, uncommon: 25, rare: 28, epic: 31, legendary: 35,
};

function getStatCap(type: string, rarity: string, tier: number = 0, evolutionPath?: string, stat?: string): number {
  let cap = type === 'free' ? 15 : (STAT_CAPS[rarity] || 22);
  if (tier >= 3 && evolutionPath && stat) {
    const pathStats: Record<string, string[]> = {
      speed: ['spd', 'acc'],
      endurance: ['sta', 'ref'],
      luck: ['lck', 'agi'],
    };
    if (pathStats[evolutionPath]?.includes(stat)) cap += 5;
    if (tier >= 4) cap += 3;
  }
  return cap;
}

// GET /api/racer/upgrade-progress/:wallet — Check free upgrade eligibility
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

// POST /api/racer/free-upgrade — Free upgrade path (meet all 4 requirements)
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

    // Find the free racer
    const freeRacer = await getOne(
      "SELECT * FROM racers WHERE wallet = $1 AND type = 'free' AND is_burned = 0",
      [wallet]
    );

    if (!freeRacer) {
      res.status(404).json({ error: "no Free Racer found to upgrade" });
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

    const racer = await runTransaction(async (client) => {
      await client.query("UPDATE racers SET is_burned = 1 WHERE id = $1", [freeRacer.id]);

      const name = generateName();
      const racerResult = await client.query(
        `INSERT INTO racers (wallet, type, name, rarity, race, spd, acc, sta, agi, ref, lck)
         VALUES ($1, 'pro', $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
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

      const racerRow = await client.query("SELECT * FROM racers WHERE id = $1", [racerResult.rows[0].id]);
      return racerRow.rows[0];
    });

    res.status(201).json({
      racer,
      burnedRacerId: freeRacer.id,
      coinBonus: 500,
    });
  } catch (err) {
    console.error("POST /free-upgrade error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/racer/evolution-progress/:racerId — Get evolution progress
router.get("/evolution-progress/:racerId", async (req: Request, res: Response) => {
  try {
    const racerId = parseInt(req.params.racerId as string);
    if (isNaN(racerId) || racerId <= 0) {
      res.status(400).json({ error: "Invalid racerId" });
      return;
    }

    const racer = await getOne(
      "SELECT * FROM racers WHERE id = $1 AND is_burned = 0",
      [racerId]
    );
    if (!racer) {
      res.status(404).json({ error: "creature not found" });
      return;
    }

    const tier = racer.tier ?? 0;
    const wallet = racer.wallet;

    // Get race stats
    const totalRacesRow = await getOne(
      "SELECT COUNT(*) as count FROM race_participants WHERE wallet = $1 AND racer_id = $2 AND is_bot = 0",
      [wallet, racerId]
    );
    const totalRaces = parseInt(totalRacesRow?.count) || 0;

    const totalWinsRow = await getOne(
      "SELECT COUNT(*) as count FROM race_participants WHERE wallet = $1 AND racer_id = $2 AND is_bot = 0 AND finish_position = 1",
      [wallet, racerId]
    );
    const totalWins = parseInt(totalWinsRow?.count) || 0;

    const xp = await getXP(wallet);

    const balance = await getOne("SELECT balance FROM coin_balances WHERE wallet = $1", [wallet]);
    const coinBalance = balance?.balance ?? 0;

    // Get highest stat (null-safe)
    const stats = [
      Number(racer.spd) || 0,
      Number(racer.acc) || 0,
      Number(racer.sta) || 0,
      Number(racer.agi) || 0,
      Number(racer.ref) || 0,
      Number(racer.lck) || 0,
    ];
    const maxStat = Math.max(...stats);
    const totalStats = stats.reduce((a, b) => a + b, 0);

    // Requirements per tier
    const tierReqs: Record<number, any> = {
      1: { xp: 2000, races: 50, wins: 18, coins: 800, stat: 20 },
      2: { xp: 4000, races: 150, wins: 55, coins: 2000, stat: 24, pathRequired: true },
      3: { xp: 6000, races: 300, wins: 120, coins: 3500, stat: 28 },
    };

    const nextTier = tier + 1;
    const reqs = tierReqs[nextTier] || null;

    let eligible = false;
    if (reqs) {
      eligible = xp >= reqs.xp &&
        totalRaces >= reqs.races &&
        totalWins >= reqs.wins &&
        coinBalance >= reqs.coins &&
        maxStat >= reqs.stat;
    }

    // Response uses field names matching frontend expectations
    res.json({
      racerId,
      tier,
      currentTier: tier,
      evolutionPath: racer.evolution_path || null,
      passive: racer.passive || null,
      requirements: reqs,
      nextTierRequirements: reqs,
      progress: {
        xp,
        races: totalRaces,
        wins: totalWins,
        coins: coinBalance,
        coinBalance,
        stat: maxStat,
        maxStat,
        totalStats,
      },
      eligible,
    });
  } catch (err) {
    console.error("GET /evolution-progress/:racerId error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/racer/evolve — Evolve a racer to next tier
router.post("/evolve", async (req: Request, res: Response) => {
  try {
    const { wallet, racerId, path } = req.body;

    if (!wallet || !racerId) {
      res.status(400).json({ error: "wallet and racerId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const racer = await getOne(
      "SELECT * FROM racers WHERE id = $1 AND wallet = $2 AND is_burned = 0 AND type = 'pro'",
      [racerId, wallet]
    );
    if (!racer) {
      res.status(404).json({ error: "racer not found or not owned" });
      return;
    }

    const tier = racer.tier || 1;
    const nextTier = tier + 1;

    if (nextTier > 4) {
      res.status(400).json({ error: "Already at max tier" });
      return;
    }

    // Get stats
    const totalRacesRow = await getOne(
      "SELECT COUNT(*) as count FROM race_participants WHERE wallet = $1 AND racer_id = $2 AND is_bot = 0",
      [wallet, racerId]
    );
    const totalRaces = parseInt(totalRacesRow?.count) || 0;

    const totalWinsRow = await getOne(
      "SELECT COUNT(*) as count FROM race_participants WHERE wallet = $1 AND racer_id = $2 AND is_bot = 0 AND finish_position = 1",
      [wallet, racerId]
    );
    const totalWins = parseInt(totalWinsRow?.count) || 0;

    const xp = await getXP(wallet);
    const balance = await getOne("SELECT balance FROM coin_balances WHERE wallet = $1", [wallet]);
    const coinBalance = balance?.balance || 0;

    const stats = [racer.spd, racer.acc, racer.sta, racer.agi, racer.ref, racer.lck];
    const maxStat = Math.max(...stats);

    // Requirements per tier
    const tierReqs: Record<number, { xp: number; races: number; wins: number; coins: number; stat: number; pathRequired?: boolean }> = {
      2: { xp: 2000, races: 50, wins: 18, coins: 800, stat: 20 },
      3: { xp: 4000, races: 150, wins: 55, coins: 2000, stat: 24, pathRequired: true },
      4: { xp: 6000, races: 300, wins: 120, coins: 3500, stat: 28 },
    };

    const reqs = tierReqs[nextTier];
    if (!reqs) {
      res.status(400).json({ error: "Invalid evolution tier" });
      return;
    }

    if (xp < reqs.xp || totalRaces < reqs.races || totalWins < reqs.wins || coinBalance < reqs.coins || maxStat < reqs.stat) {
      res.status(400).json({ error: "Requirements not met", requirements: reqs, progress: { xp, races: totalRaces, wins: totalWins, coinBalance, maxStat } });
      return;
    }

    // Tier 3 requires path selection
    if (reqs.pathRequired && !path) {
      res.status(400).json({ error: "Evolution path required for tier 3. Choose: speed, endurance, or luck" });
      return;
    }

    const validPaths = ['speed', 'endurance', 'luck'];
    if (reqs.pathRequired && !validPaths.includes(path)) {
      res.status(400).json({ error: "Invalid path. Choose: speed, endurance, or luck" });
      return;
    }

    // Determine passive ability based on path and tier
    const passiveMap: Record<string, Record<number, string>> = {
      speed: { 3: 'late_surge', 4: 'overtake_boost' },
      endurance: { 3: 'fatigue_resist', 4: 'impact_resist' },
      luck: { 3: 'luck_magnet', 4: 'misfortune_flip' },
    };

    const evolutionPath = path || racer.evolution_path;
    const passive = evolutionPath && passiveMap[evolutionPath] ? passiveMap[evolutionPath][nextTier] || racer.passive : racer.passive;

    await runTransaction(async (client) => {
      // Deduct coins
      await client.query(
        "UPDATE coin_balances SET balance = balance - $1, updated_at = NOW() WHERE wallet = $2",
        [reqs.coins, wallet]
      );
      await client.query(
        "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'evolution_cost', $2, $3)",
        [wallet, -reqs.coins, `Evolution to tier ${nextTier} for racer #${racerId}`]
      );

      // Update racer
      await client.query(
        "UPDATE racers SET tier = $1, evolution_path = COALESCE($2, evolution_path), passive = $3 WHERE id = $4",
        [nextTier, evolutionPath || null, passive || null, racerId]
      );
    });

    res.json({
      evolved: true,
      racerId,
      newTier: nextTier,
      evolutionPath: evolutionPath || null,
      passive: passive || null,
    });
  } catch (err) {
    console.error("POST /evolve error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/racer/equip-cosmetic — Equip a cosmetic to a racer
router.post("/equip-cosmetic", async (req: Request, res: Response) => {
  try {
    const { wallet, racerId, cosmeticId } = req.body;

    if (!wallet || !racerId || !cosmeticId) {
      res.status(400).json({ error: "wallet, racerId, and cosmeticId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    // Verify ownership of racer
    const racer = await getOne(
      "SELECT id FROM racers WHERE id = $1 AND wallet = $2 AND is_burned = 0",
      [racerId, wallet]
    );
    if (!racer) {
      res.status(404).json({ error: "racer not found or not owned" });
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

    // Equip: set equipped_racer_id
    await query(
      "UPDATE user_cosmetics SET equipped_racer_id = $1 WHERE wallet = $2 AND cosmetic_id = $3",
      [racerId, wallet, cosmeticId]
    );

    res.json({ equipped: true, racerId, cosmeticId });
  } catch (err) {
    console.error("POST /equip-cosmetic error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/racer/equip-accessory — Equip an accessory to a racer
router.post("/equip-accessory", async (req: Request, res: Response) => {
  try {
    const { wallet, racerId, accessoryId } = req.body;

    if (!wallet || !racerId || !accessoryId) {
      res.status(400).json({ error: "wallet, racerId, and accessoryId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    // Verify ownership of racer
    const racer = await getOne(
      "SELECT id FROM racers WHERE id = $1 AND wallet = $2 AND is_burned = 0",
      [racerId, wallet]
    );
    if (!racer) {
      res.status(404).json({ error: "racer not found or not owned" });
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

    // Equip: upsert into racer_equipment (1 per racer)
    await query(
      "INSERT INTO racer_equipment (racer_id, accessory_id) VALUES ($1, $2) ON CONFLICT (racer_id) DO UPDATE SET accessory_id = $2",
      [racerId, accessoryId]
    );

    res.json({ equipped: true, racerId, accessoryId });
  } catch (err) {
    console.error("POST /equip-accessory error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/racer/unequip-accessory — Unequip an accessory from a racer
router.post("/unequip-accessory", async (req: Request, res: Response) => {
  try {
    const { wallet, racerId } = req.body;

    if (!wallet || !racerId) {
      res.status(400).json({ error: "wallet and racerId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    // Verify ownership of racer
    const racer = await getOne(
      "SELECT id FROM racers WHERE id = $1 AND wallet = $2 AND is_burned = 0",
      [racerId, wallet]
    );
    if (!racer) {
      res.status(404).json({ error: "racer not found or not owned" });
      return;
    }

    await query("DELETE FROM racer_equipment WHERE racer_id = $1", [racerId]);

    res.json({ unequipped: true, racerId });
  } catch (err) {
    console.error("POST /unequip-accessory error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/racer/profile/:wallet — Aggregated profile data
router.get("/profile/:wallet", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    // Get all creatures
    const racers = await getAll("SELECT * FROM racers WHERE wallet = $1 AND is_burned = 0 ORDER BY id", [wallet]);

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
       COALESCE(SUM(reward), 0) as total_earnings
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
      freeRacerCount: racers.filter((s: any) => s.type === 'free').length,
      racerCount: racers.filter((s: any) => s.type === 'pro').length,
    });
  } catch (err) {
    console.error("GET /profile/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/racer/profile/transactions/:wallet — Recent transactions
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

// GET /api/racer/cosmetics/:racerId — Get equipped cosmetics for a racer
router.get("/cosmetics/:racerId", async (req: Request, res: Response) => {
  try {
    const racerId = parseInt(req.params.racerId as string);
    if (isNaN(racerId) || racerId <= 0) {
      res.status(400).json({ error: "Invalid racerId" });
      return;
    }

    const cosmetics = await getAll(
      `SELECT c.*, uc.equipped_racer_id
       FROM user_cosmetics uc
       LEFT JOIN cosmetics c ON uc.cosmetic_id = c.id
       WHERE uc.equipped_racer_id = $1`,
      [racerId]
    );

    // Filter out rows where cosmetic was deleted (LEFT JOIN returned null)
    const validCosmetics = cosmetics.filter((c: any) => c.id != null);

    let accessory = null;
    const equipment = await getOne(
      `SELECT a.* FROM racer_equipment se LEFT JOIN accessories a ON se.accessory_id = a.id WHERE se.racer_id = $1`,
      [racerId]
    );
    if (equipment && equipment.id != null) {
      accessory = equipment;
    }

    res.json({ cosmetics: validCosmetics, accessory });
  } catch (err) {
    console.error("GET /cosmetics/:racerId error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
