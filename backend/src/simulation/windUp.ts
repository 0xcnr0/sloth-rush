/**
 * Wind-Up phase — pure logic.
 *
 * Spec: docs/WIND_UP_PHASE.md. The player holds to wind the spring; releasing
 * locks in a tension. More tension means a better grid slot but faster stamina
 * drain, and winding past the snap point breaks the spring outright.
 *
 * Everything here is deterministic and free of I/O so it can be unit tested and
 * so the race stays reproducible from its seed. The route layer owns clocks,
 * the database and HTTP; this file owns the arithmetic.
 *
 * ALL TUNABLE NUMBERS LIVE IN `WIND_UP_TUNING` BELOW. They are untested
 * starting values from spec §6, not measurements — expect the first playtest to
 * move them. Change them there and nowhere else.
 */

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

export const WIND_UP_TUNING = {
  /** How long the phase window stays open, in milliseconds. */
  phaseDurationMs: 10_000,

  // The client measures its own hold with performance.now() and sends the
  // duration; the server bounds it by the window it actually observed. This
  // slack absorbs one round trip plus scheduling jitter, so an honest player on
  // a slow connection is not taxed for their latency. Claiming MORE than the
  // observed window plus this is refused — you cannot invent time that never
  // elapsed. See docs/WIND_UP_PHASE.md §9.
  holdToleranceMs: 400,

  /** Hold time that takes tension from 0 to the snap point. */
  fullWindMs: 3_500,

  /**
   * Safe Wind = safeWindBase + STA / safeWindStaDivisor, then shifted by the
   * per-race jitter below. At STA 60 that lands near 70%.
   */
  safeWindBase: 55,
  safeWindStaDivisor: 4,

  /**
   * The threshold is nudged by up to this many percentage points each race,
   * derived from the race seed (spec §9). Stops the exact value being
   * precomputed and replayed by a script.
   */
  safeWindJitterPct: 4,

  /** Winding past this breaks the spring. */
  snapPoint: 100,

  /** Each point of tension above Safe Wind adds this much stamina drain. */
  overwindDrainPerPoint: 0.015,

  /** A snapped spring starts the race with this fraction of its stamina. */
  snapStaminaFactor: 0.7,

  /**
   * Pole advantage is acceleration, not distance (spec §8): the four lanes must
   * stay visually level at the start. Front of the grid accelerates harder for
   * the opening ticks.
   */
  poleAccelerationBonus: 0.12,
  poleAccelerationTicks: 40,

  /** Bots aim just under their own Safe Wind. */
  botTensionOffset: -3,
  /** Spread of the bot's aim. Low sigma = disciplined bot, high = sloppy. */
  botSigmaSkilled: 4,
  botSigmaSloppy: 12,

  /** Bots never sit at the absolute extremes. */
  botMinTension: 5,
  botMaxTension: 99,
} as const;

/** Which band a locked-in tension landed in. */
export type WindBand = "under" | "over" | "snapped";

export interface WindOutcome {
  /** Locked tension, 0-100. A snapped spring reports 100. */
  tension: number;
  band: WindBand;
  snapped: boolean;
  /** Multiplies the racer's stamina drain rate. 1 = no penalty. */
  staminaDrainMultiplier: number;
  /** Scales starting stamina. 1 = full, 0.7 after a snap. */
  startStaminaFactor: number;
}

// ---------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------

/**
 * MurmurHash3's finalizer. Its whole job is avalanche: flip one input bit and
 * roughly half the output bits change.
 */
function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Stable 32-bit hash. Same string always gives the same number, on every
 * machine and every run — the race must replay identically from its seed.
 *
 * This deliberately is NOT the `hash * 31 + char` one-liner. That form is
 * near-linear: for a fixed prefix it preserves the relative order of whatever
 * follows, so `seed:grid:1` < `seed:grid:2` held for EVERY seed. Tie-breaks
 * then resolved identically in every race and bots in one race all drew nearly
 * the same tension. Mixing per character and finalising fixes both; the unit
 * tests pin the behaviour so it cannot regress.
 */
function hashString(input: string): number {
  let h = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return fmix32(h ^ input.length);
}

/** Deterministic float in [0, 1) from a seed and a label. */
export function seededUnit(seed: string, label: string): number {
  return hashString(`${seed}:${label}`) / 4294967296;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Safe Wind
// ---------------------------------------------------------------------------

/**
 * The tension above which the spring is overwound for THIS racer in THIS race.
 *
 * Derived from stamina, so a high-STA tank can safely wind further than a
 * fragile speedster — the same input has a different right answer per racer,
 * which is what stops the phase being a pure reflex test (spec §3).
 *
 * The per-race jitter comes from the race seed, so it is verifiable after the
 * fact but not predictable before it.
 */
export function safeWindThreshold(sta: number, seed: string, racerId: number): number {
  const base = WIND_UP_TUNING.safeWindBase + sta / WIND_UP_TUNING.safeWindStaDivisor;
  // seededUnit gives [0,1); map to [-jitter, +jitter].
  const jitter =
    (seededUnit(seed, `safeWind:${racerId}`) * 2 - 1) * WIND_UP_TUNING.safeWindJitterPct;
  // Leave headroom below the snap point so overwinding is always reachable.
  return clamp(base + jitter, 10, WIND_UP_TUNING.snapPoint - 1);
}

/**
 * The band shown to the player instead of the exact line (spec §9). Wide enough
 * that perfect play still carries risk.
 */
export function safeWindDisplayBand(sta: number): { low: number; high: number } {
  const base = WIND_UP_TUNING.safeWindBase + sta / WIND_UP_TUNING.safeWindStaDivisor;
  const j = WIND_UP_TUNING.safeWindJitterPct;
  return {
    low: clamp(base - j, 0, WIND_UP_TUNING.snapPoint),
    high: clamp(base + j, 0, WIND_UP_TUNING.snapPoint),
  };
}

// ---------------------------------------------------------------------------
// Tension
// ---------------------------------------------------------------------------

/**
 * Raw tension from hold duration, uncapped so a snap is detectable.
 * Never let a client supply this — the caller measures the hold.
 */
export function rawTensionFromHold(holdMs: number): number {
  if (!Number.isFinite(holdMs) || holdMs <= 0) return 0;
  return (holdMs / WIND_UP_TUNING.fullWindMs) * WIND_UP_TUNING.snapPoint;
}

/**
 * Resolve a hold into everything the race needs.
 *
 * A player who never touches the screen holds for 0ms and gets minimum tension
 * with no penalty — not touching is a valid, if weak, strategy (spec §4).
 */
/**
 * Decide how long the player actually held, from their own claim and the window
 * the server observed between the press and release requests.
 *
 * The client measures with performance.now() and sends a duration, not a
 * timestamp: monotonic, no clock sync, unaffected by the user's system clock.
 *
 * Stamping both ends server-side would close forgery but tax latency — a player
 * on a slow connection would lose tension they earned, in a mechanic sold as
 * purely skill-based. Bounding keeps the honest player whole while making
 * invented time impossible.
 *
 * Claiming LESS than you held stays possible. What defends against that is the
 * Safe Wind threshold being jittered per race and shown only approximately;
 * this bound sits on top of that, it does not replace it.
 *
 * @param claimedMs what the client says it held; NaN/undefined for old clients
 * @param observedMs server-side elapsed time between the press and release
 */
export function boundHold(claimedMs: number, observedMs: number): number {
  const ceiling = Math.min(
    Math.max(0, observedMs) + WIND_UP_TUNING.holdToleranceMs,
    WIND_UP_TUNING.phaseDurationMs
  );
  if (!Number.isFinite(claimedMs) || claimedMs < 0) {
    // No usable claim: fall back to what we saw. The safe reading, not a free max.
    return clamp(observedMs, 0, WIND_UP_TUNING.phaseDurationMs);
  }
  return clamp(claimedMs, 0, ceiling);
}

export function resolveWind(holdMs: number, safeWind: number): WindOutcome {
  const raw = rawTensionFromHold(holdMs);
  const snapped = raw > WIND_UP_TUNING.snapPoint;
  const tension = Math.round(clamp(raw, 0, WIND_UP_TUNING.snapPoint));

  if (snapped) {
    return {
      tension,
      band: "snapped",
      snapped: true,
      staminaDrainMultiplier: overwindDrainMultiplier(WIND_UP_TUNING.snapPoint, safeWind),
      startStaminaFactor: WIND_UP_TUNING.snapStaminaFactor,
    };
  }

  return {
    tension,
    band: tension > safeWind ? "over" : "under",
    snapped: false,
    staminaDrainMultiplier: overwindDrainMultiplier(tension, safeWind),
    startStaminaFactor: 1,
  };
}

/** Stamina drains faster for every point wound past Safe Wind. */
export function overwindDrainMultiplier(tension: number, safeWind: number): number {
  const over = Math.max(0, tension - safeWind);
  return 1 + over * WIND_UP_TUNING.overwindDrainPerPoint;
}

// ---------------------------------------------------------------------------
// Bots
// ---------------------------------------------------------------------------

/**
 * Box-Muller, driven by two deterministic draws so a race replays identically.
 */
function seededNormal(seed: string, label: string, mean: number, sigma: number): number {
  // log(0) is -Infinity, so keep u1 strictly positive.
  const u1 = Math.max(seededUnit(seed, `${label}:u1`), 1e-9);
  const u2 = seededUnit(seed, `${label}:u2`);
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * sigma;
}

/**
 * A bot's locked tension: it aims just under its own Safe Wind and misses by a
 * skill-dependent amount. Sloppy bots sometimes snap, disciplined ones ride the
 * line — which gives the player a readable signal about who they are racing
 * (spec §7).
 */
export function botTension(
  safeWind: number,
  sigma: number,
  seed: string,
  racerId: number
): number {
  const mean = safeWind + WIND_UP_TUNING.botTensionOffset;
  const sample = seededNormal(seed, `botTension:${racerId}`, mean, sigma);
  return Math.round(
    clamp(sample, WIND_UP_TUNING.botMinTension, WIND_UP_TUNING.botMaxTension)
  );
}

/** Sigma for a bot, interpolated from a 0 (sloppy) to 1 (skilled) rating. */
export function botSigmaForSkill(skill: number): number {
  const s = clamp(skill, 0, 1);
  return (
    WIND_UP_TUNING.botSigmaSloppy +
    (WIND_UP_TUNING.botSigmaSkilled - WIND_UP_TUNING.botSigmaSloppy) * s
  );
}

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

export interface GridEntry {
  racerId: number;
  tension: number;
  snapped: boolean;
}

/**
 * Order the grid: highest tension takes pole, snapped springs go to the back
 * regardless of what they wound to, and ties break on the race seed so the
 * result is reproducible and checkable rather than dependent on row order.
 */
export function orderGrid<T extends GridEntry>(entries: T[], seed: string): T[] {
  return [...entries].sort((a, b) => {
    if (a.snapped !== b.snapped) return a.snapped ? 1 : -1;
    if (a.tension !== b.tension) return b.tension - a.tension;
    return seededUnit(seed, `grid:${a.racerId}`) - seededUnit(seed, `grid:${b.racerId}`);
  });
}

/**
 * Acceleration bonus for a grid slot. Pole gets the most; it decays to zero by
 * the back of the grid. Applied for the opening ticks only, so the lanes stay
 * level at the start line (spec §8).
 */
export function poleAccelerationBonus(gridPosition: number, fieldSize: number): number {
  if (fieldSize <= 1) return 0;
  const rank = clamp(gridPosition, 1, fieldSize);
  const share = (fieldSize - rank) / (fieldSize - 1); // 1 at pole, 0 at the back
  return WIND_UP_TUNING.poleAccelerationBonus * share;
}
