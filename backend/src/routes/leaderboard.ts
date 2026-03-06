import { Router, Request, Response } from "express";
import { getOne, getAll } from "../db";
import { isValidWallet } from "../middleware/validateWallet";

const router = Router();

// GET /api/leaderboard/me/:wallet — Get user's rank
router.get("/me/:wallet", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const row = await getOne(
      `SELECT wallet, SUM(rp) as total_rp
       FROM race_points
       WHERE season = 1
       GROUP BY wallet
       HAVING wallet = $1`,
      [wallet]
    );

    if (!row) {
      res.json(null);
      return;
    }

    // Calculate rank
    const rankRow = await getOne(
      `SELECT COUNT(*) + 1 as rank FROM (
         SELECT wallet, SUM(rp) as total_rp FROM race_points WHERE season = 1 GROUP BY wallet
       ) sub WHERE total_rp > $1`,
      [parseInt(row.total_rp)]
    );

    res.json({ rank: parseInt(rankRow?.rank) || 1, wallet: row.wallet, total_rp: parseInt(row.total_rp) });
  } catch (err) {
    console.error("GET /me/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/leaderboard/career — All-time career stats top 50
router.get("/career", async (_req: Request, res: Response) => {
  try {
    const leaderboard = await getAll(
      `SELECT s.wallet, s.name as sloth_name, s.rarity, s.tier,
              COALESCE(st.total_wins, 0) as total_wins,
              COALESCE(st.total_races, 0) as total_races,
              COALESCE(SUM(rp.rp), 0) as total_rp
       FROM sloths s
       LEFT JOIN streaks st ON s.id = st.sloth_id
       LEFT JOIN race_points rp ON s.id = rp.sloth_id
       WHERE s.is_burned = 0 AND s.type = 'sloth'
       GROUP BY s.id, s.wallet, s.name, s.rarity, s.tier, st.total_wins, st.total_races
       ORDER BY total_wins DESC, total_races DESC
       LIMIT 50`
    );

    const ranked = leaderboard.map((row: any, i: number) => ({
      rank: i + 1,
      wallet: row.wallet,
      sloth_name: row.sloth_name,
      rarity: row.rarity,
      tier: row.tier || 0,
      total_wins: parseInt(row.total_wins) || 0,
      total_races: parseInt(row.total_races) || 0,
      total_rp: parseInt(row.total_rp) || 0,
    }));

    res.json({ leaderboard: ranked });
  } catch (err) {
    console.error("GET /career error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/leaderboard/hall-of-fame — Hall of fame entries
router.get("/hall-of-fame", async (_req: Request, res: Response) => {
  try {
    const entries = await getAll(
      "SELECT * FROM hall_of_fame ORDER BY achieved_at DESC LIMIT 50"
    );

    res.json({ entries });
  } catch (err) {
    console.error("GET /hall-of-fame error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/leaderboard/gp/:gpType — GP leaderboard
router.get("/gp/:gpType", async (req: Request, res: Response) => {
  try {
    const { gpType } = req.params;

    const leaderboard = await getAll(
      `SELECT gp.wallet, SUM(gp.points) as total_points
       FROM gp_points gp
       WHERE gp.gp_type = $1 AND gp.season = 1
       GROUP BY gp.wallet
       ORDER BY total_points DESC
       LIMIT 50`,
      [gpType]
    );

    const ranked = leaderboard.map((row: any, i: number) => ({
      rank: i + 1,
      wallet: row.wallet,
      total_points: parseInt(row.total_points) || 0,
    }));

    res.json({ leaderboard: ranked });
  } catch (err) {
    console.error("GET /gp/:gpType error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/leaderboard/:league — Get top 50 by RP
router.get("/:league", async (req: Request, res: Response) => {
  try {
    const league = req.params.league as string;

    const validLeagues = ['bronze', 'silver', 'gold'];
    if (!validLeagues.includes(league)) {
      res.status(400).json({ error: "Invalid league. Must be: bronze, silver, gold" });
      return;
    }

    // bronze = players who have free_sloth, silver = players who have sloth, gold = players with tier >= 2
    let slothTypeFilter: string;
    let extraCondition = "";

    if (league === "bronze") {
      slothTypeFilter = "free_slug";
    } else if (league === "gold") {
      slothTypeFilter = "sloth";
      extraCondition = " AND EXISTS (SELECT 1 FROM sloths WHERE wallet = rp.wallet AND type = 'sloth' AND tier >= 2 AND is_burned = 0)";
    } else {
      slothTypeFilter = "sloth";
    }

    const leaderboard = await getAll(
      `SELECT rp.wallet, MAX(s.name) as sloth_name, MAX(s.rarity) as rarity, SUM(rp.rp) as total_rp
       FROM race_points rp
       JOIN sloths s ON rp.sloth_id = s.id
       WHERE rp.season = 1
         AND EXISTS (SELECT 1 FROM sloths WHERE wallet = rp.wallet AND type = $1 AND is_burned = 0)
         ${extraCondition}
       GROUP BY rp.wallet
       ORDER BY total_rp DESC
       LIMIT 50`,
      [slothTypeFilter]
    );

    const ranked = leaderboard.map((row: any, i: number) => ({
      rank: i + 1,
      wallet: row.wallet,
      sloth_name: row.sloth_name,
      rarity: row.rarity,
      total_rp: parseInt(row.total_rp),
    }));

    res.json({ leaderboard: ranked });
  } catch (err) {
    console.error("GET /:league error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
