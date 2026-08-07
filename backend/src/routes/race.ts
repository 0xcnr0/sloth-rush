import { Router, Request, Response } from "express";
import crypto from "crypto";
import { query, getOne, getAll, runTransaction } from "../db";
import { simulateRace, RacerStats, TacticAction, mulberry32, seedFromString, TICKS_PER_SECOND } from "../simulation/engine";
import { raceFormat, isPlayableFormat, DEFAULT_FORMAT } from "../simulation/formats";
import { isSchedulable, earliestSchedulableTick, ITEM_TUNING, type ScheduledItem, type ItemCode } from "../simulation/items";
import { tierForStats, totalStats } from "../simulation/evolution";
import { awardXP, XP_AMOUNTS } from "../xp";
import { isValidWallet } from "../middleware/validateWallet";
import { recordRaceResultOnchain } from "../lib/onchain";

const router = Router();

const IS_PRODUCTION =
  process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT === "production";

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
/** Stat added to one stat per finish, and the most a racer can gain in a day. */
const PER_RACE_STAT_GAIN = 0.4;
const DAILY_STAT_CAP = 4.0;

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
// readable signal about who they are up against (ART_DIRECTION §10).
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
    const { format = DEFAULT_FORMAT } = req.body;

    if (!isPlayableFormat(format)) {
      return res.status(400).json({ error: "Unknown race format" });
    }
    const raceConfig = raceFormat(format);
    const raceId = generateRaceId();

    // track_length is stored on the row, not looked up at simulate time: a
    // finished race is replayed from history, and if the format's distance is
    // ever retuned every archived replay would silently re-run at a length it
    // was never raced at.
    await query(
      "INSERT INTO races (id, format, entry_fee, track_length) VALUES ($1, $2, $3, $4)",
      [raceId, format, raceConfig.entry, raceConfig.trackLength]
    );

    res.status(201).json({
      raceId,
      format,
      entryFee: raceConfig.entry,
      trackLength: raceConfig.trackLength,
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

    // A free racer used to be barred from everything except the exhibition
    // format, which made sense when the other formats cost money and paid out.
    // Nothing costs anything now, so the gate only meant that the Wind-Up every
    // new player mints — one per wallet, gasless, the entry point to the whole
    // game — could not enter either of the two real races.

    // Racing is free. Entry fees, the prize pool and the daily-free-race
    // exemption all went with the in-game currency: with bots filling the grid
    // a paid race could not have real stakes — the pool was either minted out
    // of nothing or handed straight back to the only human in it.
    const effectiveFee = 0;

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

    // The loadout is the pre-race decision. It replaces the Wind-Up phase: that
    // asked the player to hold a button accurately, which is a reflex test, not
    // a choice. Two items out of two types is a small question with a real
    // answer — press for yourself, or press against whoever is winning.
    const requested: string[] = Array.isArray(req.body.loadout) ? req.body.loadout : [];
    const valid = requested.filter((c) => c === "boost" || c === "hinder").slice(0, ITEM_TUNING.perRacer);
    while (valid.length < ITEM_TUNING.perRacer) valid.push(valid.length === 0 ? "boost" : "hinder");

    await query(
      "INSERT INTO race_participants (race_id, racer_id, wallet, is_bot, loadout) VALUES ($1, $2, $3, 0, $4)",
      [raceId, parsedRacerId, wallet, valid.join(",")]
    );

    res.json({
      joined: true,
      raceId,
      racerId: parsedRacerId,
      entryFeeCharged: effectiveFee,
    });
  } catch (err) {
    console.error("POST /join error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/race/start — Close the lobby, fill with bots, set the grid from the
// seed, and start the clock the reveal frontier is measured against.
//
// The seed is generated here rather than at simulate time so that the grid and
// the result both verify from one value.
router.post("/start", async (req: Request, res: Response) => {
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
      // Bots must not duplicate an archetype already on the grid — their own or
      // the player's. Two templates share each archetype, so a shuffle picked
      // the same toy twice often enough that a four-lane race regularly showed
      // two identical racers, which defeats the point of having four silhouettes.
      //
      // The pick is also derived from the race id rather than Math.random(): the
      // whole race is meant to be reproducible from a seed, and a random field
      // meant the same seed could not be replayed to the same result.
      const takenArchetypes = new Set<string>();
      for (const p of participants) {
        const r = await getOne("SELECT race FROM racers WHERE id = $1", [p.racer_id]);
        if (r?.race) takenArchetypes.add(r.race);
      }
      const rotate = parseInt(raceId.slice(-4), 16) || 0;
      const ordered = BOT_TEMPLATES.map((_, i) => BOT_TEMPLATES[(i + rotate) % BOT_TEMPLATES.length]);

      for (let i = 0; i < botsNeeded; i++) {
        const template =
          ordered.find(t => !takenArchetypes.has(t.race)) ??
          ordered[(i + rotate) % ordered.length];
        takenArchetypes.add(template.race);
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
      "UPDATE races SET status = 'racing', seed = $1, started_at = NOW() WHERE id = $2",
      [seed, raceId]
    );

    // Grid order comes from the seed. The Wind-Up phase used to decide it by
    // measuring a held button; that phase is gone, and a seeded shuffle keeps
    // the grid verifiable without asking the player to pass a reflex test
    // before every race.
    const allRows = await getAll(
      "SELECT racer_id FROM race_participants WHERE race_id = $1 ORDER BY racer_id",
      [raceId]
    );
    const gridRng = mulberry32(seedFromString(seed + ":grid"));
    const order = allRows.map((r: any) => r.racer_id);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(gridRng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (let i = 0; i < order.length; i++) {
      await query(
        "UPDATE race_participants SET grid_position = $1 WHERE race_id = $2 AND racer_id = $3",
        [i + 1, raceId, order[i]]
      );
    }

    const botRows = await getAll(
      "SELECT racer_id FROM race_participants WHERE race_id = $1 AND is_bot = 1",
      [raceId]
    );

    // Bots use both items at seeded moments. They are not smart about it — the
    // point is that a bot lane is not visibly inert while the player's is.
    const gridIds = await getAll(
      "SELECT racer_id FROM race_participants WHERE race_id = $1",
      [raceId]
    );
    for (const bot of botRows) {
      const r = mulberry32(seedFromString(seed + ":botitems:" + bot.racer_id));
      for (const code of ["boost", "hinder"] as const) {
        const tick = Math.floor(60 + r() * 240);
        // A bot's hinder needs a victim for the same reason a player's does.
        // Picked deterministically from the rest of the grid, so the race stays
        // a function of the seed.
        let target: number | null = null;
        if (code === "hinder") {
          const others = gridIds
            .map((g: any) => g.racer_id)
            .filter((rid: number) => rid !== bot.racer_id);
          target = others.length ? others[Math.floor(r() * others.length)] : null;
        }
        await query(
          "INSERT INTO race_items (race_id, racer_id, wallet, code, target_id, tick) VALUES ($1, $2, $3, $4, $5, $6)",
          [raceId, bot.racer_id, `bot_${bot.racer_id}`, code, target, tick]
        );
      }
    }

    res.json({
      raceId,
      status: "racing",
      botsAdded: botsNeeded,
      startedAt: new Date().toISOString(),
      tickRate: TICKS_PER_SECOND,
    });
  } catch (err) {
    console.error("POST /start-tuning error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


// POST /api/race/simulate — Run the race simulation
/**
 * How far into the race the server has committed. Derived from the server clock
 * and the tick rate — never from anything the client says, because this number
 * is the only thing stopping an item from being scheduled onto a tick the
 * player has already watched.
 */
function revealedTick(race: any): number {
  if (!race?.started_at) return 0;
  const elapsedMs = Date.now() - new Date(race.started_at).getTime();
  return Math.max(0, Math.floor((elapsedMs / 1000) * TICKS_PER_SECOND));
}

// GET /api/race/:id/items — what this racer has left and when it may be used.
/**
 * Dev-only: hand the browser the wallet that owns a racer in this race.
 *
 * Why this exists. The whole in-race decision — deploy an item, server picks
 * the tick — was unreachable without a connected wallet, so it could not be
 * played or looked at locally at all. It was never a real authorisation gate:
 * /item takes a wallet string and compares it to the participant row, with no
 * signature anywhere, so anyone who knows an address can already act for it.
 * This endpoint therefore gives away nothing that endpoint does not, and it
 * refuses to exist in production regardless.
 *
 * When wallet auth is done properly (sign a nonce), this route and the preview
 * identity that uses it both go.
 */
router.get("/:id/preview-identity", async (req: Request, res: Response) => {
  if (IS_PRODUCTION) {
    res.status(404).json({ error: "not found" });
    return;
  }
  try {
    const { id } = req.params;
    const racerId = parseInt(String(req.query.racerId), 10);
    if (!Number.isFinite(racerId)) {
      res.status(400).json({ error: "racerId required" });
      return;
    }
    const participant = await getOne(
      "SELECT wallet FROM race_participants WHERE race_id = $1 AND racer_id = $2",
      [id, racerId]
    );
    if (!participant) {
      res.status(404).json({ error: "racer is not in this race" });
      return;
    }
    res.json({ wallet: participant.wallet });
  } catch (err) {
    console.error("preview-identity failed:", err);
    res.status(500).json({ error: "failed" });
  }
});

router.get("/:id/items", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const racerId = parseInt(String(req.query.racerId), 10);
    const race = await getOne("SELECT * FROM races WHERE id = $1", [id]);
    if (!race) {
      res.status(404).json({ error: "race not found" });
      return;
    }
    const participant = await getOne(
      "SELECT loadout FROM race_participants WHERE race_id = $1 AND racer_id = $2",
      [id, racerId]
    );
    if (!participant) {
      res.status(404).json({ error: "racer is not in this race" });
      return;
    }
    const used = await getAll(
      "SELECT code FROM race_items WHERE race_id = $1 AND racer_id = $2",
      [id, racerId]
    );
    const loadout: string[] = String(participant.loadout || "").split(",").filter(Boolean);
    const remaining = [...loadout];
    for (const u of used) {
      const i = remaining.indexOf(u.code);
      if (i >= 0) remaining.splice(i, 1);
    }
    const frontier = revealedTick(race);
    res.json({
      loadout,
      remaining,
      revealedTick: frontier,
      earliestTick: earliestSchedulableTick(frontier),
      durationTicks: ITEM_TUNING.durationTicks,
    });
  } catch (err) {
    console.error("GET /:id/items error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/race/item — deploy one item from the loadout.
//
// The tick is chosen by the SERVER, not the client: it is the first tick past
// the reveal frontier. A client-supplied tick would let a player drop an item
// into a moment they have already seen, which is exactly the thing that made
// the old Tactic Mode restart the race.
router.post("/item", async (req: Request, res: Response) => {
  try {
    const { raceId, racerId, wallet, code, targetId } = req.body;
    if (!raceId || !racerId || !wallet || !code) {
      res.status(400).json({ error: "raceId, racerId, wallet and code required" });
      return;
    }
    if (code !== "boost" && code !== "hinder") {
      res.status(400).json({ error: "unknown item" });
      return;
    }
    if (!isValidWallet(wallet)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const race = await getOne("SELECT * FROM races WHERE id = $1", [raceId]);
    if (!race || race.status !== "racing") {
      res.status(400).json({ error: "race is not running" });
      return;
    }

    const participant = await getOne(
      "SELECT loadout FROM race_participants WHERE race_id = $1 AND racer_id = $2 AND wallet = $3",
      [raceId, parseInt(String(racerId), 10), wallet]
    );
    if (!participant) {
      res.status(403).json({ error: "not your racer in this race" });
      return;
    }

    const used = await getAll(
      "SELECT code FROM race_items WHERE race_id = $1 AND racer_id = $2",
      [raceId, parseInt(String(racerId), 10)]
    );
    const loadout: string[] = String(participant.loadout || "").split(",").filter(Boolean);
    const carried = loadout.filter((c) => c === code).length;
    const spent = used.filter((u: any) => u.code === code).length;
    if (spent >= carried) {
      res.status(400).json({ error: "no more of that item" });
      return;
    }

    // `hinder` names its victim. It used to hit whoever happened to be leading,
    // which the player did not choose — the only thing they picked was a
    // moment. The target must be someone else in this race.
    let resolvedTarget: number | null = null;
    if (code === "hinder") {
      const parsedTarget = parseInt(String(targetId), 10);
      if (!Number.isFinite(parsedTarget)) {
        res.status(400).json({ error: "targetId required for this item" });
        return;
      }
      if (parsedTarget === parseInt(String(racerId), 10)) {
        res.status(400).json({ error: "cannot target yourself" });
        return;
      }
      const inRace = await getOne(
        "SELECT 1 FROM race_participants WHERE race_id = $1 AND racer_id = $2",
        [raceId, parsedTarget]
      );
      if (!inRace) {
        res.status(400).json({ error: "target is not in this race" });
        return;
      }
      resolvedTarget = parsedTarget;
    }

    const frontier = revealedTick(race);
    const tick = earliestSchedulableTick(frontier);
    if (!isSchedulable(tick, frontier)) {
      res.status(400).json({ error: "cannot schedule into the past" });
      return;
    }

    await query(
      "INSERT INTO race_items (race_id, racer_id, wallet, code, target_id, tick) VALUES ($1, $2, $3, $4, $5, $6)",
      [raceId, parseInt(String(racerId), 10), wallet, code, resolvedTarget, tick]
    );

    res.json({ deployed: true, code, targetId: resolvedTarget, tick, revealedTick: frontier });
  } catch (err) {
    console.error("POST /item error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/simulate", async (req: Request, res: Response) => {
  try {
    const { raceId } = req.body;

    const raceBefore = await getOne("SELECT * FROM races WHERE id = $1", [raceId]);
    if (!raceBefore) {
      res.status(404).json({ error: "race not found" });
      return;
    }

    const race = await getOne("SELECT * FROM races WHERE id = $1", [raceId]);

    // Grid order was written from the seed when the race started; read it back
    // rather than re-deriving it here.
    const participants = await getAll(
      `SELECT rp.*, s.name, s.race, s.rarity, s.spd, s.acc, s.sta, s.agi, s.ref, s.lck, s.passive, s.tier
       FROM race_participants rp
       JOIN racers s ON rp.racer_id = s.id
       WHERE rp.race_id = $1
       ORDER BY COALESCE(rp.grid_position, 99) ASC, rp.id ASC`,
      [raceId]
    );

    // Accessories are gone, so nothing modifies stats at race time. Kept as an
    // empty map rather than threading a removal through the whole builder.
    const accessoryBonuses: Record<number, Record<string, number>> = {};

    // Grid positions are persisted at start; backfill only if something
    // upstream left them null.
    for (let index = 0; index < participants.length; index++) {
      const p = participants[index];
      if (p.grid_position == null) {
        await query("UPDATE race_participants SET grid_position = $1 WHERE id = $2", [index + 1, p.id]);
      }
    }

    const gridded: RacerStats[] = participants.map((p: any, index: number) => {
      const bonus = accessoryBonuses[p.racer_id] || {};
      return {
        archetype: p.race,
        rarity: p.rarity,
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
      };
    });

    // Items deployed so far. The list plus the seed is the whole input to the
    // simulation, which is what lets this endpoint be called repeatedly during
    // a race and keep returning the same frames for the part already shown.
    const itemRows = await getAll(
      "SELECT racer_id, code, target_id, tick FROM race_items WHERE race_id = $1 ORDER BY tick, id",
      [raceId]
    );
    const items: ScheduledItem[] = itemRows.map((r: any) => ({
      racerId: r.racer_id,
      code: r.code as ItemCode,
      targetId: r.target_id ?? undefined,
      tick: r.tick,
    }));

    // Tactic Mode is cut, so no race carries actions. The engine still accepts
    // them; passing an empty list keeps that path exercised by the type system
    // rather than deleted and re-derived later.
    const tacticActions: TacticAction[] = [];

    // Reuse the seed generated when the Wind-Up window opened, so the Safe Wind
    // thresholds the players wound against and the race they produce verify
    // from a single value. Only fall back if the phase was somehow skipped.
    const seed = race.seed || generateSeed();
    const isChaosMode = race.format === "gp_final";
    // The row wins over the format table so replays stay faithful; rows created
    // before track_length existed fall back to their format's distance.
    const trackLength = race.track_length ?? raceFormat(race.format).trackLength;
    const result = simulateRace(gridded, seed, tacticActions, isChaosMode, trackLength, items);

    // No prize pool. Finishing order is recorded and drives stat growth,
    // streaks and the leaderboard; it does not move a balance.
    // Save results
    const resultHash = crypto.createHash("sha256").update(JSON.stringify(result.finalOrder)).digest("hex");
    const winnerWallet = result.finalOrder[0]?.wallet || "";

    /**
     * Settle only when the race is actually over.
     *
     * This used to close the race the moment anyone asked for the frames — and
     * asking for the frames is exactly what the client does when it opens the
     * broadcast to watch. So by the time a player could reach for an item the
     * race was already `finished`, and /item refuses anything that is not
     * `racing`. The in-race decision the whole loadout exists for was
     * unreachable in the product, not only in preview.
     *
     * It survived every gate: the engine tests drive simulateRace directly, and
     * driving the endpoints by curl passes too as long as you deploy before you
     * ever ask to watch. Only clicking the button in a browser finds it.
     *
     * A race is over when its own clock says so — the same server-clock
     * frontier that decides what a player has already seen.
     */
    const lastTick = result.frames[result.frames.length - 1]?.tick ?? 0;
    const raceIsOver = race.status === "finished" || revealedTick(race) >= lastTick;

    if (raceIsOver) await runTransaction(async (client) => {
      // Conditional so two viewers arriving at the line together cannot both
      // award the streaks, XP and race points.
      const settled = await client.query(
        "UPDATE races SET status = 'finished', seed = $1, result_hash = $2, winner_wallet = $3, finished_at = NOW() WHERE id = $4 AND status <> 'finished'",
        [seed, resultHash, winnerWallet, raceId]
      );
      if (settled.rowCount === 0) return;

      for (const order of result.finalOrder) {
        const position = result.finalOrder.indexOf(order) + 1;

        await client.query(
          "UPDATE race_participants SET finish_position = $1, reward = 0 WHERE race_id = $2 AND racer_id = $3",
          [position, raceId, order.id]
        );

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
    }

    // Record race result on-chain (best-effort, non-blocking)
    const raceWinner = result.finalOrder[0];
    if (raceIsOver && raceWinner && !raceWinner.isBot && resultHash) {
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
        }
      }
    }

    // Stat growth. Racing is the ONLY way a racer improves now — training,
    // mini-games, boosters and accessories are all gone — so the rate had to
    // absorb what they used to contribute. It was +0.05 per race capped at
    // +0.3/day, which was tuned when training alone gave +0.5 per session; at
    // that pace a fresh racer (six stats, ~10 each) needed a hundred days to
    // reach the first evolution tier and nobody would ever have seen one.
    //
    // Now +0.4 per finish, capped at +4.0/day, so ten races is a full day's
    // progress and the first tier arrives in about a week of playing. See
    // simulation/evolution.ts for where the tiers themselves land.
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
      if ((dailyGain?.total_gain || 0) >= DAILY_STAT_CAP) continue;

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

      const gain = Math.min(PER_RACE_STAT_GAIN, cap - racer.current_val);
      await query(
        `UPDATE racers SET ${statToGrow} = ${statToGrow} + $1 WHERE id = $2`,
        [gain, entry.id]
      );
      await query(
        "UPDATE daily_stat_gains SET total_gain = total_gain + $1 WHERE racer_id = $2 AND gain_date = $3",
        [gain, entry.id, today]
      );

      // Tier follows the stats, so the racer's form changes the moment racing
      // pushes it over a threshold. Nothing to press, nothing to pay.
      const grown = await getOne(
        "SELECT spd, acc, sta, agi, ref, lck, tier FROM racers WHERE id = $1",
        [entry.id]
      );
      if (grown) {
        const earned = tierForStats(totalStats(grown));
        if (earned !== (grown.tier ?? 0)) {
          await query("UPDATE racers SET tier = $1 WHERE id = $2", [earned, entry.id]);
        }
      }
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
        // Archetype CODE (speedster / tank / trickster / burst). The client
        // picks the art folder from it; without it every racer draws as the
        // same toy. Display labels stay in theme.ts.
        race: g.archetype,
        // Rarity CODE. Purely a surface treatment on the client — it grants no
        // stats, so this is the only thing that makes it visible at all.
        rarity: g.rarity,
        position: g.gridPosition,
        tension: g.windTension ?? 0,
        snapped: (g.startStaminaFactor ?? 1) < 1,
      })),
      frames: animFrames,
      events: result.events,
      finalOrder: result.finalOrder.map((o: any, i: number) => ({
        ...o,
        position: i + 1,
      })),
      trackLength: result.trackLength,
      // Raw tick count, not animFrames.length — the frames are downsampled for
      // playback, so they cannot answer "did this race take longer".
      totalTicks: result.totalTicks,
      weather: result.weather,
    });
  } catch (err) {
    console.error("POST /simulate error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/race/gp/create — Create a Grand Prix (3-stage)
router.post("/gp/create", async (req: Request, res: Response) => {
  try {
    const raceId = generateRaceId();
    const qualifyId = `${raceId}_q`;

    await query(
      "INSERT INTO races (id, format, entry_fee, track_length, status) VALUES ($1, 'gp_qualify', 150, $2, 'lobby')",
      [qualifyId, raceFormat('gp_qualify').trackLength]
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
      "INSERT INTO races (id, format, entry_fee, track_length, status) VALUES ($1, 'gp_final', 0, $2, 'tuning')",
      [finalId, raceFormat('gp_final').trackLength]
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
      "INSERT INTO races (id, format, entry_fee, track_length, status) VALUES ($1, 'exhibition', 0, $2, 'lobby')",
      [raceId, raceFormat('exhibition').trackLength]
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
/**
 * A race only leaves 'racing' when somebody asks for its frames after its
 * clock has run out, so a race nobody watched stays 'racing' in the database
 * forever. Eleven of those had already piled up in testing and every one of
 * them would have been listed as live.
 *
 * The clock is the authority here as well: the longest format runs about a
 * minute, so anything older than three has finished whether or not a row says
 * so. The stale rows themselves are left alone — settling them needs a write,
 * and a GET is the wrong place for one.
 */
router.get("/active", async (_req: Request, res: Response) => {
  try {
    const races = await getAll(
      // Races that are actually running. This asked for 'lobby' and 'tuning'
      // — races that had not started, and a status left over from the retired
      // Wind-Up phase — while the spectate screen labelled every row LIVE with
      // a pulsing dot. Watching a live race opened one that was standing still.
      //
      // The count is aliased to camelCase because that is what both readers
      // ask for; as participant_count it never matched and every row printed
      // '?' rather than a number.
      `SELECT r.*, COUNT(rp.id) AS "participantCount"
       FROM races r
       LEFT JOIN race_participants rp ON r.id = rp.race_id
       WHERE r.status = 'racing'
         AND r.started_at IS NOT NULL
         AND r.started_at > NOW() - INTERVAL '3 minutes'
       GROUP BY r.id
       ORDER BY r.started_at DESC NULLS LAST
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
