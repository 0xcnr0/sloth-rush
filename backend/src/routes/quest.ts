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

// GET /api/quests/weekly/:wallet — Get weekly quests with progress
router.get("/weekly/:wallet", async (req: Request, res: Response) => {
  const { wallet } = req.params;

  // Weekly reset: Monday of current week (ISO week)
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0 offset
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  const resetDate = monday.toISOString().split("T")[0];

  const quests = await getAll("SELECT * FROM quests WHERE period = 'weekly'");

  const result = [];
  for (const quest of quests) {
    await query(
      `INSERT INTO user_quest_progress (wallet, quest_id, progress, completed, reset_date)
       VALUES ($1, $2, 0, 0, $3) ON CONFLICT DO NOTHING`,
      [wallet, quest.id, resetDate]
    );

    const progress = await getOne(
      "SELECT * FROM user_quest_progress WHERE wallet = $1 AND quest_id = $2 AND reset_date = $3",
      [wallet, quest.id, resetDate]
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

// GET /api/quests/milestones/:wallet — Get milestone quests (never reset)
router.get("/milestones/:wallet", async (req: Request, res: Response) => {
  const { wallet } = req.params;
  const resetDate = "milestone"; // Never resets

  const quests = await getAll("SELECT * FROM quests WHERE period = 'milestone'");

  // Compute milestone progress from actual data
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

  const maxStreakRow = await getOne(
    "SELECT COALESCE(MAX(max_wins), 0) as max_streak FROM streaks s JOIN slugs sl ON s.snail_id = sl.id WHERE sl.wallet = $1",
    [wallet]
  );
  const maxStreak = parseInt(maxStreakRow?.max_streak) || 0;

  const trainingCountRow = await getOne(
    "SELECT COUNT(*) as count FROM trainings WHERE wallet = $1 AND claimed = 1",
    [wallet]
  );
  const trainingCount = parseInt(trainingCountRow?.count) || 0;

  const result = [];
  for (const quest of quests) {
    await query(
      `INSERT INTO user_quest_progress (wallet, quest_id, progress, completed, reset_date)
       VALUES ($1, $2, 0, 0, $3) ON CONFLICT DO NOTHING`,
      [wallet, quest.id, resetDate]
    );

    // Compute progress based on requirement_type
    let computedProgress = 0;
    switch (quest.requirement_type) {
      case "race_complete":
      case "milestone_races":
        computedProgress = totalRaces;
        break;
      case "milestone_wins":
        computedProgress = totalWins;
        break;
      case "milestone_streak":
        computedProgress = maxStreak;
        break;
      case "training_complete":
        computedProgress = trainingCount;
        break;
    }

    const isComplete = computedProgress >= quest.requirement_value;

    // Update stored progress
    await query(
      `UPDATE user_quest_progress SET progress = $1, completed = $2, completed_at = $3
       WHERE wallet = $4 AND quest_id = $5 AND reset_date = $6 AND completed = 0`,
      [computedProgress, isComplete ? 1 : 0, isComplete ? new Date().toISOString() : null, wallet, quest.id, resetDate]
    );

    // Award rewards if just completed
    const progress = await getOne(
      "SELECT * FROM user_quest_progress WHERE wallet = $1 AND quest_id = $2 AND reset_date = $3",
      [wallet, quest.id, resetDate]
    );

    result.push({
      id: quest.id,
      title: quest.title,
      description: quest.description,
      requirement_type: quest.requirement_type,
      requirement_value: quest.requirement_value,
      slug_reward: quest.slug_reward,
      xp_reward: quest.xp_reward,
      progress: computedProgress,
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
