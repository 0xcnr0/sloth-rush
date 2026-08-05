import { Router, Request, Response } from "express";
import crypto from "crypto";
import { query, getOne, getAll, runTransaction } from "../db";
import { simulateRace, calculatePrizePool, RacerStats, TacticAction, createGDAState, getGDAPrice, applyGDAPurchase, GDAState } from "../simulation/engine";
import {
  WIND_UP_TUNING,
  botSigmaForSkill,
  botTension,
  boundHold,
  orderGrid,
  overwindDrainMultiplier,
  resolveWind,
  safeWindDisplayBand,
  safeWindThreshold,
} from "../simulation/windUp";
import { awardXP, XP_AMOUNTS } from "../xp";
import { isValidWallet } from "../middleware/validateWallet";
import { recordRaceResultOnchain } from "../lib/onchain";

const router = Router();

const VALID_STATS = ['spd', 'acc', 'sta', 'agi', 'ref', 'lck'] as const;
type StatName = typeof VALID_STATS[number];

function assertValidStat(stat: string): asserts stat is StatName {
  if (!(VALID_STATS as readonly string[]).includes(stat)) {
    throw new Error(`Invalid stat: ${stat}`);
  }
}

// Get the reset date for a quest based on its period
function getResetDate(period: string): string {
  if (period === "weekly") {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    return monday.toISOString().split("T")[0];
  }
  if (period === "milestone") {
    return "milestone";
  }
  // daily
  return new Date().toISOString().split("T")[0];
}

// Quest progress trigger — used after race simulate
export async function triggerQuestProgress(wallet: string, requirementType: string): Promise<void> {
  const quests = await getAll(
    "SELECT * FROM quests WHERE requirement_type = $1",
    [requirementType]
  );

  for (const quest of quests) {
    // Skip milestones — they are computed on read
    if (quest.period === "milestone") continue;

    const resetDate = getResetDate(quest.period || "daily");

    // Ensure progress row exists
    await query(
      `INSERT INTO user_quest_progress (wallet, quest_id, progress, completed, reset_date)
       VALUES ($1, $2, 0, 0, $3) ON CONFLICT DO NOTHING`,
      [wallet, quest.id, resetDate]
    );

    // Get current progress
    const progress = await getOne(
      "SELECT * FROM user_quest_progress WHERE wallet = $1 AND quest_id = $2 AND reset_date = $3",
      [wallet, quest.id, resetDate]
    );

    if (progress && !progress.completed) {
      const newProgress = progress.progress + 1;
      const isComplete = newProgress >= quest.requirement_value;

      await query(
        `UPDATE user_quest_progress SET progress = $1, completed = $2, completed_at = $3
         WHERE wallet = $4 AND quest_id = $5 AND reset_date = $6`,
        [newProgress, isComplete ? 1 : 0, isComplete ? new Date().toISOString() : null, wallet, quest.id, resetDate]
      );

      // Award rewards on completion
      if (isComplete) {
        if (quest.coin_reward > 0) {
          await query(
            `INSERT INTO coin_balances (wallet, balance) VALUES ($1, $2)
             ON CONFLICT(wallet) DO UPDATE SET balance = coin_balances.balance + $3, updated_at = NOW()`,
            [wallet, quest.coin_reward, quest.coin_reward]
          );
          await query(
            "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'quest_reward', $2, $3)",
            [wallet, quest.coin_reward, `Quest: ${quest.title}`]
          );
        }
        if (quest.xp_reward > 0) {
          await awardXP(wallet, quest.xp_reward);
        }
      }
    }
  }
}

// Stat caps by rarity (and type)
const STAT_CAPS: Record<string, number> = {
  free: 15,
  common: 22,
  uncommon: 25,
  rare: 28,
  epic: 31,
  legendary: 35,
};

// Position-based stat rewards for organic growth
const POSITION_STAT: Record<number, string> = {
  1: 'spd',
  2: 'acc',
  3: 'sta',
  4: 'ref',
};

// Bot templates with diverse stat distributions (total ~60 each).
// Names are archetype + slot number so nothing here is theme-bound; the
// frontend renders the archetype's display label from the theme config.
// `skill` drives how tightly the bot winds to its own Safe Wind: 1 rides the
// line, 0 misses wide and sometimes snaps. Mixing them gives the player a
// readable signal about who they are up against (WIND_UP_PHASE.md §7).
const BOT_TEMPLATES = [
  { name: "Speedster-01",  race: "speedster", spd: 14, acc: 8,  sta: 10, agi: 10, ref: 10, lck: 8,  skill: 0.8 },
  { name: "Tank-02",       race: "tank",      spd: 8,  acc: 14, sta: 12, agi: 8,  ref: 10, lck: 8,  skill: 0.6 },
  { name: "Trickster-03",  race: "trickster", spd: 10, acc: 10, sta: 14, agi: 8,  ref: 10, lck: 8,  skill: 0.4 },
  { name: "Burst-04",      race: "burst",     spd: 10, acc: 10, sta: 8,  agi: 14, ref: 10, lck: 8,  skill: 0.2 },
  { name: "Tank-05",       race: "tank",      spd: 10, acc: 10, sta: 8,  agi: 8,  ref: 14, lck: 10, skill: 0.7 },
  { name: "Trickster-06",  race: "trickster", spd: 10, acc: 10, sta: 8,  agi: 8,  ref: 8,  lck: 16, skill: 0.3 },
  { name: "Speedster-07",  race: "speedster", spd: 12, acc: 12, sta: 10, agi: 10, ref: 8,  lck: 8,  skill: 0.9 },
  { name: "Burst-08",      race: "burst",     spd: 10, acc: 10, sta: 12, agi: 10, ref: 10, lck: 8,  skill: 0.5 },
];

function generateRaceId(): string {
  return `race_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function generateSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

// POST /api/race/create — Create a new race
router.post("/create", async (req: Request, res: Response) => {
  try {
    const { format = "standard" } = req.body;

    const fees: Record<string, { entry: number; maxTune: number }> = {
      exhibition: { entry: 0, maxTune: 0 },
      standard: { entry: 50, maxTune: 100 },
      grand_prix: { entry: 150, maxTune: 300 },
      tactic: { entry: 75, maxTune: 150 },
    };

    const raceConfig = fees[format] || fees.standard;
    const raceId = generateRaceId();

    await query(
      "INSERT INTO races (id, format, entry_fee, max_tune) VALUES ($1, $2, $3, $4)",
      [raceId, format, raceConfig.entry, raceConfig.maxTune]
    );

    res.status(201).json({
      raceId,
      format,
      entryFee: raceConfig.entry,
      maxTune: raceConfig.maxTune,
      status: "lobby",
    });
  } catch (err) {
    console.error("POST /create error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/race/join — Join a race with a racer
router.post("/join", async (req: Request, res: Response) => {
  try {
    const { raceId, racerId, wallet } = req.body;

    if (!raceId || !racerId || !wallet) {
      res.status(400).json({ error: "raceId, racerId, and wallet required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const parsedRacerId = parseInt(racerId);
    if (isNaN(parsedRacerId) || parsedRacerId <= 0) {
      res.status(400).json({ error: "Invalid racerId" });
      return;
    }

    const race = await getOne("SELECT * FROM races WHERE id = $1", [raceId]);
    if (!race) {
      res.status(404).json({ error: "race not found" });
      return;
    }
    if (race.status !== "lobby") {
      res.status(400).json({ error: "race is not in lobby" });
      return;
    }

    // Verify creature ownership (racer or free)
    const racer = await getOne(
      "SELECT * FROM racers WHERE id = $1 AND wallet = $2 AND is_burned = 0 AND type IN ('pro', 'free')",
      [parsedRacerId, wallet]
    );

    if (!racer) {
      res.status(404).json({ error: "creature not found or not owned by wallet" });
      return;
    }

    // Free racers can only join exhibition races
    if (racer.type === "free" && race.format !== "exhibition") {
      res.status(400).json({ error: "Free Racers can only join Exhibition races. Upgrade to a Racer for other formats!" });
      return;
    }

    // GP tier gate: free racers blocked, Gold GP requires tier >= 2
    if (race.format === "gp_qualify") {
      if (racer.type === "free") {
        res.status(400).json({ error: "GP requires at least a Racer" });
        return;
      }
      if (race.entry_fee > 150 && (racer.tier || 0) < 2) {
        res.status(400).json({ error: "Gold GP requires Elite racer (Tier 2+)" });
        return;
      }
    }

    // Training lock: racer in active (unclaimed) training cannot race
    const activeTraining = await getOne(
      "SELECT id FROM trainings WHERE racer_id = $1 AND claimed = 0",
      [parsedRacerId]
    );
    if (activeTraining) {
      res.status(400).json({ error: "This creature is in training and cannot race!" });
      return;
    }

    // Daily free race check: 1 free Standard Race per wallet per day
    const today = new Date().toISOString().slice(0, 10);
    let isUsingFreeRace = false;

    if (race.format === "standard" && race.entry_fee > 0) {
      const dailyUsed = await getOne(
        "SELECT 1 FROM daily_free_races WHERE wallet = $1 AND race_date = $2",
        [wallet, today]
      );

      if (!dailyUsed) {
        isUsingFreeRace = true;
      }
    }

    const effectiveFee = isUsingFreeRace ? 0 : race.entry_fee;

    // Check if already joined
    const existing = await getOne(
      "SELECT id FROM race_participants WHERE race_id = $1 AND wallet = $2",
      [raceId, wallet]
    );

    if (existing) {
      res.status(409).json({ error: "already joined this race" });
      return;
    }

    // Count current participants
    const participantCount = await getOne(
      "SELECT COUNT(*) as count FROM race_participants WHERE race_id = $1",
      [raceId]
    );

    if (parseInt(participantCount.count) >= 4) {
      res.status(400).json({ error: "race is full" });
      return;
    }

    // Join race with balance check inside transaction
    try {
      await runTransaction(async (client) => {
        // Balance check with row lock
        if (effectiveFee > 0) {
          const balanceRow = (await client.query(
            "SELECT balance FROM coin_balances WHERE wallet = $1 FOR UPDATE",
            [wallet]
          )).rows[0];
          const currentBalance = balanceRow?.balance || 0;
          if (currentBalance < effectiveFee) {
            throw new Error("INSUFFICIENT_BALANCE");
          }
          await client.query(
            "UPDATE coin_balances SET balance = balance - $1, updated_at = NOW() WHERE wallet = $2",
            [effectiveFee, wallet]
          );
          await client.query(
            "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'race_entry', $2, $3)",
            [wallet, -effectiveFee, `Entry fee for ${raceId}`]
          );
        }

        // Record daily free race usage
        if (isUsingFreeRace) {
          await client.query(
            "INSERT INTO daily_free_races (wallet, race_date) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [wallet, today]
          );
        }

        // Add participant
        await client.query(
          "INSERT INTO race_participants (race_id, racer_id, wallet, is_bot) VALUES ($1, $2, $3, 0)",
          [raceId, parsedRacerId, wallet]
        );
      });
    } catch (err: any) {
      if (err.message === "INSUFFICIENT_BALANCE") {
        res.status(400).json({ error: "insufficient balance" });
        return;
      }
      throw err;
    }

    const newBalance = await getOne("SELECT balance FROM coin_balances WHERE wallet = $1", [wallet]);

    res.json({
      joined: true,
      raceId,
      racerId: parsedRacerId,
      entryFeeCharged: effectiveFee,
      dailyFreeRace: isUsingFreeRace,
      newBalance: newBalance?.balance || 0,
    });
  } catch (err) {
    console.error("POST /join error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/race/start-tuning — Close the lobby, fill with bots, and open the
// Wind-Up window. See docs/WIND_UP_PHASE.md.
//
// The race seed is generated HERE rather than at simulate time, because each
// racer's Safe Wind threshold is jittered from it (§9). The threshold has to
// exist before anyone can wind, and the simulation later reuses the same seed
// so the whole race — grid and result — verifies from one value.
router.post("/start-tuning", async (req: Request, res: Response) => {
  try {
    const { raceId } = req.body;

    const race = await getOne("SELECT * FROM races WHERE id = $1", [raceId]);
    if (!race || race.status !== "lobby") {
      res.status(400).json({ error: "race not found or not in lobby" });
      return;
    }

    const participants = await getAll(
      "SELECT * FROM race_participants WHERE race_id = $1",
      [raceId]
    );

    // Fill remaining slots with bots (4 for all races including GP qualifying)
    const maxSlots = 4;
    const botsNeeded = maxSlots - participants.length;
    const botSkills: Record<number, number> = {};
    if (botsNeeded > 0) {
      // Shuffle templates for variety
      const shuffled = [...BOT_TEMPLATES].sort(() => Math.random() - 0.5);
      for (let i = 0; i < botsNeeded; i++) {
        const template = shuffled[i % shuffled.length];
        // Create a bot racer with diverse stats
        const botRacer = await getOne(
          `INSERT INTO racers (wallet, type, name, rarity, race, spd, acc, sta, agi, ref, lck)
           VALUES ($1, 'pro', $2, 'common', $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [`bot_${i}`, template.name, template.race, template.spd, template.acc, template.sta, template.agi, template.ref, template.lck]
        );

        botSkills[botRacer.id] = template.skill;

        await query(
          "INSERT INTO race_participants (race_id, racer_id, wallet, is_bot) VALUES ($1, $2, $3, 1)",
          [raceId, botRacer.id, `bot_${i}`]
        );
      }
    }

    const seed = race.seed || generateSeed();

    await query(
      "UPDATE races SET status = 'tuning', seed = $1, tuning_opened_at = NOW() WHERE id = $2",
      [seed, raceId]
    );

    // Bots wind immediately — they have no window to wait through. Their
    // tension is sampled from the race seed, so it is fixed the moment the
    // window opens and cannot drift with when the finalizer happens to run.
    const botRows = await getAll(
      `SELECT rp.racer_id, r.sta
       FROM race_participants rp JOIN racers r ON rp.racer_id = r.id
       WHERE rp.race_id = $1 AND rp.is_bot = 1`,
      [raceId]
    );
    for (const bot of botRows) {
      const safeWind = safeWindThreshold(Number(bot.sta) || 10, seed, bot.racer_id);
      const sigma = botSigmaForSkill(botSkills[bot.racer_id] ?? 0.5);
      const tension = botTension(safeWind, sigma, seed, bot.racer_id);
      // A bot at the clamp ceiling has effectively overwound to breaking point.
      const snapped = tension >= WIND_UP_TUNING.botMaxTension;
      await query(
        `UPDATE race_participants
         SET wind_tension = $1, wind_snapped = $2, wind_locked = 1
         WHERE race_id = $3 AND racer_id = $4`,
        [tension, snapped ? 1 : 0, raceId, bot.racer_id]
      );
    }

    res.json({
      raceId,
      status: "tuning",
      botsAdded: botsNeeded,
      phaseDurationMs: WIND_UP_TUNING.phaseDurationMs,
      fullWindMs: WIND_UP_TUNING.fullWindMs,
      opensAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("POST /start-tuning error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

type WindContext =
  | { ok: false; error: string; status: number }
  | { ok: true; race: any; participant: any };

/** Loads a race plus the caller's participant row, or explains why not. */
async function loadWindContext(raceId: string, wallet: string): Promise<WindContext> {
  const race = await getOne("SELECT * FROM races WHERE id = $1", [raceId]);
  if (!race) return { ok: false, error: "race not found", status: 404 };
  if (race.status !== "tuning") {
    return { ok: false, error: "race is not in the wind-up phase", status: 400 };
  }
  const participant = await getOne(
    "SELECT * FROM race_participants WHERE race_id = $1 AND wallet = $2",
    [raceId, wallet]
  );
  if (!participant) return { ok: false, error: "not a participant in this race", status: 403 };
  return { ok: true, race, participant };
}

/** Milliseconds the wind-up window has been open. */
function windowElapsedMs(race: any): number {
  if (!race.tuning_opened_at) return 0;
  return Date.now() - new Date(race.tuning_opened_at).getTime();
}

// POST /api/race/wind/start — The player pressed and began winding.
//
// The server timestamps the press itself. The client never sends a tension or a
// duration: an input mechanic scored from client-reported numbers is trivially
// forged, so the hold is measured entirely between this call and the release
// (§9). Network latency makes it slightly imprecise, never exploitable.
router.post("/wind/start", async (req: Request, res: Response) => {
  try {
    const { raceId, wallet } = req.body;
    if (!raceId || !wallet) {
      res.status(400).json({ error: "raceId and wallet required" });
      return;
    }
    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const ctx = await loadWindContext(raceId, wallet);
    if (!ctx.ok) {
      res.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { race, participant } = ctx;

    if (participant.wind_locked) {
      res.status(409).json({ error: "already locked in for this race" });
      return;
    }
    if (windowElapsedMs(race) > WIND_UP_TUNING.phaseDurationMs) {
      res.status(400).json({ error: "the wind-up window has closed" });
      return;
    }
    // Re-pressing without releasing would otherwise restart the hold and hand
    // out free tension; the first press is the one that counts.
    if (participant.wind_pressed_at) {
      res.json({ raceId, alreadyWinding: true });
      return;
    }

    await query(
      "UPDATE race_participants SET wind_pressed_at = NOW() WHERE id = $1",
      [participant.id]
    );

    const racer = await getOne("SELECT sta FROM racers WHERE id = $1", [participant.racer_id]);
    res.json({
      raceId,
      winding: true,
      // The player sees an approximate band, never the exact line (§9).
      safeWindBand: safeWindDisplayBand(Number(racer?.sta) || 10),
      fullWindMs: WIND_UP_TUNING.fullWindMs,
      windowRemainingMs: Math.max(0, WIND_UP_TUNING.phaseDurationMs - windowElapsedMs(race)),
    });
  } catch (err) {
    console.error("POST /wind/start error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/race/wind/release — The player let go. The client reports how long
// it held; the server bounds that by the window it observed and locks it in.
router.post("/wind/release", async (req: Request, res: Response) => {
  try {
    const { raceId, wallet } = req.body;
    if (!raceId || !wallet) {
      res.status(400).json({ error: "raceId and wallet required" });
      return;
    }
    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const ctx = await loadWindContext(raceId, wallet);
    if (!ctx.ok) {
      res.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const { race, participant } = ctx;

    if (participant.wind_locked) {
      res.status(409).json({ error: "already locked in for this race" });
      return;
    }
    if (!participant.wind_pressed_at) {
      res.status(400).json({ error: "not winding — press before releasing" });
      return;
    }

    // The client sends how long it held (a duration from performance.now(), not a
    // timestamp — monotonic, no clock sync, immune to the user's system clock).
    // The server bounds it by the window it observed between press and release.
    //
    // Stamping both ends server-side instead would close forgery but tax latency:
    // a player on a slow connection would lose tension they actually earned, in a
    // mechanic sold as purely skill-based. Bounding keeps the honest player whole
    // while making invented time impossible. Claiming LESS than you held stays
    // possible; what defends against that is the Safe Wind threshold being
    // jittered per race and shown only approximately. See docs/WIND_UP_PHASE.md §9.
    const observedMs = Date.now() - new Date(participant.wind_pressed_at).getTime();
    const holdMs = boundHold(Number(req.body?.heldMs), observedMs);

    const racer = await getOne("SELECT sta FROM racers WHERE id = $1", [participant.racer_id]);
    const safeWind = safeWindThreshold(Number(racer?.sta) || 10, race.seed, participant.racer_id);
    const outcome = resolveWind(holdMs, safeWind);

    await query(
      `UPDATE race_participants
       SET wind_tension = $1, wind_snapped = $2, wind_locked = 1
       WHERE id = $3`,
      [outcome.tension, outcome.snapped ? 1 : 0, participant.id]
    );

    res.json({
      raceId,
      tension: outcome.tension,
      band: outcome.band,
      snapped: outcome.snapped,
      holdMs,
      locked: true,
    });
  } catch (err) {
    console.error("POST /wind/release error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Resolve everyone who has not locked in, order the grid and move the race to
 * 'racing'. Idempotent: a race already past 'tuning' is left alone.
 *
 * Called explicitly by the client when the countdown ends, and defensively by
 * /simulate so a race can never reach the starting line with an unresolved grid.
 */
async function finalizeWindUp(raceId: string): Promise<void> {
  const race = await getOne("SELECT * FROM races WHERE id = $1", [raceId]);
  if (!race || race.status !== "tuning") return;

  const seed: string = race.seed || generateSeed();
  if (!race.seed) {
    await query("UPDATE races SET seed = $1 WHERE id = $2", [seed, raceId]);
  }

  const participants = await getAll(
    `SELECT rp.*, r.sta
     FROM race_participants rp JOIN racers r ON rp.racer_id = r.id
     WHERE rp.race_id = $1`,
    [raceId]
  );

  for (const p of participants) {
    if (p.wind_locked) continue;

    // Someone who pressed and never released is treated as holding until the
    // window shut. Someone who never touched the screen gets zero tension and
    // no penalty — declining to wind is a weak but legitimate play (§4).
    let holdMs = 0;
    if (p.wind_pressed_at) {
      const pressedAt = new Date(p.wind_pressed_at).getTime();
      const windowClosesAt = race.tuning_opened_at
        ? new Date(race.tuning_opened_at).getTime() + WIND_UP_TUNING.phaseDurationMs
        : Date.now();
      holdMs = Math.max(0, Math.min(Date.now(), windowClosesAt) - pressedAt);
    }

    const safeWind = safeWindThreshold(Number(p.sta) || 10, seed, p.racer_id);
    const outcome = resolveWind(holdMs, safeWind);
    await query(
      `UPDATE race_participants
       SET wind_tension = $1, wind_snapped = $2, wind_locked = 1
       WHERE id = $3`,
      [outcome.tension, outcome.snapped ? 1 : 0, p.id]
    );
    p.wind_tension = outcome.tension;
    p.wind_snapped = outcome.snapped ? 1 : 0;
  }

  // Highest tension takes pole; snapped springs go to the back; ties break on
  // the seed so the order is reproducible rather than dependent on row order.
  const ordered = orderGrid(
    participants.map((p: any) => ({
      racerId: p.racer_id,
      tension: p.wind_tension || 0,
      snapped: p.wind_snapped === 1,
      rowId: p.id,
    })),
    seed
  );

  for (let i = 0; i < ordered.length; i++) {
    await query("UPDATE race_participants SET grid_position = $1 WHERE id = $2", [
      i + 1,
      ordered[i].rowId,
    ]);
  }

  await query("UPDATE races SET status = 'racing' WHERE id = $1", [raceId]);
}

// POST /api/race/close-tuning — Shut the window and reveal the grid.
router.post("/close-tuning", async (req: Request, res: Response) => {
  try {
    const { raceId } = req.body;
    if (!raceId) {
      res.status(400).json({ error: "raceId required" });
      return;
    }

    const race = await getOne("SELECT * FROM races WHERE id = $1", [raceId]);
    if (!race) {
      res.status(404).json({ error: "race not found" });
      return;
    }

    await finalizeWindUp(raceId);

    // The reveal: all four tensions become visible at once, never before.
    const grid = await getAll(
      `SELECT rp.racer_id, rp.grid_position, rp.wind_tension, rp.wind_snapped,
              rp.is_bot, rp.wallet, r.name
       FROM race_participants rp JOIN racers r ON rp.racer_id = r.id
       WHERE rp.race_id = $1
       ORDER BY rp.grid_position ASC`,
      [raceId]
    );

    res.json({
      raceId,
      status: "racing",
      grid: grid.map((g: any) => ({
        racerId: g.racer_id,
        name: g.name,
        wallet: g.wallet,
        isBot: g.is_bot === 1,
        position: g.grid_position,
        tension: g.wind_tension,
        snapped: g.wind_snapped === 1,
      })),
    });
  } catch (err) {
    console.error("POST /close-tuning error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/race/simulate — Run the race simulation
router.post("/simulate", async (req: Request, res: Response) => {
  try {
    const { raceId } = req.body;

    const raceBefore = await getOne("SELECT * FROM races WHERE id = $1", [raceId]);
    if (!raceBefore) {
      res.status(404).json({ error: "race not found" });
      return;
    }

    // A race must never reach the starting line with an unresolved grid. If the
    // client never called close-tuning (or crashed mid-phase), resolve it here.
    await finalizeWindUp(raceId);
    const race = await getOne("SELECT * FROM races WHERE id = $1", [raceId]);

    // Grid order was decided by the Wind-Up phase; read it back rather than
    // re-deriving it, so the reveal the player saw is the grid that races.
    const participants = await getAll(
      `SELECT rp.*, s.name, s.spd, s.acc, s.sta, s.agi, s.ref, s.lck, s.passive, s.tier
       FROM race_participants rp
       JOIN racers s ON rp.racer_id = s.id
       WHERE rp.race_id = $1
       ORDER BY COALESCE(rp.grid_position, 99) ASC, rp.id ASC`,
      [raceId]
    );

    // Load accessory bonuses for each participant
    const accessoryBonuses: Record<number, Record<string, number>> = {};
    for (const p of participants) {
      const equipment = await getOne(
        "SELECT a.stat_bonus FROM racer_equipment se JOIN accessories a ON se.accessory_id = a.id WHERE se.racer_id = $1",
        [p.racer_id]
      );
      if (equipment && equipment.stat_bonus) {
        let bonus: Record<string, number> = {};
        try {
          bonus = typeof equipment.stat_bonus === 'string'
            ? JSON.parse(equipment.stat_bonus)
            : equipment.stat_bonus || {};
        } catch (e) {
          console.error("Invalid stat_bonus JSON for equipment:", equipment.id, e);
          bonus = {};
        }
        accessoryBonuses[p.racer_id] = bonus;
      }
    }

    // Grid positions are already persisted by the Wind-Up finalizer; backfill
    // only if something upstream left them null.
    for (let index = 0; index < participants.length; index++) {
      const p = participants[index];
      if (p.grid_position == null) {
        await query("UPDATE race_participants SET grid_position = $1 WHERE id = $2", [index + 1, p.id]);
      }
    }

    const gridded: RacerStats[] = participants.map((p: any, index: number) => {
      const bonus = accessoryBonuses[p.racer_id] || {};
      // Recompute the wind-up consequences from the locked tension and the
      // race seed. Nothing is trusted from the client and nothing extra is
      // stored: the same seed always reproduces the same penalties.
      const safeWind = safeWindThreshold(Number(p.sta) || 10, race.seed || "", p.racer_id);
      const snapped = p.wind_snapped === 1;
      const staminaDrainMultiplier = overwindDrainMultiplier(p.wind_tension || 0, safeWind);
      return {
        id: p.racer_id,
        name: p.name,
        wallet: p.wallet,
        isBot: p.is_bot === 1,
        spd: p.spd + (bonus.spd || 0),
        acc: p.acc + (bonus.acc || 0),
        sta: p.sta + (bonus.sta || 0),
        agi: p.agi + (bonus.agi || 0),
        ref: p.ref + (bonus.ref || 0),
        lck: p.lck + (bonus.lck || 0),
        gridPosition: p.grid_position ?? index + 1,
        passive: p.passive || undefined,
        windTension: p.wind_tension || 0,
        staminaDrainMultiplier,
        startStaminaFactor: snapped ? WIND_UP_TUNING.snapStaminaFactor : 1,
      };
    });

    // Load tactic actions if any
    const tacticRows = await getAll(
      "SELECT * FROM tactic_actions WHERE race_id = $1",
      [raceId]
    );
    const tacticActions: TacticAction[] = tacticRows.map((r: any) => ({
      tick: r.tick,
      type: r.action_type as "boost" | "projectile",
      racerId: r.racer_id,
    }));

    // Generate bot tactic actions for tactic/gp_final modes
    if (race.format === "tactic" || race.format === "gp_final") {
      const botEntries = participants.filter((p: any) => p.is_bot === 1);
      for (const bot of botEntries) {
        if (Math.random() < 0.6) {
          const actionType = Math.random() > 0.5 ? "boost" : "projectile";
          const actionTick = Math.floor(50 + Math.random() * 200);
          const existingAction = await getOne(
            "SELECT 1 FROM tactic_actions WHERE race_id = $1 AND racer_id = $2 AND action_type = $3",
            [raceId, bot.racer_id, actionType]
          );
          if (!existingAction) {
            await query(
              "INSERT INTO tactic_actions (race_id, racer_id, wallet, action_type, tick) VALUES ($1, $2, $3, $4, $5)",
              [raceId, bot.racer_id, bot.wallet, actionType, actionTick]
            );
          }
        }
      }
      // Reload tactic actions after adding bot actions
      const allActions = await getAll(
        "SELECT * FROM tactic_actions WHERE race_id = $1",
        [raceId]
      );
      tacticActions.length = 0;
      for (const r of allActions) {
        tacticActions.push({ tick: r.tick, type: r.action_type as "boost" | "projectile", racerId: r.racer_id });
      }
    }

    // Reuse the seed generated when the Wind-Up window opened, so the Safe Wind
    // thresholds the players wound against and the race they produce verify
    // from a single value. Only fall back if the phase was somehow skipped.
    const seed = race.seed || generateSeed();
    const isChaosMode = race.format === "gp_final";
    const result = simulateRace(gridded, seed, tacticActions, isChaosMode);

    // Calculate prize pool distribution
    const isExhibition = race.format === "exhibition";
    let rewards: { id: number; reward: number }[];
    let totalEntryFees = 0;

    if (isExhibition) {
      const seed32 = parseInt(seed.slice(0, 8), 16);
      const CONSOLATION_PRIZE = 2;
      rewards = [];
      for (let i = 0; i < result.finalOrder.length; i++) {
        const entry = result.finalOrder[i];
        if (entry.isBot) {
          rewards.push({ id: entry.id, reward: 0 });
        } else if (i === 0) {
          const creatureType = await getOne("SELECT type FROM racers WHERE id = $1", [entry.id]);
          if (creatureType?.type === "free") {
            rewards.push({ id: entry.id, reward: 3 + ((seed32 + i) % 3) + CONSOLATION_PRIZE });
          } else {
            rewards.push({ id: entry.id, reward: 8 + ((seed32 + i) % 5) + CONSOLATION_PRIZE });
          }
        } else {
          rewards.push({ id: entry.id, reward: CONSOLATION_PRIZE });
        }
      }
    } else {
      // Entry fees are the only source now — the old pre-race spend is gone.
      const realPlayerFees = participants.filter((p: any) => p.is_bot === 0).length * race.entry_fee;
      const botVirtualFees = participants.filter((p: any) => p.is_bot === 1).length * race.entry_fee * 0.75;
      totalEntryFees = realPlayerFees + botVirtualFees;
      rewards = calculatePrizePool(totalEntryFees, result.finalOrder);
    }

    // Save results
    const resultHash = crypto.createHash("sha256").update(JSON.stringify(result.finalOrder)).digest("hex");
    const winnerWallet = result.finalOrder[0]?.wallet || "";

    await runTransaction(async (client) => {
      await client.query(
        "UPDATE races SET status = 'finished', seed = $1, result_hash = $2, winner_wallet = $3, finished_at = NOW() WHERE id = $4",
        [seed, resultHash, winnerWallet, raceId]
      );

      for (const order of result.finalOrder) {
        const reward = rewards.find((p) => p.id === order.id);
        const position = result.finalOrder.indexOf(order) + 1;

        await client.query(
          "UPDATE race_participants SET finish_position = $1, reward = $2 WHERE race_id = $3 AND racer_id = $4",
          [position, reward?.reward || 0, raceId, order.id]
        );

        // Credit rewards to real players
        if (!order.isBot && reward && reward.reward > 0) {
          await client.query(
            `INSERT INTO coin_balances (wallet, balance) VALUES ($1, $2)
             ON CONFLICT(wallet) DO UPDATE SET balance = coin_balances.balance + $3, updated_at = NOW()`,
            [order.wallet, reward.reward, reward.reward]
          );

          await client.query(
            "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'race_reward', $2, $3)",
            [order.wallet, reward.reward, `${position}${position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th"} place in ${raceId}`]
          );
        }
      }

      // Update streaks for non-bot participants
      for (let i = 0; i < result.finalOrder.length; i++) {
        const entry = result.finalOrder[i];
        if (entry.isBot) continue;
        const racerId = entry.id;
        const isWin = i === 0;

        // Ensure streak row exists
        await client.query(
          "INSERT INTO streaks (racer_id) VALUES ($1) ON CONFLICT DO NOTHING",
          [racerId]
        );

        if (isWin) {
          await client.query(
            `UPDATE streaks SET
              current_wins = current_wins + 1,
              max_wins = GREATEST(max_wins, current_wins + 1),
              current_losses = 0,
              total_races = total_races + 1,
              total_wins = total_wins + 1
            WHERE racer_id = $1`,
            [racerId]
          );
        } else {
          await client.query(
            `UPDATE streaks SET
              current_losses = current_losses + 1,
              max_losses = GREATEST(max_losses, current_losses + 1),
              current_wins = 0,
              total_races = total_races + 1
            WHERE racer_id = $1`,
            [racerId]
          );
        }
      }

      // Award XP to non-bot players
      for (let i = 0; i < result.finalOrder.length; i++) {
        const entry = result.finalOrder[i];
        if (entry.isBot) continue;
        await awardXP(entry.wallet, XP_AMOUNTS.RACE_COMPLETE);
        if (i === 0) await awardXP(entry.wallet, XP_AMOUNTS.RACE_WIN);
      }

      // First Race Bonus: 15 coins for first-ever race completion (per wallet)
      for (let i = 0; i < result.finalOrder.length; i++) {
        const entry = result.finalOrder[i];
        if (entry.isBot) continue;
        const totalRaces = (await client.query(
          "SELECT COUNT(*) as count FROM race_participants rp JOIN races r ON rp.race_id = r.id WHERE rp.wallet = $1 AND rp.is_bot = 0 AND r.status = 'finished'",
          [entry.wallet]
        )).rows[0]?.count || 0;
        if (parseInt(totalRaces) === 1) {
          await client.query(
            `INSERT INTO coin_balances (wallet, balance) VALUES ($1, 15)
             ON CONFLICT(wallet) DO UPDATE SET balance = coin_balances.balance + 15, updated_at = NOW()`,
            [entry.wallet]
          );
          await client.query(
            "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'first_race_bonus', 15, 'First Race Bonus!')",
            [entry.wallet]
          );
        }
      }

      // Award Race Points (RP) for leaderboard
      const rpValues = [25, 15, 8, 3];
      for (let i = 0; i < result.finalOrder.length; i++) {
        const entry = result.finalOrder[i];
        if (entry.isBot) continue;
        const rp = rpValues[i] || 0;
        if (rp > 0) {
          await client.query(
            "INSERT INTO race_points (wallet, racer_id, rp) VALUES ($1, $2, $3)",
            [entry.wallet, entry.id, rp]
          );
        }
      }
    });

    // Trigger quest progress for non-bot players (outside transaction — these use pool)
    for (let i = 0; i < result.finalOrder.length; i++) {
      const entry = result.finalOrder[i];
      if (entry.isBot) continue;
      await triggerQuestProgress(entry.wallet, "race_complete");
      if (i <= 1) await triggerQuestProgress(entry.wallet, "top_2_finish");
    }

    // Record race result on-chain (best-effort, non-blocking)
    const raceWinner = result.finalOrder[0];
    if (raceWinner && !raceWinner.isBot && resultHash) {
      recordRaceResultOnchain(raceId, resultHash, raceWinner.wallet).catch(() => {});
    }

    // Log weather for weekly quest (weather_variety)
    if (result.weather) {
      const weekStart = getResetDate("weekly");
      for (const entry of result.finalOrder) {
        if (entry.isBot) continue;
        await query(
          "INSERT INTO weather_log (wallet, weather, week_start) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
          [entry.wallet, result.weather, weekStart]
        );
        // Check how many distinct weathers this week
        const weatherCount = await getOne(
          "SELECT COUNT(*) as count FROM weather_log WHERE wallet = $1 AND week_start = $2",
          [entry.wallet, weekStart]
        );
        const count = parseInt(weatherCount?.count) || 0;
        if (count === 5) {
          await triggerQuestProgress(entry.wallet, "weather_variety");
        }
      }
    }

    // Organic stat growth: +0.05 to position-based stat, max +0.3/day
    const today = new Date().toISOString().split("T")[0];
    for (let i = 0; i < result.finalOrder.length; i++) {
      const entry = result.finalOrder[i];
      if (entry.isBot) continue;
      const statToGrow = POSITION_STAT[i + 1];
      if (!statToGrow) continue;

      // Check daily cap
      await query(
        "INSERT INTO daily_stat_gains (racer_id, gain_date, total_gain) VALUES ($1, $2, 0) ON CONFLICT DO NOTHING",
        [entry.id, today]
      );
      const dailyGain = await getOne(
        "SELECT total_gain FROM daily_stat_gains WHERE racer_id = $1 AND gain_date = $2",
        [entry.id, today]
      );
      if ((dailyGain?.total_gain || 0) >= 0.3) continue;

      // Check stat cap (with evolution support)
      assertValidStat(statToGrow);
      const racer = await getOne("SELECT type, rarity, tier, evolution_path, " + statToGrow + " as current_val FROM racers WHERE id = $1", [entry.id]);
      if (!racer) continue;
      let cap = racer.type === 'free' ? STAT_CAPS.free : (STAT_CAPS[racer.rarity] || STAT_CAPS.common);
      if ((racer.tier || 0) >= 3 && racer.evolution_path) {
        const pathStats: Record<string, string[]> = { speed: ['spd', 'acc'], endurance: ['sta', 'ref'], luck: ['lck', 'agi'] };
        if (pathStats[racer.evolution_path]?.includes(statToGrow)) cap += 5;
        if ((racer.tier || 0) >= 4) cap += 3;
      }
      if (racer.current_val >= cap) continue;

      const gain = Math.min(0.05, cap - racer.current_val);
      await query(
        `UPDATE racers SET ${statToGrow} = ${statToGrow} + $1 WHERE id = $2`,
        [gain, entry.id]
      );
      await query(
        "UPDATE daily_stat_gains SET total_gain = total_gain + $1 WHERE racer_id = $2 AND gain_date = $3",
        [gain, entry.id, today]
      );
    }

    // Send every 3rd frame for smooth animation (~100 frames for a 300-tick race)
    const animFrames = result.frames.filter((_: any, i: number) => i % 3 === 0 || i === result.frames.length - 1);

    // Save replay data
    await query(
      "INSERT INTO race_replays (race_id, frames, events, metadata) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
      [raceId, JSON.stringify(animFrames), JSON.stringify(result.events), JSON.stringify({ weather: result.weather, trackLength: result.trackLength, finalOrder: result.finalOrder })]
    );

    // Award GP points for GP races
    if (race.format === 'grand_prix' || race.format === 'gp_qualify' || race.format === 'gp_final') {
      const gpPointValues = [10, 6, 3, 1];
      for (let i = 0; i < result.finalOrder.length; i++) {
        const entry = result.finalOrder[i];
        if (entry.isBot) continue;
        const pts = gpPointValues[i] || 0;
        if (pts > 0) {
          await query(
            "INSERT INTO gp_points (wallet, season, gp_type, points) VALUES ($1, 1, $2, $3)",
            [entry.wallet, race.format, pts]
          );
        }
      }
    }

    res.json({
      raceId,
      seed,
      resultHash,
      gridPositions: gridded.map((g) => ({
        id: g.id,
        name: g.name,
        position: g.gridPosition,
        tension: g.windTension ?? 0,
        snapped: (g.startStaminaFactor ?? 1) < 1,
      })),
      frames: animFrames,
      events: result.events,
      finalOrder: result.finalOrder.map((o: any, i: number) => ({
        ...o,
        position: i + 1,
        reward: rewards.find((p) => p.id === o.id)?.reward || 0,
      })),
      totalPrizePool: totalEntryFees,
      trackLength: result.trackLength,
      weather: result.weather,
    });
  } catch (err) {
    console.error("POST /simulate error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/race/action — Submit a tactic action (Boost or Projectile)
router.post("/action", async (req: Request, res: Response) => {
  try {
    const { raceId, wallet, racerId, actionType, tick } = req.body;

    if (!raceId || !wallet || !racerId || !actionType || tick === undefined) {
      res.status(400).json({ error: "raceId, wallet, racerId, actionType, and tick required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const parsedTick = parseInt(tick);
    if (isNaN(parsedTick) || parsedTick < 0) {
      res.status(400).json({ error: "Invalid tick value" });
      return;
    }

    if (!["boost", "projectile"].includes(actionType)) {
      res.status(400).json({ error: "actionType must be 'boost' or 'projectile'" });
      return;
    }

    // Verify racer ownership
    const racerOwner = await getOne("SELECT id FROM racers WHERE id = $1 AND wallet = $2", [racerId, wallet]);
    if (racerOwner === null) {
      res.status(403).json({ error: "Not your racer" });
      return;
    }

    const race = await getOne("SELECT * FROM races WHERE id = $1", [raceId]);
    if (!race) {
      res.status(404).json({ error: "race not found" });
      return;
    }
    if (race.format !== "tactic" && race.format !== "gp_final") {
      res.status(400).json({ error: "actions only allowed in tactic/GP final races" });
      return;
    }

    // GDA price calculation + action insert + balance deduction all inside transaction
    const isChaos = race.format === "gp_final";
    let cost = 0;

    try {
      await runTransaction(async (client) => {
        // Lock tactic_actions rows for this race to prevent concurrent price drift
        const priorActionsResult = await client.query(
          "SELECT action_type, tick FROM tactic_actions WHERE race_id = $1 ORDER BY id ASC FOR UPDATE",
          [raceId]
        );
        const priorActions = priorActionsResult.rows;

        let gdaState = createGDAState();
        for (const pa of priorActions) {
          gdaState = applyGDAPurchase(gdaState, pa.action_type, pa.tick);
        }
        cost = getGDAPrice(gdaState, actionType, parsedTick, isChaos);

        const balanceRow = (await client.query(
          "SELECT balance FROM coin_balances WHERE wallet = $1 FOR UPDATE",
          [wallet]
        )).rows[0];
        const currentBalance = balanceRow?.balance || 0;
        if (currentBalance < cost) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        await client.query(
          "UPDATE coin_balances SET balance = balance - $1, updated_at = NOW() WHERE wallet = $2",
          [cost, wallet]
        );

        await client.query(
          "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'tactic_action', $2, $3)",
          [wallet, -cost, `${actionType} in ${raceId} at tick ${parsedTick}`]
        );

        await client.query(
          "INSERT INTO tactic_actions (race_id, racer_id, wallet, action_type, tick) VALUES ($1, $2, $3, $4, $5)",
          [raceId, racerId, wallet, actionType, parsedTick]
        );
      });
    } catch (err: any) {
      if (err.message === "INSUFFICIENT_BALANCE") {
        res.status(400).json({ error: "insufficient balance", cost });
        return;
      }
      throw err;
    }

    const newBalance = await getOne("SELECT balance FROM coin_balances WHERE wallet = $1", [wallet]);

    res.json({
      raceId,
      actionType,
      tick: parsedTick,
      cost,
      newBalance: newBalance?.balance || 0,
    });
  } catch (err) {
    console.error("POST /action error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/race/gp/create — Create a Grand Prix (3-stage)
router.post("/gp/create", async (req: Request, res: Response) => {
  try {
    const raceId = generateRaceId();
    const qualifyId = `${raceId}_q`;

    await query(
      "INSERT INTO races (id, format, entry_fee, max_tune, status) VALUES ($1, 'gp_qualify', 150, 300, 'lobby')",
      [qualifyId]
    );

    const finalId = `${raceId}_f`;

    res.status(201).json({
      gpId: raceId,
      qualifyRaceId: qualifyId,
      finalRaceId: finalId,
      stage: "qualifying",
      entryFee: 150,
      maxTune: 300,
    });
  } catch (err) {
    console.error("POST /gp/create error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/race/gp/advance — Advance GP from qualifying to final
router.post("/gp/advance", async (req: Request, res: Response) => {
  try {
    const { qualifyRaceId } = req.body;

    const race = await getOne("SELECT * FROM races WHERE id = $1", [qualifyRaceId]);
    if (!race || race.status !== "finished") {
      res.status(400).json({ error: "qualifying race not finished yet" });
      return;
    }

    // Get top 4 finishers
    const finishers = await getAll(
      `SELECT rp.*, s.name, s.spd, s.acc, s.sta, s.agi, s.ref, s.lck
       FROM race_participants rp
       JOIN racers s ON rp.racer_id = s.id
       WHERE rp.race_id = $1
       ORDER BY rp.finish_position ASC
       LIMIT 4`,
      [qualifyRaceId]
    );

    // Create final race (tactic mode with GDA)
    const finalId = qualifyRaceId.replace("_q", "_f");
    await query(
      "INSERT INTO races (id, format, entry_fee, max_tune, status) VALUES ($1, 'gp_final', 0, 300, 'tuning')",
      [finalId]
    );

    // Move top 4 to final
    for (const f of finishers) {
      await query(
        "INSERT INTO race_participants (race_id, racer_id, wallet, is_bot) VALUES ($1, $2, $3, $4)",
        [finalId, f.racer_id, f.wallet, f.is_bot]
      );
    }

    const qualifiers = finishers.map((f: any, i: number) => ({
      id: f.racer_id,
      name: f.name,
      wallet: f.wallet,
      position: i + 1,
      isBot: f.is_bot === 1,
    }));

    res.json({
      finalRaceId: finalId,
      qualifiers,
      stage: "break",
    });
  } catch (err) {
    console.error("POST /gp/advance error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/race/:id/prices — Get current GDA prices for a tactic race
router.get("/:id/prices", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tick = parseInt(req.query.tick as string) || 0;

    const race = await getOne("SELECT format FROM races WHERE id = $1", [id]);
    const isChaos = race?.format === "gp_final";

    const priorActions = await getAll(
      "SELECT action_type, tick FROM tactic_actions WHERE race_id = $1 ORDER BY id ASC",
      [id]
    );

    let gdaState = createGDAState();
    for (const pa of priorActions) {
      gdaState = applyGDAPurchase(gdaState, pa.action_type, pa.tick);
    }

    res.json({
      boostPrice: getGDAPrice(gdaState, "boost", tick, isChaos),
      projectilePrice: getGDAPrice(gdaState, "projectile", tick, isChaos),
      boostPurchases: gdaState.boostPurchases,
      projectilePurchases: gdaState.projectilePurchases,
    });
  } catch (err) {
    console.error("GET /:id/prices error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/race/daily — Get today's daily race (deterministic weather, 2x exhibition rewards)
router.get("/daily", async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Weather rotation based on day of year
    const weatherOptions = ["sunny", "rainy", "windy", "foggy", "stormy"];
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    const weather = weatherOptions[dayOfYear % weatherOptions.length];

    // Check if daily race exists
    const existing = await getOne(
      "SELECT * FROM daily_races WHERE race_date = $1",
      [today]
    );

    if (existing) {
      const race = await getOne("SELECT * FROM races WHERE id = $1", [existing.race_id]);
      res.json({ raceId: existing.race_id, weather, date: today, race });
      return;
    }

    // Create daily race (exhibition format, auto-created)
    const raceId = `daily_${today}_${crypto.randomBytes(4).toString("hex")}`;
    await query(
      "INSERT INTO races (id, format, entry_fee, max_tune, status) VALUES ($1, 'exhibition', 0, 0, 'lobby')",
      [raceId]
    );
    await query(
      "INSERT INTO daily_races (race_date, race_id) VALUES ($1, $2)",
      [today, raceId]
    );

    res.json({ raceId, weather, date: today, isNew: true });
  } catch (err) {
    console.error("GET /daily error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/race/history/:wallet — Race history for a wallet
router.get("/history/:wallet", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const races = await getAll(
      `SELECT r.id as "raceId", r.format, r.created_at as "createdAt",
              rp.finish_position as position, rp.reward, s.name as "racerName"
       FROM race_participants rp
       JOIN races r ON rp.race_id = r.id
       JOIN racers s ON rp.racer_id = s.id
       WHERE rp.wallet = $1 AND r.status = 'finished'
       ORDER BY r.finished_at DESC
       LIMIT 20`,
      [wallet]
    );

    const totalRaces = races.length;
    const totalWins = races.filter((r: any) => r.position === 1).length;
    const winRate = totalRaces > 0 ? Math.round((totalWins / totalRaces) * 100) : 0;
    const totalEarnings = races.reduce((sum: number, r: any) => sum + (r.reward || 0), 0);

    res.json({
      races,
      summary: { totalRaces, winRate, totalEarnings },
    });
  } catch (err) {
    console.error("GET /history/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/race/:id/replay — Get saved replay
router.get("/:id/replay", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const replay = await getOne("SELECT * FROM race_replays WHERE race_id = $1", [id]);
    if (!replay) {
      res.status(404).json({ error: "replay not found" });
      return;
    }

    res.json({
      raceId: replay.race_id,
      frames: replay.frames,
      events: replay.events,
      metadata: replay.metadata,
    });
  } catch (err) {
    console.error("GET /:id/replay error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/race/active — List active races
router.get("/active", async (_req: Request, res: Response) => {
  try {
    const races = await getAll(
      `SELECT r.*, COUNT(rp.id) as participant_count
       FROM races r
       LEFT JOIN race_participants rp ON r.id = rp.race_id
       WHERE r.status IN ('lobby', 'tuning')
       GROUP BY r.id
       ORDER BY r.created_at DESC
       LIMIT 20`
    );

    res.json({ races });
  } catch (err) {
    console.error("GET /active error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/race/:id — Get race status
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const race = await getOne("SELECT * FROM races WHERE id = $1", [id]);
    if (!race) {
      res.status(404).json({ error: "race not found" });
      return;
    }

    const participants = await getAll(
      `SELECT rp.*, s.name, s.rarity, s.race as racer_race, s.spd, s.acc, s.sta, s.agi, s.ref, s.lck
       FROM race_participants rp
       JOIN racers s ON rp.racer_id = s.id
       WHERE rp.race_id = $1
       ORDER BY COALESCE(rp.grid_position, rp.id)`,
      [id]
    );

    res.json({ ...race, participants });
  } catch (err) {
    console.error("GET /:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
