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

// GET /api/leaderboard/:league — Get top 50 by RP
router.get("/:league", async (req: Request, res: Response) => {
  const { league } = req.params;

  // bronze = players who have free_slug, silver = players who have snail
  const slugType = league === "bronze" ? "free_slug" : "snail";

  const leaderboard = await getAll(
    `SELECT rp.wallet, s.name as snail_name, s.rarity, SUM(rp.rp) as total_rp
     FROM race_points rp
     JOIN slugs s ON rp.snail_id = s.id
     WHERE rp.season = 1
       AND EXISTS (SELECT 1 FROM slugs WHERE wallet = rp.wallet AND type = $1 AND is_burned = 0)
     GROUP BY rp.wallet, s.name, s.rarity
     ORDER BY total_rp DESC
     LIMIT 50`,
    [slugType]
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
