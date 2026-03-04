import { Router, Request, Response } from "express";
import { query, getOne, getAll, runTransaction } from "../db";

const router = Router();

const isProduction = process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT === "production";

// GET /api/season/current — Get active season info
router.get("/current", async (_req: Request, res: Response) => {
  const season = await getOne("SELECT * FROM seasons WHERE is_active = 1 LIMIT 1");
  if (!season) {
    res.json({ season: null });
    return;
  }

  const now = new Date();
  const end = new Date(season.end_date);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));

  res.json({ season: { ...season, daysLeft } });
});

// POST /api/season/end — End the current season and start a new one
router.post("/end", async (req: Request, res: Response) => {
  // Only allow in non-production or with admin key
  const adminKey = req.body.adminKey || req.headers["x-admin-key"];
  if (isProduction && adminKey !== process.env.ADMIN_KEY) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const currentSeason = await getOne("SELECT * FROM seasons WHERE is_active = 1 LIMIT 1");
  if (!currentSeason) {
    res.status(404).json({ error: "no active season" });
    return;
  }

  await runTransaction(async (client) => {
    // End current season
    await client.query(
      "UPDATE seasons SET is_active = 0, end_date = NOW() WHERE id = $1",
      [currentSeason.id]
    );

    // Distribute season rewards if configured
    const rewards = (await client.query(
      "SELECT * FROM season_rewards WHERE season = $1",
      [currentSeason.number]
    )).rows;

    if (rewards.length > 0) {
      // Get rankings per league
      for (const reward of rewards) {
        const rankedPlayers = (await client.query(
          `SELECT wallet, SUM(rp) as total_rp
           FROM race_points
           WHERE season = $1
           GROUP BY wallet
           ORDER BY total_rp DESC`,
          [currentSeason.number]
        )).rows;

        for (let i = 0; i < rankedPlayers.length; i++) {
          const rank = i + 1;
          if (rank >= reward.rank_min && rank <= reward.rank_max) {
            const player = rankedPlayers[i];
            if (reward.slug_reward > 0) {
              await client.query(
                `INSERT INTO coin_balances (wallet, balance) VALUES ($1, $2)
                 ON CONFLICT(wallet) DO UPDATE SET balance = coin_balances.balance + $3, updated_at = NOW()`,
                [player.wallet, reward.slug_reward, reward.slug_reward]
              );
              await client.query(
                "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'season_reward', $2, $3)",
                [player.wallet, reward.slug_reward, `Season ${currentSeason.number} rank ${rank} reward`]
              );
            }
            if (reward.cosmetic_id) {
              await client.query(
                "INSERT INTO user_cosmetics (wallet, cosmetic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                [player.wallet, reward.cosmetic_id]
              );
            }
          }
        }
      }
    }

    // Create next season
    const nextNumber = currentSeason.number + 1;
    await client.query(
      "INSERT INTO seasons (number, start_date, end_date, is_active) VALUES ($1, NOW(), NOW() + interval '4 weeks', 1)",
      [nextNumber]
    );
  });

  const newSeason = await getOne("SELECT * FROM seasons WHERE is_active = 1 LIMIT 1");

  res.json({
    ended: true,
    previousSeason: currentSeason.number,
    newSeason: newSeason,
  });
});

// GET /api/season/rewards/:season — Get rewards for a past season
router.get("/rewards/:season", async (req: Request, res: Response) => {
  const seasonNum = parseInt(req.params.season as string);

  const rewards = await getAll(
    "SELECT sr.*, c.name as cosmetic_name FROM season_rewards sr LEFT JOIN cosmetics c ON sr.cosmetic_id = c.id WHERE sr.season = $1 ORDER BY sr.rank_min ASC",
    [seasonNum]
  );

  // Get top players from that season
  const topPlayers = await getAll(
    `SELECT wallet, SUM(rp) as total_rp
     FROM race_points
     WHERE season = $1
     GROUP BY wallet
     ORDER BY total_rp DESC
     LIMIT 20`,
    [seasonNum]
  );

  res.json({
    season: seasonNum,
    rewards,
    topPlayers: topPlayers.map((p: any, i: number) => ({
      rank: i + 1,
      wallet: p.wallet,
      total_rp: parseInt(p.total_rp) || 0,
    })),
  });
});

export default router;
