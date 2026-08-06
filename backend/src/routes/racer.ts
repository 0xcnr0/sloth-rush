import { Router, Request, Response } from "express";
import { query, getOne, getAll, runTransaction } from "../db";
import { awardXP, getXP, XP_AMOUNTS } from "../xp";
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

    res.json({ racers });
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
      "SELECT 0 AS balance",
      []
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

    // The daily login bonus is gone, so the free upgrade path can no longer ask
    // for login days — it would be a requirement with nothing that satisfies it.
    const requirements = { xp: 1500, races: 30, wins: 10 };
    const eligible = xp >= requirements.xp &&
      totalRaces >= requirements.races &&
      totalWins >= requirements.wins;

    res.json({
      xp,
      races: totalRaces,
      wins: totalWins,
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

    if (xp < 1500 || totalRaces < 30 || totalWins < 10) {
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

    res.json({
      wallet,
      xp: parseInt(String(xp)) || 0,
      totalRaces: parseInt(String(raceStats?.total_races)) || 0,
      totalWins: parseInt(String(raceStats?.total_wins)) || 0,
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
      "SELECT NULL AS type, 0 AS amount, NULL AS description, NOW() AS created_at WHERE false",
      [wallet]
    );
    res.json({ transactions: txns });
  } catch (err) {
    console.error("GET /profile/transactions/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
