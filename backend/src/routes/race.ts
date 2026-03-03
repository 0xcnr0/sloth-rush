import { Router, Request, Response } from "express";
import crypto from "crypto";
import db from "../db";
import { simulateRace, calculatePot, SnailStats, TacticAction, createGDAState, getGDAPrice, applyGDAPurchase, GDAState } from "../simulation/engine";

const router = Router();

// Bot snail templates with diverse stat distributions (total ~60 each)
const BOT_TEMPLATES = [
  { name: "Turbo Bot",    race: "turbo_slug",   spd: 14, acc: 8,  sta: 10, agi: 10, ref: 10, lck: 8  }, // Speed demon
  { name: "Shell Guard",  race: "shell_knight",  spd: 8,  acc: 14, sta: 12, agi: 8,  ref: 10, lck: 8  }, // Fast starter
  { name: "Goo Master",   race: "goo_mage",     spd: 10, acc: 10, sta: 14, agi: 8,  ref: 10, lck: 8  }, // Endurance
  { name: "Storm Bolt",   race: "storm_racer",  spd: 10, acc: 10, sta: 8,  agi: 14, ref: 10, lck: 8  }, // Agile
  { name: "Iron Reflex",  race: "shell_knight",  spd: 10, acc: 10, sta: 8,  agi: 8,  ref: 14, lck: 10 }, // Reflex master
  { name: "Lucky Slime",  race: "goo_mage",     spd: 10, acc: 10, sta: 8,  agi: 8,  ref: 8,  lck: 16 }, // Lucky
  { name: "Balanced Ace", race: "turbo_slug",    spd: 12, acc: 12, sta: 10, agi: 10, ref: 8,  lck: 8  }, // Balanced fast
  { name: "Tough Cookie", race: "storm_racer",  spd: 10, acc: 10, sta: 12, agi: 10, ref: 10, lck: 8  }, // Balanced tough
];

function generateRaceId(): string {
  return `race_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function generateSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

// POST /api/race/create — Create a new race
router.post("/create", (req: Request, res: Response) => {
  const { format = "standard" } = req.body;

  const fees: Record<string, { entry: number; maxRaise: number }> = {
    exhibition: { entry: 0, maxRaise: 0 },
    standard: { entry: 50, maxRaise: 100 },
    grand_prix: { entry: 150, maxRaise: 300 },
    tactic: { entry: 75, maxRaise: 150 },
  };

  const raceConfig = fees[format] || fees.standard;
  const raceId = generateRaceId();

  db.prepare(
    "INSERT INTO races (id, format, entry_fee, max_raise) VALUES (?, ?, ?, ?)"
  ).run(raceId, format, raceConfig.entry, raceConfig.maxRaise);

  res.status(201).json({
    raceId,
    format,
    entryFee: raceConfig.entry,
    maxRaise: raceConfig.maxRaise,
    status: "lobby",
  });
});

// POST /api/race/join — Join a race with a snail
router.post("/join", (req: Request, res: Response) => {
  const { raceId, snailId, wallet } = req.body;

  if (!raceId || !snailId || !wallet) {
    res.status(400).json({ error: "raceId, snailId, and wallet required" });
    return;
  }

  const race = db.prepare("SELECT * FROM races WHERE id = ?").get(raceId) as any;
  if (!race) {
    res.status(404).json({ error: "race not found" });
    return;
  }
  if (race.status !== "lobby") {
    res.status(400).json({ error: "race is not in lobby" });
    return;
  }

  // Verify snail ownership
  const snail = db.prepare(
    "SELECT * FROM slugs WHERE id = ? AND wallet = ? AND type = 'snail' AND is_burned = 0"
  ).get(snailId, wallet) as any;

  if (!snail) {
    res.status(404).json({ error: "snail not found or not owned by wallet" });
    return;
  }

  // Daily free race check: 1 free Standard Race per wallet per day
  const today = new Date().toISOString().slice(0, 10);
  let freeRaceUsed = false;
  let isUsingFreeRace = false;

  if (race.format === "standard" && race.entry_fee > 0) {
    const dailyUsed = db.prepare(
      "SELECT 1 FROM daily_free_races WHERE wallet = ? AND race_date = ?"
    ).get(wallet, today);

    if (!dailyUsed) {
      isUsingFreeRace = true;
    }
  }

  // Check balance for entry fee (skip if using daily free race)
  const balance = db.prepare("SELECT balance FROM coin_balances WHERE wallet = ?").get(wallet) as any;
  const currentBalance = balance?.balance || 0;
  const effectiveFee = isUsingFreeRace ? 0 : race.entry_fee;

  if (currentBalance < effectiveFee) {
    res.status(400).json({ error: "insufficient SLUG Coin balance", required: effectiveFee, current: currentBalance });
    return;
  }

  // Check if already joined
  const existing = db.prepare(
    "SELECT id FROM race_participants WHERE race_id = ? AND wallet = ?"
  ).get(raceId, wallet);

  if (existing) {
    res.status(409).json({ error: "already joined this race" });
    return;
  }

  // Count current participants
  const participantCount = db.prepare(
    "SELECT COUNT(*) as count FROM race_participants WHERE race_id = ?"
  ).get(raceId) as any;

  if (participantCount.count >= 4) {
    res.status(400).json({ error: "race is full" });
    return;
  }

  // Deduct entry fee and join
  const joinRace = db.transaction(() => {
    // Deduct entry fee (unless using daily free race)
    if (effectiveFee > 0) {
      db.prepare(
        "UPDATE coin_balances SET balance = balance - ?, updated_at = datetime('now') WHERE wallet = ?"
      ).run(effectiveFee, wallet);

      db.prepare(
        "INSERT INTO transactions (wallet, type, amount, description) VALUES (?, 'race_entry', ?, ?)"
      ).run(wallet, -effectiveFee, `Entry fee for ${raceId}`);
    }

    // Record daily free race usage
    if (isUsingFreeRace) {
      db.prepare(
        "INSERT OR IGNORE INTO daily_free_races (wallet, race_date) VALUES (?, ?)"
      ).run(wallet, today);
    }

    // Add participant
    db.prepare(
      "INSERT INTO race_participants (race_id, snail_id, wallet, is_bot) VALUES (?, ?, ?, 0)"
    ).run(raceId, snailId, wallet);
  });

  joinRace();

  const newBalance = db.prepare("SELECT balance FROM coin_balances WHERE wallet = ?").get(wallet) as any;

  res.json({
    joined: true,
    raceId,
    snailId,
    entryFeeCharged: effectiveFee,
    dailyFreeRace: isUsingFreeRace,
    newBalance: newBalance?.balance || 0,
  });
});

// POST /api/race/start-bidding — Move race to bidding phase, fill with bots
router.post("/start-bidding", (req: Request, res: Response) => {
  const { raceId } = req.body;

  const race = db.prepare("SELECT * FROM races WHERE id = ?").get(raceId) as any;
  if (!race || race.status !== "lobby") {
    res.status(400).json({ error: "race not found or not in lobby" });
    return;
  }

  const participants = db.prepare(
    "SELECT * FROM race_participants WHERE race_id = ?"
  ).all(raceId) as any[];

  // Fill remaining slots with bots (8 for GP qualifying, 4 for normal)
  const maxSlots = race.format === 'gp_qualify' ? 8 : 4;
  const botsNeeded = maxSlots - participants.length;
  if (botsNeeded > 0) {
    // Shuffle templates for variety
    const shuffled = [...BOT_TEMPLATES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < botsNeeded; i++) {
      const template = shuffled[i % shuffled.length];
      // Create a bot snail with diverse stats
      const botSnail = db.prepare(
        `INSERT INTO slugs (wallet, type, name, rarity, race, spd, acc, sta, agi, ref, lck)
         VALUES (?, 'snail', ?, 'common', ?, ?, ?, ?, ?, ?, ?)`
      ).run(`bot_${i}`, template.name, template.race, template.spd, template.acc, template.sta, template.agi, template.ref, template.lck);

      db.prepare(
        "INSERT INTO race_participants (race_id, snail_id, wallet, is_bot) VALUES (?, ?, ?, 1)"
      ).run(raceId, botSnail.lastInsertRowid, `bot_${i}`);
    }
  }

  db.prepare("UPDATE races SET status = 'bidding' WHERE id = ?").run(raceId);

  res.json({ raceId, status: "bidding", botsAdded: botsNeeded });
});

// POST /api/race/bid — Submit a sealed bid
router.post("/bid", (req: Request, res: Response) => {
  const { raceId, wallet, amount } = req.body;

  if (!raceId || !wallet || amount === undefined) {
    res.status(400).json({ error: "raceId, wallet, and amount required" });
    return;
  }

  const race = db.prepare("SELECT * FROM races WHERE id = ?").get(raceId) as any;
  if (!race || race.status !== "bidding") {
    res.status(400).json({ error: "race not in bidding phase" });
    return;
  }

  const bidAmount = Math.min(Math.max(0, Math.floor(amount)), race.max_raise);

  // Check balance
  const balance = db.prepare("SELECT balance FROM coin_balances WHERE wallet = ?").get(wallet) as any;
  const currentBalance = balance?.balance || 0;

  if (currentBalance < bidAmount) {
    res.status(400).json({ error: "insufficient balance for bid", maxAffordable: currentBalance });
    return;
  }

  // Deduct and record bid
  const submitBid = db.transaction(() => {
    if (bidAmount > 0) {
      db.prepare(
        "UPDATE coin_balances SET balance = balance - ?, updated_at = datetime('now') WHERE wallet = ?"
      ).run(bidAmount, wallet);

      db.prepare(
        "INSERT INTO transactions (wallet, type, amount, description) VALUES (?, 'race_bid', ?, ?)"
      ).run(wallet, -bidAmount, `Bid for ${raceId}`);
    }

    db.prepare(
      "UPDATE race_participants SET bid_amount = ? WHERE race_id = ? AND wallet = ?"
    ).run(bidAmount, raceId, wallet);
  });

  submitBid();

  // Generate stat-aware bot bids — stronger bots bid more aggressively
  const botParticipants = db.prepare(
    "SELECT rp.*, s.spd, s.acc, s.sta, s.agi, s.ref, s.lck FROM race_participants rp JOIN slugs s ON rp.snail_id = s.id WHERE rp.race_id = ? AND rp.is_bot = 1"
  ).all(raceId) as any[];

  for (const bot of botParticipants) {
    const totalStats = (bot.spd || 10) + (bot.acc || 10) + (bot.sta || 10) + (bot.agi || 10) + (bot.ref || 10) + (bot.lck || 10);
    const confidence = Math.min(1, totalStats / 100); // 60 = base, 100 = maxed
    const botBid = Math.floor(Math.random() * race.max_raise * (0.3 + confidence * 0.5));
    db.prepare(
      "UPDATE race_participants SET bid_amount = ? WHERE id = ?"
    ).run(botBid, bot.id);
  }

  res.json({ raceId, wallet, bidAmount });
});

// POST /api/race/simulate — Run the race simulation
router.post("/simulate", (req: Request, res: Response) => {
  const { raceId } = req.body;

  const race = db.prepare("SELECT * FROM races WHERE id = ?").get(raceId) as any;
  if (!race) {
    res.status(404).json({ error: "race not found" });
    return;
  }

  const participants = db.prepare(
    `SELECT rp.*, s.name, s.spd, s.acc, s.sta, s.agi, s.ref, s.lck
     FROM race_participants rp
     JOIN slugs s ON rp.snail_id = s.id
     WHERE rp.race_id = ?
     ORDER BY rp.bid_amount DESC`
  ).all(raceId) as any[];

  // Assign grid positions based on bid (highest bid = pole position)
  const gridded = participants.map((p: any, index: number) => {
    db.prepare("UPDATE race_participants SET grid_position = ? WHERE id = ?").run(index + 1, p.id);
    return {
      id: p.snail_id,
      name: p.name,
      wallet: p.wallet,
      isBot: p.is_bot === 1,
      spd: p.spd,
      acc: p.acc,
      sta: p.sta,
      agi: p.agi,
      ref: p.ref,
      lck: p.lck,
      gridPosition: index + 1,
    } as SnailStats;
  });

  // Load tactic actions if any
  const tacticRows = db.prepare(
    "SELECT * FROM tactic_actions WHERE race_id = ?"
  ).all(raceId) as any[];
  const tacticActions: TacticAction[] = tacticRows.map((r: any) => ({
    tick: r.tick,
    type: r.action_type as "boost" | "shell",
    snailId: r.snail_id,
  }));

  // Generate bot tactic actions for tactic/gp_final modes
  if (race.format === "tactic" || race.format === "gp_final") {
    const botEntries = participants.filter((p: any) => p.is_bot === 1);
    for (const bot of botEntries) {
      if (Math.random() < 0.6) { // 60% chance bot uses an action
        const actionType = Math.random() > 0.5 ? "boost" : "shell";
        const actionTick = Math.floor(50 + Math.random() * 200); // mid-race timing
        // Check if bot already has this action type for this race
        const existing = db.prepare(
          "SELECT 1 FROM tactic_actions WHERE race_id = ? AND snail_id = ? AND action_type = ?"
        ).get(raceId, bot.snail_id, actionType);
        if (!existing) {
          db.prepare(
            "INSERT INTO tactic_actions (race_id, snail_id, wallet, action_type, tick) VALUES (?, ?, ?, ?, ?)"
          ).run(raceId, bot.snail_id, bot.wallet, actionType, actionTick);
        }
      }
    }
    // Reload tactic actions after adding bot actions
    const allActions = db.prepare(
      "SELECT * FROM tactic_actions WHERE race_id = ?"
    ).all(raceId) as any[];
    tacticActions.length = 0;
    for (const r of allActions) {
      tacticActions.push({ tick: r.tick, type: r.action_type as "boost" | "shell", snailId: r.snail_id });
    }
  }

  // Generate seed and simulate (chaos mode for GP finals)
  const seed = generateSeed();
  const isChaosMode = race.format === "gp_final";
  const result = simulateRace(gridded, seed, tacticActions, isChaosMode);

  // Calculate pot distribution
  const totalEntryFees = participants.filter((p: any) => p.is_bot === 0).length * race.entry_fee;
  const totalBids = participants.reduce((sum: number, p: any) => sum + (p.is_bot === 0 ? p.bid_amount : 0), 0);
  const payouts = calculatePot(totalEntryFees, totalBids, result.finalOrder);

  // Save results
  const resultHash = crypto.createHash("sha256").update(JSON.stringify(result.finalOrder)).digest("hex");
  const winnerWallet = result.finalOrder[0]?.wallet || "";

  const saveResults = db.transaction(() => {
    db.prepare(
      "UPDATE races SET status = 'finished', seed = ?, result_hash = ?, winner_wallet = ?, finished_at = datetime('now') WHERE id = ?"
    ).run(seed, resultHash, winnerWallet, raceId);

    for (const order of result.finalOrder) {
      const payout = payouts.find((p) => p.id === order.id);
      const position = result.finalOrder.indexOf(order) + 1;

      db.prepare(
        "UPDATE race_participants SET finish_position = ?, payout = ? WHERE race_id = ? AND snail_id = ?"
      ).run(position, payout?.payout || 0, raceId, order.id);

      // Credit payouts to real players
      if (!order.isBot && payout && payout.payout > 0) {
        db.prepare(
          `INSERT INTO coin_balances (wallet, balance) VALUES (?, ?)
           ON CONFLICT(wallet) DO UPDATE SET balance = balance + ?, updated_at = datetime('now')`
        ).run(order.wallet, payout.payout, payout.payout);

        db.prepare(
          "INSERT INTO transactions (wallet, type, amount, description) VALUES (?, 'race_payout', ?, ?)"
        ).run(order.wallet, payout.payout, `${position}${position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th"} place in ${raceId}`);
      }
    }
  });

  saveResults();

  // Update streaks for non-bot participants
  for (let i = 0; i < result.finalOrder.length; i++) {
    const entry = result.finalOrder[i];
    if (entry.isBot) continue;
    const snailId = entry.id;
    const isWin = i === 0;

    // Ensure streak row exists
    db.prepare(
      "INSERT OR IGNORE INTO streaks (snail_id) VALUES (?)"
    ).run(snailId);

    if (isWin) {
      db.prepare(
        `UPDATE streaks SET
          current_wins = current_wins + 1,
          max_wins = MAX(max_wins, current_wins + 1),
          current_losses = 0,
          total_races = total_races + 1,
          total_wins = total_wins + 1
        WHERE snail_id = ?`
      ).run(snailId);
    } else {
      db.prepare(
        `UPDATE streaks SET
          current_losses = current_losses + 1,
          max_losses = MAX(max_losses, current_losses + 1),
          current_wins = 0,
          total_races = total_races + 1
        WHERE snail_id = ?`
      ).run(snailId);
    }
  }

  // Reward correct predictions (15 SLUG each)
  const winnerId = result.finalOrder[0]?.id;
  if (winnerId) {
    const correctPredictions = db.prepare(
      "SELECT * FROM predictions WHERE race_id = ? AND predicted_snail_id = ? AND rewarded = 0"
    ).all(raceId, winnerId) as any[];

    for (const pred of correctPredictions) {
      db.prepare(
        `INSERT INTO coin_balances (wallet, balance) VALUES (?, 15)
         ON CONFLICT(wallet) DO UPDATE SET balance = balance + 15, updated_at = datetime('now')`
      ).run(pred.wallet);
      db.prepare(
        "INSERT INTO transactions (wallet, type, amount, description) VALUES (?, 'prediction_reward', 15, ?)"
      ).run(pred.wallet, `Correct prediction for ${raceId}`);
      db.prepare("UPDATE predictions SET correct = 1, rewarded = 1 WHERE id = ?").run(pred.id);
    }
  }

  // Send every 3rd frame for smooth animation (~100 frames for a 300-tick race)
  const animFrames = result.frames.filter((_, i) => i % 3 === 0 || i === result.frames.length - 1);

  res.json({
    raceId,
    seed,
    resultHash,
    gridPositions: gridded.map((g) => ({ id: g.id, name: g.name, position: g.gridPosition, bid: participants.find((p: any) => p.snail_id === g.id)?.bid_amount || 0 })),
    frames: animFrames,
    events: result.events,
    finalOrder: result.finalOrder.map((o, i) => ({
      ...o,
      position: i + 1,
      payout: payouts.find((p) => p.id === o.id)?.payout || 0,
    })),
    totalPot: totalEntryFees + totalBids,
    trackLength: result.trackLength,
    weather: result.weather,
  });
});

// POST /api/race/action — Submit a tactic action (Boost or Shell)
router.post("/action", (req: Request, res: Response) => {
  const { raceId, wallet, snailId, actionType, tick } = req.body;

  if (!raceId || !wallet || !snailId || !actionType || tick === undefined) {
    res.status(400).json({ error: "raceId, wallet, snailId, actionType, and tick required" });
    return;
  }

  if (!["boost", "shell"].includes(actionType)) {
    res.status(400).json({ error: "actionType must be 'boost' or 'shell'" });
    return;
  }

  const race = db.prepare("SELECT * FROM races WHERE id = ?").get(raceId) as any;
  if (!race) {
    res.status(404).json({ error: "race not found" });
    return;
  }
  if (race.format !== "tactic" && race.format !== "gp_final") {
    res.status(400).json({ error: "actions only allowed in tactic/GP final races" });
    return;
  }

  // Calculate GDA cost: load all prior actions for this race to rebuild GDA state
  const priorActions = db.prepare(
    "SELECT action_type, tick FROM tactic_actions WHERE race_id = ? ORDER BY id ASC"
  ).all(raceId) as any[];

  let gdaState = createGDAState();
  for (const pa of priorActions) {
    gdaState = applyGDAPurchase(gdaState, pa.action_type, pa.tick);
  }
  const cost = getGDAPrice(gdaState, actionType, tick);

  const balance = db.prepare("SELECT balance FROM coin_balances WHERE wallet = ?").get(wallet) as any;
  const currentBalance = balance?.balance || 0;

  if (currentBalance < cost) {
    res.status(400).json({ error: "insufficient balance", cost, current: currentBalance });
    return;
  }

  const submitAction = db.transaction(() => {
    db.prepare(
      "UPDATE coin_balances SET balance = balance - ?, updated_at = datetime('now') WHERE wallet = ?"
    ).run(cost, wallet);

    db.prepare(
      "INSERT INTO transactions (wallet, type, amount, description) VALUES (?, 'tactic_action', ?, ?)"
    ).run(wallet, -cost, `${actionType} in ${raceId} at tick ${tick}`);

    db.prepare(
      "INSERT INTO tactic_actions (race_id, snail_id, wallet, action_type, tick) VALUES (?, ?, ?, ?, ?)"
    ).run(raceId, snailId, wallet, actionType, tick);
  });

  submitAction();

  const newBalance = db.prepare("SELECT balance FROM coin_balances WHERE wallet = ?").get(wallet) as any;

  res.json({
    raceId,
    actionType,
    tick,
    cost,
    newBalance: newBalance?.balance || 0,
  });
});

// POST /api/race/gp/create — Create a Grand Prix (3-stage)
router.post("/gp/create", (req: Request, res: Response) => {
  const raceId = generateRaceId();
  const qualifyId = `${raceId}_q`;
  const finalId = `${raceId}_f`;

  // Qualifying: 8 snails (standard mode), entry fee = GP entry fee
  db.prepare(
    "INSERT INTO races (id, format, entry_fee, max_raise, status) VALUES (?, 'gp_qualify', 150, 300, 'lobby')"
  ).run(qualifyId);

  // Final: will be created after qualifying
  // Store GP metadata in a simple way: use the race id pattern
  res.status(201).json({
    gpId: raceId,
    qualifyRaceId: qualifyId,
    finalRaceId: finalId,
    stage: 'qualifying',
    entryFee: 150,
    maxRaise: 300,
  });
});

// POST /api/race/gp/advance — Advance GP from qualifying to final
router.post("/gp/advance", (req: Request, res: Response) => {
  const { qualifyRaceId } = req.body;

  const race = db.prepare("SELECT * FROM races WHERE id = ?").get(qualifyRaceId) as any;
  if (!race || race.status !== 'finished') {
    res.status(400).json({ error: "qualifying race not finished yet" });
    return;
  }

  // Get top 4 finishers
  const finishers = db.prepare(
    `SELECT rp.*, s.name, s.spd, s.acc, s.sta, s.agi, s.ref, s.lck
     FROM race_participants rp
     JOIN slugs s ON rp.snail_id = s.id
     WHERE rp.race_id = ?
     ORDER BY rp.finish_position ASC
     LIMIT 4`
  ).all(qualifyRaceId) as any[];

  // Create final race (tactic mode with GDA)
  const finalId = qualifyRaceId.replace('_q', '_f');
  db.prepare(
    "INSERT INTO races (id, format, entry_fee, max_raise, status) VALUES (?, 'gp_final', 0, 300, 'bidding')"
  ).run(finalId);

  // Move top 4 to final
  for (const f of finishers) {
    db.prepare(
      "INSERT INTO race_participants (race_id, snail_id, wallet, is_bot) VALUES (?, ?, ?, ?)"
    ).run(finalId, f.snail_id, f.wallet, f.is_bot);
  }

  const qualifiers = finishers.map((f: any, i: number) => ({
    id: f.snail_id,
    name: f.name,
    wallet: f.wallet,
    position: i + 1,
    isBot: f.is_bot === 1,
  }));

  res.json({
    finalRaceId: finalId,
    qualifiers,
    stage: 'break',
  });
});

// POST /api/race/predict — Predict race winner
router.post("/predict", (req: Request, res: Response) => {
  const { raceId, wallet, snailId } = req.body;

  if (!raceId || !wallet || !snailId) {
    res.status(400).json({ error: "raceId, wallet, and snailId required" });
    return;
  }

  const race = db.prepare("SELECT * FROM races WHERE id = ?").get(raceId) as any;
  if (!race || race.status === "finished") {
    res.status(400).json({ error: "race not found or already finished" });
    return;
  }

  // Check if already predicted
  const existing = db.prepare(
    "SELECT id FROM predictions WHERE race_id = ? AND wallet = ?"
  ).get(raceId, wallet);
  if (existing) {
    res.status(409).json({ error: "already predicted for this race" });
    return;
  }

  db.prepare(
    "INSERT INTO predictions (race_id, wallet, predicted_snail_id) VALUES (?, ?, ?)"
  ).run(raceId, wallet, snailId);

  res.json({ predicted: true, raceId, snailId });
});

// GET /api/race/:id/predictions — Get predictions for a race
router.get("/:id/predictions", (req: Request, res: Response) => {
  const { id } = req.params;

  const predictions = db.prepare(
    "SELECT p.*, s.name as snail_name FROM predictions p JOIN slugs s ON p.predicted_snail_id = s.id WHERE p.race_id = ?"
  ).all(id);

  res.json({ predictions });
});

// GET /api/race/:id/prices — Get current GDA prices for a tactic race
router.get("/:id/prices", (req: Request, res: Response) => {
  const { id } = req.params;
  const tick = parseInt(req.query.tick as string) || 0;

  const priorActions = db.prepare(
    "SELECT action_type, tick FROM tactic_actions WHERE race_id = ? ORDER BY id ASC"
  ).all(id) as any[];

  let gdaState = createGDAState();
  for (const pa of priorActions) {
    gdaState = applyGDAPurchase(gdaState, pa.action_type, pa.tick);
  }

  res.json({
    boostPrice: getGDAPrice(gdaState, "boost", tick),
    shellPrice: getGDAPrice(gdaState, "shell", tick),
    boostPurchases: gdaState.boostPurchases,
    shellPurchases: gdaState.shellPurchases,
  });
});

// GET /api/race/history/:wallet — Race history for a wallet
router.get("/history/:wallet", (req: Request, res: Response) => {
  const { wallet } = req.params;

  const races = db.prepare(`
    SELECT r.id as raceId, r.format, r.created_at as createdAt,
           rp.finish_position as position, rp.payout, s.name as snailName
    FROM race_participants rp
    JOIN races r ON rp.race_id = r.id
    JOIN slugs s ON rp.snail_id = s.id
    WHERE rp.wallet = ? AND r.status = 'finished'
    ORDER BY r.finished_at DESC
    LIMIT 20
  `).all(wallet) as any[];

  const totalRaces = races.length;
  const totalWins = races.filter(r => r.position === 1).length;
  const winRate = totalRaces > 0 ? Math.round((totalWins / totalRaces) * 100) : 0;
  const totalEarnings = races.reduce((sum: number, r: any) => sum + (r.payout || 0), 0);

  res.json({
    races,
    summary: { totalRaces, winRate, totalEarnings },
  });
});

// GET /api/race/:id — Get race status
router.get("/:id", (req: Request, res: Response) => {
  const { id } = req.params;

  const race = db.prepare("SELECT * FROM races WHERE id = ?").get(id) as any;
  if (!race) {
    res.status(404).json({ error: "race not found" });
    return;
  }

  const participants = db.prepare(
    `SELECT rp.*, s.name, s.rarity, s.race as snail_race, s.spd, s.acc, s.sta, s.agi, s.ref, s.lck
     FROM race_participants rp
     JOIN slugs s ON rp.snail_id = s.id
     WHERE rp.race_id = ?
     ORDER BY COALESCE(rp.grid_position, rp.id)`
  ).all(id);

  res.json({ ...race, participants });
});

export default router;
