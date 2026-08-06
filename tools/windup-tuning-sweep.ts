/**
 * Wind-Up tuning sweep — measurement only (WIND_UP_PHASE.md §13).
 *
 * §6 marked one point as critical and never measured it: the pole advantage
 * must exceed the stamina cost of overwinding by *a little* — enough that
 * risking the red zone is rational, not so much that everyone does it. A cell
 * of the grid is correct when all three strategies stay viable.
 *
 * This script CHANGES NOTHING. It sweeps candidate values in memory, runs races
 * and reports win rates. `backend/src/simulation/windUp.ts` keeps its committed
 * defaults; the override below is scoped to this process.
 *
 *   npx tsx tools/windup-tuning-sweep.ts [--races N] [--stats fixed|varied]
 *                                        [--jitter N] [--csv path]
 */

import {
  WIND_UP_TUNING,
  botSigmaForSkill,
  botTension,
  orderGrid,
  overwindDrainMultiplier,
  safeWindDisplayBand,
  safeWindThreshold,
} from "../backend/src/simulation/windUp";
import { simulateRace, type RacerStats } from "../backend/src/simulation/engine";
import { SPRINT_LENGTH, ENDURANCE_LENGTH } from "../backend/src/simulation/formats";

// ---------------------------------------------------------------------------
// Sweep axes
// ---------------------------------------------------------------------------

/** Acceleration bonus at pole, decaying to zero at the back of the grid. */
const POLE_BONUS_AXIS = [0.0, 0.04, 0.08, 0.12, 0.16, 0.2, 0.28, 0.4];

/** Extra stamina drain per tension point above Safe Wind. */
// Re-cut fine at the low end after the fatigue model was rebuilt (2026-08-06).
// Fatigue is now absolute rather than a fraction of the track, so the overwind
// drain multiplier compounds against a much steeper curve: every penalty at or
// above 0.005 wiped the red strategy out entirely at Sprint distance. The
// interesting region moved down by roughly an order of magnitude.
const OVERWIND_PENALTY_AXIS = [0.0, 0.0005, 0.001, 0.002, 0.003, 0.005, 0.01, 0.02];

const COMMITTED_POLE = WIND_UP_TUNING.poleAccelerationBonus; // 0.12
const COMMITTED_PENALTY = WIND_UP_TUNING.overwindDrainPerPoint; // 0.015

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

/**
 * Strategies aim relative to the band the player can actually see. The true
 * threshold is jittered per race and never shown (§9), so "wind to the line"
 * genuinely lands over it about half the time. That uncertainty is the
 * mechanic, not noise to be designed away.
 */
type StrategyName = "clean" | "edge" | "red";

const STRATEGIES: { name: StrategyName; label: string; aim: (bandCenter: number) => number }[] = [
  { name: "clean", label: "temiz kur", aim: (c) => c - 15 },
  { name: "edge", label: "sınırda kur", aim: (c) => c },
  { name: "red", label: "kırmızıya kur", aim: () => 97 },
];

// ---------------------------------------------------------------------------
// Racers
// ---------------------------------------------------------------------------

const BASE_STATS = { spd: 18, acc: 18, sta: 18, agi: 18, ref: 18, lck: 18 };

/**
 * Deterministic per-run RNG so a sweep is reproducible from --seed.
 * mulberry32, same family the engine uses.
 */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller from a supplied uniform source. */
function normal(rng: () => number, mean: number, sigma: number): number {
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  return mean + Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// ---------------------------------------------------------------------------
// One race
// ---------------------------------------------------------------------------

interface CellResult {
  wins: Record<StrategyName | "bot", number>;
  snaps: Record<StrategyName, number>;
  races: number;
}

function runRace(
  seed: string,
  rng: () => number,
  executionJitter: number,
  statsMode: "fixed" | "varied",
  statSigma: number
): { winner: StrategyName | "bot"; snapped: Record<StrategyName, boolean> } {
  // Rotate which racer id carries which strategy so no strategy is permanently
  // stuck with one id's jitter draw or tie-break position.
  const rotation = Math.floor(rng() * 3);

  const entries: {
    racerId: number;
    strategy: StrategyName | "bot";
    tension: number;
    snapped: boolean;
    stats: typeof BASE_STATS;
    drainMul: number;
  }[] = [];

  for (let slot = 0; slot < 4; slot++) {
    const racerId = slot + 1;
    const stats = { ...BASE_STATS };
    if (statsMode === "varied") {
      // Spread across the real stat range: 10 at mint, 35 at the legendary cap.
      for (const k of Object.keys(stats) as (keyof typeof stats)[]) {
        stats[k] = Math.round(clamp(normal(rng, 20, statSigma), 10, 35));
      }
    }

    const trueSafeWind = safeWindThreshold(stats.sta, seed, racerId);
    const band = safeWindDisplayBand(stats.sta);
    const bandCenter = (band.low + band.high) / 2;

    let strategy: StrategyName | "bot";
    let intended: number;

    if (slot === 3) {
      // A bot fills the fourth slot, as it does in a real race. It uses the
      // shipped bot model at mid skill — not a hand-rolled approximation, which
      // in an earlier run made the bot sharper than any real bot and let it eat
      // ~35% of races, flattening every cell into a false pass.
      strategy = "bot";
      intended = botTension(trueSafeWind, botSigmaForSkill(0.5), seed, racerId);
    } else {
      const s = STRATEGIES[(slot + rotation) % 3];
      strategy = s.name;
      intended = s.aim(bandCenter);
    }

    // Human execution is not perfect. With jitter 0 this measures a theoretical
    // ceiling; with jitter > 0 the red strategy carries real snap risk, which is
    // the trade the mechanic is built on. The bot's spread is already baked into
    // botTension, so it is not jittered twice.
    const executed =
      strategy !== "bot" && executionJitter > 0 ? normal(rng, intended, executionJitter) : intended;

    const snapped = executed > WIND_UP_TUNING.snapPoint;
    const tension = Math.round(clamp(executed, 0, WIND_UP_TUNING.snapPoint));

    entries.push({
      racerId,
      strategy,
      tension,
      snapped,
      stats,
      drainMul: overwindDrainMultiplier(snapped ? WIND_UP_TUNING.snapPoint : tension, trueSafeWind),
    });
  }

  const ordered = orderGrid(entries, seed);
  const participants: RacerStats[] = ordered.map((e, i) => ({
    id: e.racerId,
    name: String(e.strategy),
    wallet: `w${e.racerId}`,
    isBot: e.strategy === "bot",
    ...e.stats,
    gridPosition: i + 1,
    windTension: e.tension,
    staminaDrainMultiplier: e.drainMul,
    startStaminaFactor: e.snapped ? WIND_UP_TUNING.snapStaminaFactor : 1,
  }));

  const result = simulateRace(participants, seed, [], false, TRACK_DISTANCE);
  const winnerId = result.finalOrder[0].id;
  const winner = entries.find((e) => e.racerId === winnerId)!.strategy;

  const snappedBy = { clean: false, edge: false, red: false } as Record<StrategyName, boolean>;
  for (const e of entries) {
    if (e.strategy !== "bot" && e.snapped) snappedBy[e.strategy] = true;
  }

  return { winner, snapped: snappedBy };
}

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

function runCell(
  poleBonus: number,
  penalty: number,
  races: number,
  executionJitter: number,
  statsMode: "fixed" | "varied",
  statSigma: number,
  seedBase: number
): CellResult {
  // Scoped override — the committed defaults on disk are untouched.
  (WIND_UP_TUNING as any).poleAccelerationBonus = poleBonus;
  (WIND_UP_TUNING as any).overwindDrainPerPoint = penalty;

  const cell: CellResult = {
    wins: { clean: 0, edge: 0, red: 0, bot: 0 },
    snaps: { clean: 0, edge: 0, red: 0 },
    races,
  };

  const rng = makeRng(seedBase);
  for (let i = 0; i < races; i++) {
    const seed = `sweep-${seedBase}-${i}`;
    const { winner, snapped } = runRace(seed, rng, executionJitter, statsMode, statSigma);
    cell.wins[winner]++;
    for (const s of ["clean", "edge", "red"] as StrategyName[]) if (snapped[s]) cell.snaps[s]++;
  }
  return cell;
}

function pct(n: number, total: number): number {
  return total === 0 ? 0 : (n / total) * 100;
}

/**
 * A cell survives when no strategy dominates. §13 sets the bar at 50%: with
 * three strategies plus a bot in a four-racer field, chance is 25% each, so 50%
 * means winning twice as often as chance.
 *
 * The share among the three player strategies alone is reported too, since a
 * reader may reasonably think of dominance as "more than half of the races a
 * player won", where chance is 33%.
 */
function verdict(cell: CellResult) {
  const strategyWins = cell.wins.clean + cell.wins.edge + cell.wins.red;
  const rates = {
    clean: pct(cell.wins.clean, cell.races),
    edge: pct(cell.wins.edge, cell.races),
    red: pct(cell.wins.red, cell.races),
    bot: pct(cell.wins.bot, cell.races),
  };
  const shares = {
    clean: pct(cell.wins.clean, strategyWins),
    edge: pct(cell.wins.edge, strategyWins),
    red: pct(cell.wins.red, strategyWins),
  };
  const topShare = Math.max(shares.clean, shares.edge, shares.red);
  const bottomShare = Math.min(shares.clean, shares.edge, shares.red);
  return {
    rates,
    shares,
    // §13: "a strategy over 50% eliminates the cell". Applied to share of player
    // wins, where three equal strategies sit at 33%. Applying it to the raw rate
    // instead would make the bar unreachable, since a fourth racer caps any
    // single strategy near 40% by construction.
    dominated: topShare > 50,
    // NOT a §13 rule — added because §13 also asks that all three stay VIABLE,
    // and a strategy nobody would pick is dead even when nothing dominates.
    starved: bottomShare < 20,
    spread: topShare - bottomShare,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Distance the sweep measures at. V1 ships two, and the Wind-Up trade-off is
 * a stamina trade-off, so a verdict is only valid for the distance it was
 * measured on — `--distance 3200` re-runs the whole grid for Endurance.
 */
let TRACK_DISTANCE = SPRINT_LENGTH;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const races = parseInt(arg("races", "1200"), 10);
  const statsMode = arg("stats", "fixed") as "fixed" | "varied";
  const jitter = parseFloat(arg("jitter", "3"));
  const statSigma = parseFloat(arg("statsigma", "6"));
  const seedBase = parseInt(arg("seed", "12345"), 10);
  const csvPath = arg("csv", "");
  TRACK_DISTANCE = parseInt(arg("distance", String(SPRINT_LENGTH)), 10);

  console.log("Wind-Up tuning sweep — measurement only, nothing is written back.");
  console.log(
    `races/cell=${races}  stats=${statsMode}${statsMode === "varied" ? ` (sigma ${statSigma})` : ""}  executionJitter=${jitter}  seed=${seedBase}`
  );
  console.log(
    `field: clean + edge + red + 1 bot. Chance = 25% per racer. Committed cell: pole=${COMMITTED_POLE} penalty=${COMMITTED_PENALTY}\n` +
    `distance=${TRACK_DISTANCE}${TRACK_DISTANCE === SPRINT_LENGTH ? " (Sprint)" : TRACK_DISTANCE === ENDURANCE_LENGTH ? " (Endurance)" : ""}\n`
  );

  const csvRows: string[] = [
    "pole_bonus,overwind_penalty,clean_pct,edge_pct,red_pct,bot_pct,clean_share,edge_share,red_share,red_snap_pct,spread,survives",
  ];

  const survivors: { pole: number; penalty: number; v: ReturnType<typeof verdict> }[] = [];

  // Header
  const head = ["pole \\ pen".padEnd(11), ...OVERWIND_PENALTY_AXIS.map((p) => p.toFixed(3).padStart(17))];
  console.log(head.join(""));

  for (const pole of POLE_BONUS_AXIS) {
    const cells: string[] = [pole.toFixed(2).padEnd(11)];
    for (const penalty of OVERWIND_PENALTY_AXIS) {
      const cell = runCell(pole, penalty, races, jitter, statsMode, statSigma, seedBase);
      const v = verdict(cell);
      const mark = v.dominated ? " " : v.starved ? "." : "*";
      cells.push(
        `${v.shares.clean.toFixed(0)}/${v.shares.edge.toFixed(0)}/${v.shares.red.toFixed(0)}${mark}`.padStart(17)
      );
      if (!v.dominated && !v.starved) survivors.push({ pole, penalty, v });
      csvRows.push(
        [
          pole,
          penalty,
          v.rates.clean.toFixed(2),
          v.rates.edge.toFixed(2),
          v.rates.red.toFixed(2),
          v.rates.bot.toFixed(2),
          v.shares.clean.toFixed(2),
          v.shares.edge.toFixed(2),
          v.shares.red.toFixed(2),
          pct(cell.snaps.red, cell.races).toFixed(2),
          v.spread.toFixed(2),
          v.dominated ? "no" : "yes",
        ].join(",")
      );
    }
    console.log(cells.join(""));
  }

  console.log("\ncells read clean/edge/red as % share of PLAYER wins (3 equal = 33 each).");
  console.log("  * = all three viable    . = nothing dominates but one is starved (<20%)    blank = one strategy over 50%\n");

  // Restore the committed values so nothing downstream sees the sweep's state.
  (WIND_UP_TUNING as any).poleAccelerationBonus = COMMITTED_POLE;
  (WIND_UP_TUNING as any).overwindDrainPerPoint = COMMITTED_PENALTY;

  console.log(`Cells keeping all three strategies alive: ${survivors.length} of ${POLE_BONUS_AXIS.length * OVERWIND_PENALTY_AXIS.length}`);
  const balanced = survivors
    .slice()
    .sort((a, b) => a.v.spread - b.v.spread)
    .slice(0, 12);
  console.log("\nMost balanced surviving cells (smallest gap in share terms):");
  console.log("  pole   penalty  share clean/edge/red   raw clean/edge/red   bot   spread");
  for (const s of balanced) {
    console.log(
      `  ${s.pole.toFixed(2).padEnd(6)} ${s.penalty.toFixed(3).padEnd(8)} ` +
        `${s.v.shares.clean.toFixed(0).padStart(6)}/${s.v.shares.edge.toFixed(0)}/${s.v.shares.red.toFixed(0)}`.padEnd(20) +
        `${s.v.rates.clean.toFixed(0).padStart(6)}/${s.v.rates.edge.toFixed(0)}/${s.v.rates.red.toFixed(0)}`.padEnd(21) +
        `${s.v.rates.bot.toFixed(0).padStart(4)}  ${s.v.spread.toFixed(1).padStart(6)}`
    );
  }

  if (csvPath) {
    const fs = await import("node:fs");
    fs.writeFileSync(csvPath, csvRows.join("\n") + "\n");
    console.log(`\nCSV written to ${csvPath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
