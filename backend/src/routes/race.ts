import { Router, Request, Response } from "express";
import crypto from "crypto";
import { query, getOne, getAll, runTransaction } from "../db";
import { simulateRace, calculatePot, SlothStats, TacticAction, createGDAState, getGDAPrice, applyGDAPurchase, GDAState } from "../simulation/engine";
import { awardXP, XP_AMOUNTS } from "../xp";
import { isValidWallet } from "../middleware/validateWallet";

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
        if (quest.sloth_reward > 0) {
          await query(
            `INSERT INTO coin_balances (wallet, balance) VALUES ($1, $2)
             ON CONFLICT(wallet) DO UPDATE SET balance = coin_balances.balance + $3, updated_at = NOW()`,
            [wallet, quest.sloth_reward, quest.sloth_reward]
          );
          await query(
            "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'quest_reward', $2, $3)",
            [wallet, quest.sloth_reward, `Quest: ${quest.title}`]
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
  free_sloth: 15,
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

// Bot sloth templates with diverse stat distributions (total ~60 each)
const BOT_TEMPLATES = [
  { name: "Espresso Bot",    race: "caffeine_junkie",   spd: 14, acc: 8,  sta: 10, agi: 10, ref: 10, lck: 8  },
  { name: "Pillow Guard",  race: "pillow_knight",  spd: 8,  acc: 14, sta: 12, agi: 8,  ref: 10, lck: 8  },
  { name: "Dream Master",   race: "dream_weaver",     spd: 10, acc: 10, sta: 14, agi: 8,  ref: 10, lck: 8  },
  { name: "Thunder Bolt",   race: "thunder_nap",  spd: 10, acc: 10, sta: 8,  agi: 14, ref: 10, lck: 8  },
  { name: "Iron Snooze",  race: "pillow_knight",  spd: 10, acc: 10, sta: 8,  agi: 8,  ref: 14, lck: 10 },
  { name: "Lucky Dreamer",  race: "dream_weaver",     spd: 10, acc: 10, sta: 8,  agi: 8,  ref: 8,  lck: 16 },
  { name: "Balanced Napper", race: "caffeine_junkie",    spd: 12, acc: 12, sta: 10, agi: 10, ref: 8,  lck: 8  },
  { name: "Tough Sleeper", race: "thunder_nap",  spd: 10, acc: 10, sta: 12, agi: 10, ref: 10, lck: 8  },
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

    const fees: Record<string, { entry: number; maxRaise: number }> = {
      exhibition: { entry: 0, maxRaise: 0 },
      standard: { entry: 50, maxRaise: 100 },
      grand_prix: { entry: 150, maxRaise: 300 },
      tactic: { entry: 75, maxRaise: 150 },
    };

    const raceConfig = fees[format] || fees.standard;
    const raceId = generateRaceId();

    await query(
      "INSERT INTO races (id, format, entry_fee, max_raise) VALUES ($1, $2, $3, $4)",
      [raceId, format, raceConfig.entry, raceConfig.maxRaise]
    );

    res.status(201).json({
      raceId,
      format,
      entryFee: raceConfig.entry,
      maxRaise: raceConfig.maxRaise,
      status: "lobby",
    });
  } catch (err) {
    console.error("POST /create error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/race/join — Join a race with a sloth
router.post("/join", async (req: Request, res: Response) => {
  try {
    const { raceId, slothId, wallet } = req.body;

    if (!raceId || !slothId || !wallet) {
      res.status(400).json({ error: "raceId, slothId, and wallet required" });
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

    const race = await getOne("SELECT * FROM races WHERE id = $1", [raceId]);
    if (!race) {
      res.status(404).json({ error: "race not found" });
      return;
    }
    if (race.status !== "lobby") {
      res.status(400).json({ error: "race is not in lobby" });
      return;
    }

    // Verify creature ownership (sloth or free_sloth)
    const sloth = await getOne(
      "SELECT * FROM sloths WHERE id = $1 AND wallet = $2 AND is_burned = 0 AND type IN ('sloth', 'free_sloth')",
      [parsedSlothId, wallet]
    );

    if (!sloth) {
      res.status(404).json({ error: "creature not found or not owned by wallet" });
      return;
    }

    // Free sloths can only join exhibition races
    if (sloth.type === "free_sloth" && race.format !== "exhibition") {
      res.status(400).json({ error: "Free Sloths can only join Exhibition races. Upgrade to a Sloth for other formats!" });
      return;
    }

    // GP tier gate: free sloths blocked, Gold GP requires tier >= 2
    if (race.format === "gp_qualify") {
      if (sloth.type === "free_sloth") {
        res.status(400).json({ error: "GP requires at least a Sloth" });
        return;
      }
      if (race.entry_fee > 150 && (sloth.tier || 0) < 2) {
        res.status(400).json({ error: "Gold GP requires Elite sloth (Tier 2+)" });
        return;
      }
    }

    // Training lock: sloth in active (unclaimed) training cannot race
    const activeTraining = await getOne(
      "SELECT id FROM trainings WHERE sloth_id = $1 AND claimed = 0",
      [parsedSlothId]
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
          "INSERT INTO race_participants (race_id, sloth_id, wallet, is_bot) VALUES ($1, $2, $3, 0)",
          [raceId, parsedSlothId, wallet]
        );
      });
    } catch (err: any) {
      if (err.message === "INSUFFICIENT_BALANCE") {
        res.status(400).json({ error: "insufficient ZZZ Coin balance" });
        return;
      }
      throw err;
    }

    const newBalance = await getOne("SELECT balance FROM coin_balances WHERE wallet = $1", [wallet]);

    res.json({
      joined: true,
      raceId,
      slothId: parsedSlothId,
      entryFeeCharged: effectiveFee,
      dailyFreeRace: isUsingFreeRace,
      newBalance: newBalance?.balance || 0,
    });
  } catch (err) {
    console.error("POST /join error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/race/start-bidding — Move race to bidding phase, fill with bots
router.post("/start-bidding", async (req: Request, res: Response) => {
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
    if (botsNeeded > 0) {
      // Shuffle templates for variety
      const shuffled = [...BOT_TEMPLATES].sort(() => Math.random() - 0.5);
      for (let i = 0; i < botsNeeded; i++) {
        const template = shuffled[i % shuffled.length];
        // Create a bot sloth with diverse stats
        const botSloth = await getOne(
          `INSERT INTO sloths (wallet, type, name, rarity, race, spd, acc, sta, agi, ref, lck)
           VALUES ($1, 'sloth', $2, 'common', $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [`bot_${i}`, template.name, template.race, template.spd, template.acc, template.sta, template.agi, template.ref, template.lck]
        );

        await query(
          "INSERT INTO race_participants (race_id, sloth_id, wallet, is_bot) VALUES ($1, $2, $3, 1)",
          [raceId, botSloth.id, `bot_${i}`]
        );
      }
    }

    // Exhibition races skip bidding — go straight to racing
    if (race.format === "exhibition") {
      await query("UPDATE races SET status = 'racing' WHERE id = $1", [raceId]);
      res.json({ raceId, status: "racing", botsAdded: botsNeeded, skipBidding: true });
      return;
    }

    await query("UPDATE races SET status = 'bidding' WHERE id = $1", [raceId]);

    res.json({ raceId, status: "bidding", botsAdded: botsNeeded });
  } catch (err) {
    console.error("POST /start-bidding error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/race/bid — Submit a sealed bid
router.post("/bid", async (req: Request, res: Response) => {
  try {
    const { raceId, wallet, amount } = req.body;

    if (!raceId || !wallet || amount === undefined) {
      res.status(400).json({ error: "raceId, wallet, and amount required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const parsedAmount = parseInt(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      res.status(400).json({ error: "Invalid bid amount" });
      return;
    }

    const race = await getOne("SELECT * FROM races WHERE id = $1", [raceId]);
    if (!race || race.status !== "bidding") {
      res.status(400).json({ error: "race not in bidding phase" });
      return;
    }

    // Exhibition races don't allow bidding
    if (race.format === "exhibition") {
      res.status(400).json({ error: "Exhibition races do not have bidding" });
      return;
    }

    const bidAmount = Math.min(Math.max(0, Math.floor(parsedAmount)), race.max_raise);

    // Deduct and record bid with balance check inside transaction
    try {
      await runTransaction(async (client) => {
        if (bidAmount > 0) {
          const balanceRow = (await client.query(
            "SELECT balance FROM coin_balances WHERE wallet = $1 FOR UPDATE",
            [wallet]
          )).rows[0];
          const currentBalance = balanceRow?.balance || 0;
          if (currentBalance < bidAmount) {
            throw new Error("INSUFFICIENT_BALANCE");
          }
          await client.query(
            "UPDATE coin_balances SET balance = balance - $1, updated_at = NOW() WHERE wallet = $2",
            [bidAmount, wallet]
          );

          await client.query(
            "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'race_bid', $2, $3)",
            [wallet, -bidAmount, `Bid for ${raceId}`]
          );
        }

        await client.query(
          "UPDATE race_participants SET bid_amount = $1 WHERE race_id = $2 AND wallet = $3",
          [bidAmount, raceId, wallet]
        );
      });
    } catch (err: any) {
      if (err.message === "INSUFFICIENT_BALANCE") {
        res.status(400).json({ error: "insufficient balance for bid" });
        return;
      }
      throw err;
    }

    // Generate stat-aware bot bids — stronger bots bid more aggressively
    const botParticipants = await getAll(
      "SELECT rp.*, s.spd, s.acc, s.sta, s.agi, s.ref, s.lck FROM race_participants rp JOIN sloths s ON rp.sloth_id = s.id WHERE rp.race_id = $1 AND rp.is_bot = 1",
      [raceId]
    );

    for (const bot of botParticipants) {
      const totalStats = (bot.spd || 10) + (bot.acc || 10) + (bot.sta || 10) + (bot.agi || 10) + (bot.ref || 10) + (bot.lck || 10);
      const confidence = Math.min(1, totalStats / 100);
      const botBid = Math.floor(Math.random() * race.max_raise * (0.3 + confidence * 0.5));
      await query(
        "UPDATE race_participants SET bid_amount = $1 WHERE id = $2",
        [botBid, bot.id]
      );
    }

    res.json({ raceId, wallet, bidAmount });
  } catch (err) {
    console.error("POST /bid error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/race/simulate — Run the race simulation
router.post("/simulate", async (req: Request, res: Response) => {
  try {
    const { raceId } = req.body;

    const race = await getOne("SELECT * FROM races WHERE id = $1", [raceId]);
    if (!race) {
      res.status(404).json({ error: "race not found" });
      return;
    }

    const participants = await getAll(
      `SELECT rp.*, s.name, s.spd, s.acc, s.sta, s.agi, s.ref, s.lck, s.passive, s.tier
       FROM race_participants rp
       JOIN sloths s ON rp.sloth_id = s.id
       WHERE rp.race_id = $1
       ORDER BY rp.bid_amount DESC`,
      [raceId]
    );

    // Load accessory bonuses for each participant
    const accessoryBonuses: Record<number, Record<string, number>> = {};
    for (const p of participants) {
      const equipment = await getOne(
        "SELECT a.stat_bonus FROM sloth_equipment se JOIN accessories a ON se.accessory_id = a.id WHERE se.sloth_id = $1",
        [p.sloth_id]
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
        accessoryBonuses[p.sloth_id] = bonus;
      }
    }

    // Assign grid positions based on bid (highest bid = pole position)
    for (let index = 0; index < participants.length; index++) {
      const p = participants[index];
      await query("UPDATE race_participants SET grid_position = $1 WHERE id = $2", [index + 1, p.id]);
    }

    const gridded: SlothStats[] = participants.map((p: any, index: number) => {
      const bonus = accessoryBonuses[p.sloth_id] || {};
      return {
        id: p.sloth_id,
        name: p.name,
        wallet: p.wallet,
        isBot: p.is_bot === 1,
        spd: p.spd + (bonus.spd || 0),
        acc: p.acc + (bonus.acc || 0),
        sta: p.sta + (bonus.sta || 0),
        agi: p.agi + (bonus.agi || 0),
        ref: p.ref + (bonus.ref || 0),
        lck: p.lck + (bonus.lck || 0),
        gridPosition: index + 1,
        passive: p.passive || undefined,
      };
    });

    // Load tactic actions if any
    const tacticRows = await getAll(
      "SELECT * FROM tactic_actions WHERE race_id = $1",
      [raceId]
    );
    const tacticActions: TacticAction[] = tacticRows.map((r: any) => ({
      tick: r.tick,
      type: r.action_type as "boost" | "pillow",
      slothId: r.sloth_id,
    }));

    // Generate bot tactic actions for tactic/gp_final modes
    if (race.format === "tactic" || race.format === "gp_final") {
      const botEntries = participants.filter((p: any) => p.is_bot === 1);
      for (const bot of botEntries) {
        if (Math.random() < 0.6) {
          const actionType = Math.random() > 0.5 ? "boost" : "pillow";
          const actionTick = Math.floor(50 + Math.random() * 200);
          const existingAction = await getOne(
            "SELECT 1 FROM tactic_actions WHERE race_id = $1 AND sloth_id = $2 AND action_type = $3",
            [raceId, bot.sloth_id, actionType]
          );
          if (!existingAction) {
            await query(
              "INSERT INTO tactic_actions (race_id, sloth_id, wallet, action_type, tick) VALUES ($1, $2, $3, $4, $5)",
              [raceId, bot.sloth_id, bot.wallet, actionType, actionTick]
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
        tacticActions.push({ tick: r.tick, type: r.action_type as "boost" | "pillow", slothId: r.sloth_id });
      }
    }

    // Generate seed and simulate (chaos mode for GP finals)
    const seed = generateSeed();
    const isChaosMode = race.format === "gp_final";
    const result = simulateRace(gridded, seed, tacticActions, isChaosMode);

    // Calculate pot distribution
    const isExhibition = race.format === "exhibition";
    let payouts: { id: number; payout: number }[];
    let totalEntryFees = 0;
    let totalBids = 0;

    if (isExhibition) {
      const seed32 = parseInt(seed.slice(0, 8), 16);
      payouts = [];
      for (let i = 0; i < result.finalOrder.length; i++) {
        const entry = result.finalOrder[i];
        if (i === 0 && !entry.isBot) {
          const creatureType = await getOne("SELECT type FROM sloths WHERE id = $1", [entry.id]);
          if (creatureType?.type === "free_sloth") {
            payouts.push({ id: entry.id, payout: 3 + ((seed32 + i) % 3) });
          } else {
            payouts.push({ id: entry.id, payout: 8 + ((seed32 + i) % 5) });
          }
        } else {
          payouts.push({ id: entry.id, payout: 0 });
        }
      }
    } else {
      totalEntryFees = participants.filter((p: any) => p.is_bot === 0).length * race.entry_fee;
      totalBids = participants.reduce((sum: number, p: any) => sum + (p.is_bot === 0 ? p.bid_amount : 0), 0);
      payouts = calculatePot(totalEntryFees, totalBids, result.finalOrder);
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
        const payout = payouts.find((p) => p.id === order.id);
        const position = result.finalOrder.indexOf(order) + 1;

        await client.query(
          "UPDATE race_participants SET finish_position = $1, payout = $2 WHERE race_id = $3 AND sloth_id = $4",
          [position, payout?.payout || 0, raceId, order.id]
        );

        // Credit payouts to real players
        if (!order.isBot && payout && payout.payout > 0) {
          await client.query(
            `INSERT INTO coin_balances (wallet, balance) VALUES ($1, $2)
             ON CONFLICT(wallet) DO UPDATE SET balance = coin_balances.balance + $3, updated_at = NOW()`,
            [order.wallet, payout.payout, payout.payout]
          );

          await client.query(
            "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'race_payout', $2, $3)",
            [order.wallet, payout.payout, `${position}${position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th"} place in ${raceId}`]
          );
        }
      }

      // Update streaks for non-bot participants
      for (let i = 0; i < result.finalOrder.length; i++) {
        const entry = result.finalOrder[i];
        if (entry.isBot) continue;
        const slothId = entry.id;
        const isWin = i === 0;

        // Ensure streak row exists
        await client.query(
          "INSERT INTO streaks (sloth_id) VALUES ($1) ON CONFLICT DO NOTHING",
          [slothId]
        );

        if (isWin) {
          await client.query(
            `UPDATE streaks SET
              current_wins = current_wins + 1,
              max_wins = GREATEST(max_wins, current_wins + 1),
              current_losses = 0,
              total_races = total_races + 1,
              total_wins = total_wins + 1
            WHERE sloth_id = $1`,
            [slothId]
          );
        } else {
          await client.query(
            `UPDATE streaks SET
              current_losses = current_losses + 1,
              max_losses = GREATEST(max_losses, current_losses + 1),
              current_wins = 0,
              total_races = total_races + 1
            WHERE sloth_id = $1`,
            [slothId]
          );
        }
      }

      // Reward correct predictions (15 ZZZ each)
      const winnerId = result.finalOrder[0]?.id;
      if (winnerId) {
        const correctPredictions = (await client.query(
          "SELECT * FROM predictions WHERE race_id = $1 AND predicted_sloth_id = $2 AND rewarded = 0",
          [raceId, winnerId]
        )).rows;

        for (const pred of correctPredictions) {
          await client.query(
            `INSERT INTO coin_balances (wallet, balance) VALUES ($1, 15)
             ON CONFLICT(wallet) DO UPDATE SET balance = coin_balances.balance + 15, updated_at = NOW()`,
            [pred.wallet]
          );
          await client.query(
            "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'prediction_reward', 15, $2)",
            [pred.wallet, `Correct prediction for ${raceId}`]
          );
          await client.query("UPDATE predictions SET correct = 1, rewarded = 1 WHERE id = $1", [pred.id]);
        }
      }

      // Award XP to non-bot players
      for (let i = 0; i < result.finalOrder.length; i++) {
        const entry = result.finalOrder[i];
        if (entry.isBot) continue;
        await awardXP(entry.wallet, XP_AMOUNTS.RACE_COMPLETE);
        if (i === 0) await awardXP(entry.wallet, XP_AMOUNTS.RACE_WIN);
      }

      // Award Race Points (RP) for leaderboard
      const rpValues = [25, 15, 8, 3];
      for (let i = 0; i < result.finalOrder.length; i++) {
        const entry = result.finalOrder[i];
        if (entry.isBot) continue;
        const rp = rpValues[i] || 0;
        if (rp > 0) {
          await client.query(
            "INSERT INTO race_points (wallet, sloth_id, rp) VALUES ($1, $2, $3)",
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
        "INSERT INTO daily_stat_gains (sloth_id, gain_date, total_gain) VALUES ($1, $2, 0) ON CONFLICT DO NOTHING",
        [entry.id, today]
      );
      const dailyGain = await getOne(
        "SELECT total_gain FROM daily_stat_gains WHERE sloth_id = $1 AND gain_date = $2",
        [entry.id, today]
      );
      if ((dailyGain?.total_gain || 0) >= 0.3) continue;

      // Check stat cap (with evolution support)
      assertValidStat(statToGrow);
      const sloth = await getOne("SELECT type, rarity, tier, evolution_path, " + statToGrow + " as current_val FROM sloths WHERE id = $1", [entry.id]);
      if (!sloth) continue;
      let cap = sloth.type === 'free_sloth' ? STAT_CAPS.free_sloth : (STAT_CAPS[sloth.rarity] || STAT_CAPS.common);
      if ((sloth.tier || 0) >= 3 && sloth.evolution_path) {
        const pathStats: Record<string, string[]> = { caffeine: ['spd', 'acc'], hibernate: ['sta', 'ref'], dreamwalk: ['lck', 'agi'] };
        if (pathStats[sloth.evolution_path]?.includes(statToGrow)) cap += 5;
        if ((sloth.tier || 0) >= 4) cap += 3;
      }
      if (sloth.current_val >= cap) continue;

      const gain = Math.min(0.05, cap - sloth.current_val);
      await query(
        `UPDATE sloths SET ${statToGrow} = ${statToGrow} + $1 WHERE id = $2`,
        [gain, entry.id]
      );
      await query(
        "UPDATE daily_stat_gains SET total_gain = total_gain + $1 WHERE sloth_id = $2 AND gain_date = $3",
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
      gridPositions: gridded.map((g) => ({ id: g.id, name: g.name, position: g.gridPosition, bid: participants.find((p: any) => p.sloth_id === g.id)?.bid_amount || 0 })),
      frames: animFrames,
      events: result.events,
      finalOrder: result.finalOrder.map((o: any, i: number) => ({
        ...o,
        position: i + 1,
        payout: payouts.find((p) => p.id === o.id)?.payout || 0,
      })),
      totalPot: totalEntryFees + totalBids,
      trackLength: result.trackLength,
      weather: result.weather,
    });
  } catch (err) {
    console.error("POST /simulate error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/race/action — Submit a tactic action (Boost or Pillow)
router.post("/action", async (req: Request, res: Response) => {
  try {
    const { raceId, wallet, slothId, actionType, tick } = req.body;

    if (!raceId || !wallet || !slothId || !actionType || tick === undefined) {
      res.status(400).json({ error: "raceId, wallet, slothId, actionType, and tick required" });
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

    if (!["boost", "pillow"].includes(actionType)) {
      res.status(400).json({ error: "actionType must be 'boost' or 'pillow'" });
      return;
    }

    // Verify sloth ownership
    const slothOwner = await getOne("SELECT id FROM sloths WHERE id = $1 AND wallet = $2", [slothId, wallet]);
    if (slothOwner === null) {
      res.status(403).json({ error: "Not your sloth" });
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
          "INSERT INTO tactic_actions (race_id, sloth_id, wallet, action_type, tick) VALUES ($1, $2, $3, $4, $5)",
          [raceId, slothId, wallet, actionType, parsedTick]
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
      "INSERT INTO races (id, format, entry_fee, max_raise, status) VALUES ($1, 'gp_qualify', 150, 300, 'lobby')",
      [qualifyId]
    );

    const finalId = `${raceId}_f`;

    res.status(201).json({
      gpId: raceId,
      qualifyRaceId: qualifyId,
      finalRaceId: finalId,
      stage: "qualifying",
      entryFee: 150,
      maxRaise: 300,
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
       JOIN sloths s ON rp.sloth_id = s.id
       WHERE rp.race_id = $1
       ORDER BY rp.finish_position ASC
       LIMIT 4`,
      [qualifyRaceId]
    );

    // Create final race (tactic mode with GDA)
    const finalId = qualifyRaceId.replace("_q", "_f");
    await query(
      "INSERT INTO races (id, format, entry_fee, max_raise, status) VALUES ($1, 'gp_final', 0, 300, 'bidding')",
      [finalId]
    );

    // Move top 4 to final
    for (const f of finishers) {
      await query(
        "INSERT INTO race_participants (race_id, sloth_id, wallet, is_bot) VALUES ($1, $2, $3, $4)",
        [finalId, f.sloth_id, f.wallet, f.is_bot]
      );
    }

    const qualifiers = finishers.map((f: any, i: number) => ({
      id: f.sloth_id,
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

// POST /api/race/predict — Predict race winner
router.post("/predict", async (req: Request, res: Response) => {
  try {
    const { raceId, wallet, slothId } = req.body;

    if (!raceId || !wallet || !slothId) {
      res.status(400).json({ error: "raceId, wallet, and slothId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const race = await getOne("SELECT * FROM races WHERE id = $1", [raceId]);
    if (!race || race.status === "finished") {
      res.status(400).json({ error: "race not found or already finished" });
      return;
    }

    // Check if already predicted
    const existing = await getOne(
      "SELECT id FROM predictions WHERE race_id = $1 AND wallet = $2",
      [raceId, wallet]
    );
    if (existing) {
      res.status(409).json({ error: "already predicted for this race" });
      return;
    }

    await query(
      "INSERT INTO predictions (race_id, wallet, predicted_sloth_id) VALUES ($1, $2, $3)",
      [raceId, wallet, slothId]
    );

    res.json({ predicted: true, raceId, slothId });
  } catch (err) {
    console.error("POST /predict error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/race/:id/predictions — Get predictions for a race
router.get("/:id/predictions", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const predictions = await getAll(
      "SELECT p.*, s.name as sloth_name FROM predictions p JOIN sloths s ON p.predicted_sloth_id = s.id WHERE p.race_id = $1",
      [id]
    );

    res.json({ predictions });
  } catch (err) {
    console.error("GET /:id/predictions error:", err);
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
      pillowPrice: getGDAPrice(gdaState, "pillow", tick, isChaos),
      boostPurchases: gdaState.boostPurchases,
      pillowPurchases: gdaState.pillowPurchases,
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
      "INSERT INTO races (id, format, entry_fee, max_raise, status) VALUES ($1, 'exhibition', 0, 0, 'lobby')",
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
              rp.finish_position as position, rp.payout, s.name as "slothName"
       FROM race_participants rp
       JOIN races r ON rp.race_id = r.id
       JOIN sloths s ON rp.sloth_id = s.id
       WHERE rp.wallet = $1 AND r.status = 'finished'
       ORDER BY r.finished_at DESC
       LIMIT 20`,
      [wallet]
    );

    const totalRaces = races.length;
    const totalWins = races.filter((r: any) => r.position === 1).length;
    const winRate = totalRaces > 0 ? Math.round((totalWins / totalRaces) * 100) : 0;
    const totalEarnings = races.reduce((sum: number, r: any) => sum + (r.payout || 0), 0);

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
       WHERE r.status IN ('lobby', 'bidding')
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
      `SELECT rp.*, s.name, s.rarity, s.race as sloth_race, s.spd, s.acc, s.sta, s.agi, s.ref, s.lck
       FROM race_participants rp
       JOIN sloths s ON rp.sloth_id = s.id
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
