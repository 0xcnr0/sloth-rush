import { Router, Request, Response } from "express";
import { query, getOne, getAll } from "../db";
import { triggerQuestProgress } from "./race";

const router = Router();

// GET /api/quests/daily/:wallet — Get daily quests with progress
router.get("/daily/:wallet", async (req: Request, res: Response) => {
  const { wallet } = req.params;
  const today = new Date().toISOString().split("T")[0];

  const quests = await getAll("SELECT * FROM quests WHERE type = 'daily'");

  const result = [];
  for (const quest of quests) {
    // Get or create today's progress
    await query(
      `INSERT INTO user_quest_progress (wallet, quest_id, progress, completed, reset_date)
       VALUES ($1, $2, 0, 0, $3) ON CONFLICT DO NOTHING`,
      [wallet, quest.id, today]
    );

    const progress = await getOne(
      "SELECT * FROM user_quest_progress WHERE wallet = $1 AND quest_id = $2 AND reset_date = $3",
      [wallet, quest.id, today]
    );

    result.push({
      id: quest.id,
      title: quest.title,
      description: quest.description,
      requirement_type: quest.requirement_type,
      requirement_value: quest.requirement_value,
      slug_reward: quest.slug_reward,
      xp_reward: quest.xp_reward,
      progress: progress?.progress || 0,
      completed: progress?.completed === 1,
    });
  }

  res.json({ quests: result });
});

// POST /api/quests/progress — Manually trigger quest progress (e.g. stable_visit)
router.post("/progress", async (req: Request, res: Response) => {
  const { wallet, requirementType } = req.body;

  if (!wallet || !requirementType) {
    res.status(400).json({ error: "wallet and requirementType required" });
    return;
  }

  await triggerQuestProgress(wallet, requirementType);
  res.json({ updated: true });
});

export default router;
