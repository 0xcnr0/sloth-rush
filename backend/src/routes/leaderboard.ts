import { Router, Request, Response } from "express";
import { getOne, getAll } from "../db";

const router = Router();

// GET /api/leaderboard/me/:wallet — Get user's rank
router.get("/me/:wallet", async (req: Request, res: Response) => {
  const { wallet } = req.params;

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
});

// GET /api/leaderboard/career — All-time career stats top 50
router.get("/career", async (_req: Request, res: Response) => {
  const leaderboard = await getAll(
    `SELECT s.wallet, s.name as snail_name, s.rarity, s.tier,
            COALESCE(st.total_wins, 0) as total_wins,
            COALESCE(st.total_races, 0) as total_races,
            COALESCE(SUM(rp.rp), 0) as total_rp
     FROM slugs s
     LEFT JOIN streaks st ON s.id = st.snail_id
     LEFT JOIN race_points rp ON s.id = rp.snail_id
     WHERE s.is_burned = 0 AND s.type = 'snail'
     GROUP BY s.id, s.wallet, s.name, s.rarity, s.tier, st.total_wins, st.total_races
     ORDER BY total_wins DESC, total_races DESC
     LIMIT 50`
  );

  const ranked = leaderboard.map((row: any, i: number) => ({
    rank: i + 1,
    wallet: row.wallet,
    snail_name: row.snail_name,
    rarity: row.rarity,
    tier: row.tier || 0,
    total_wins: parseInt(row.total_wins) || 0,
    total_races: parseInt(row.total_races) || 0,
    total_rp: parseInt(row.total_rp) || 0,
  }));

  res.json({ leaderboard: ranked });
});

// GET /api/leaderboard/hall-of-fame — Hall of fame entries
router.get("/hall-of-fame", async (_req: Request, res: Response) => {
  const entries = await getAll(
    "SELECT * FROM hall_of_fame ORDER BY achieved_at DESC LIMIT 50"
  );

  res.json({ entries });
});

// GET /api/leaderboard/gp/:gpType — GP leaderboard
router.get("/gp/:gpType", async (req: Request, res: Response) => {
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
});

// GET /api/leaderboard/:league — Get top 50 by RP
router.get("/:league", async (req: Request, res: Response) => {
  const { league } = req.params;

  // bronze = players who have free_slug, silver = players who have snail, gold = players with tier >= 2
  let slugTypeFilter: string;
  let extraCondition = "";

  if (league === "bronze") {
    slugTypeFilter = "free_slug";
  } else if (league === "gold") {
    slugTypeFilter = "snail";
    extraCondition = " AND EXISTS (SELECT 1 FROM slugs WHERE wallet = rp.wallet AND type = 'snail' AND tier >= 2 AND is_burned = 0)";
  } else {
    slugTypeFilter = "snail";
  }

  const leaderboard = await getAll(
    `SELECT rp.wallet, s.name as snail_name, s.rarity, SUM(rp.rp) as total_rp
     FROM race_points rp
     JOIN slugs s ON rp.snail_id = s.id
     WHERE rp.season = 1
       AND EXISTS (SELECT 1 FROM slugs WHERE wallet = rp.wallet AND type = $1 AND is_burned = 0)
       ${extraCondition}
     GROUP BY rp.wallet, s.name, s.rarity
     ORDER BY total_rp DESC
     LIMIT 50`,
    [slugTypeFilter]
  );

  const ranked = leaderboard.map((row: any, i: number) => ({
    rank: i + 1,
    wallet: row.wallet,
    snail_name: row.snail_name,
    rarity: row.rarity,
    total_rp: parseInt(row.total_rp),
  }));

  res.json({ leaderboard: ranked });
});

export default router;
