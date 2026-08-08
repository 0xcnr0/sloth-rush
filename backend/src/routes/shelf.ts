import { Router, Request, Response } from "express";
import { getAll, getOne } from "../db";
import { isValidWallet } from "../middleware/validateWallet";
import { TIER_THRESHOLDS, totalStats, tierForStats } from "../simulation/evolution";
import { statCapFor } from "../progression";

/**
 * The shelf, and the passport that goes with each toy on it.
 *
 * A collector's object is not just its picture. Condition, and where it has
 * been, are most of what makes one worth more than an identical one — and this
 * game already records all of it and shows none of it. Every number below was
 * already in the database: how many races, how many wins, the first win, the
 * longest streak, the day it was minted, the shape it grew into. Nothing here
 * is a new mechanic. It is the game finally saying out loud what it has been
 * writing down.
 *
 * Two rules this file follows:
 *
 *   1. DERIVE, DO NOT COPY. Everything except the moment of a form change is
 *      computed from race history at read time. A passport that caches its own
 *      totals is a passport that will one day disagree with the race log, and
 *      the whole point of provenance is that it is checkable.
 *
 *   2. PUBLIC BY DEFAULT. A shelf nobody can look at is a drawer. These routes
 *      take a wallet in the path and require no authentication, because they
 *      return nothing that is not already public: a wallet address, its toys,
 *      and races that are already written to the chain.
 */
const router = Router();

/** One row per race this racer has finished, newest first. */
async function raceLog(racerId: number) {
  return getAll(
    `SELECT r.id AS race_id, r.format, r.track_length, r.created_at, r.finished_at,
            rp.finish_position, rp.grid_position
       FROM race_participants rp
       JOIN races r ON r.id = rp.race_id
      WHERE rp.racer_id = $1 AND rp.finish_position IS NOT NULL
      ORDER BY r.created_at DESC`,
    [racerId]
  );
}

/**
 * A racer's passport: what it is, and everywhere it has been.
 *
 * `history` is the derived part and `milestones` is the recorded part. They are
 * kept separate on purpose so a reader can tell which is which — the derived
 * half can be recomputed from the race log by anyone, the recorded half cannot.
 */
async function passportFor(racer: any) {
  const log = await raceLog(racer.id);
  const streak = await getOne("SELECT * FROM streaks WHERE racer_id = $1", [racer.id]);
  const milestones = await getAll(
    "SELECT kind, detail, race_id, created_at FROM racer_milestones WHERE racer_id = $1 ORDER BY created_at",
    [racer.id]
  );

  const finished = log.length;
  const wins = log.filter((r: any) => r.finish_position === 1).length;
  const firstRace = log[finished - 1] ?? null;
  const firstWin = [...log].reverse().find((r: any) => r.finish_position === 1) ?? null;
  const bestFinish = finished ? Math.min(...log.map((r: any) => r.finish_position)) : null;

  // Which distance this racer has run most. A toy that has only ever run one of
  // them is a specialist, and that is worth saying on the card.
  const byFormat: Record<string, number> = {};
  for (const r of log) byFormat[r.format] = (byFormat[r.format] || 0) + 1;
  const favourite =
    Object.entries(byFormat).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const stats = {
    spd: Number(racer.spd), acc: Number(racer.acc), sta: Number(racer.sta),
    agi: Number(racer.agi), ref: Number(racer.ref), lck: Number(racer.lck),
  };
  const total = totalStats(stats);
  const tier = tierForStats(total);
  const next = TIER_THRESHOLDS.find((t) => total < t) ?? null;

  return {
    id: racer.id,
    name: racer.name,
    type: racer.type,
    /** Codes, never labels — the client renders them through theme.ts. */
    archetype: racer.race ?? null,
    rarity: racer.rarity ?? null,
    tier,
    stats,
    statTotal: Math.round(total * 10) / 10,
    statCap: statCapFor(racer.type, racer.rarity),
    nextFormAt: next,
    mintedAt: racer.created_at,
    history: {
      races: finished,
      wins,
      // Rounded here rather than in the client so every screen that shows it
      // shows the same number.
      winRate: finished ? Math.round((wins / finished) * 100) : 0,
      bestFinish,
      bestStreak: Number(streak?.max_wins ?? 0),
      currentStreak: Number(streak?.current_wins ?? 0),
      favouriteFormat: favourite,
      firstRaceAt: firstRace?.created_at ?? null,
      firstWinAt: firstWin?.created_at ?? null,
    },
    milestones,
  };
}

/** GET /api/shelf/:wallet — every toy this wallet owns, with its passport. */
router.get("/:wallet", async (req: Request, res: Response) => {
  try {
    const wallet = String(req.params.wallet);
    if (!isValidWallet(wallet)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    // Burned racers are deliberately excluded. A Wind-Up that was upgraded no
    // longer exists — the Showcase standing in its place is the same object's
    // next life, and showing both would put two toys on the shelf where the
    // player only ever had one.
    const racers = await getAll(
      "SELECT * FROM racers WHERE wallet = $1 AND is_burned = 0 ORDER BY created_at",
      [wallet]
    );

    const shelf = [];
    for (const racer of racers) shelf.push(await passportFor(racer));

    const races = shelf.reduce((a, r) => a + r.history.races, 0);
    const wins = shelf.reduce((a, r) => a + r.history.wins, 0);

    res.json({
      wallet,
      racers: shelf,
      // Wallet-level totals, because a shelf is judged as a whole.
      totals: { racers: shelf.length, races, wins, winRate: races ? Math.round((wins / races) * 100) : 0 },
    });
  } catch (err) {
    console.error("GET /shelf/:wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /api/shelf/racer/:id — one toy's passport, for a share card or a link. */
router.get("/racer/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "Invalid racer id" });
      return;
    }
    const racer = await getOne("SELECT * FROM racers WHERE id = $1 AND is_burned = 0", [id]);
    if (!racer) {
      res.status(404).json({ error: "racer not found" });
      return;
    }
    res.json({ racer: await passportFor(racer), wallet: racer.wallet });
  } catch (err) {
    console.error("GET /shelf/racer/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
