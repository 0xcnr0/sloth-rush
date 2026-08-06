/**
 * Deterministic Race Simulation Engine
 *
 * Given a seed and participant stats, produces identical results every time.
 * This engine will be open-sourced for anyone-can-verify.
 */

import { WIND_UP_TUNING, poleAccelerationBonus } from "./windUp";
import { itemMultiplier, type ScheduledItem } from "./items";

// Seeded PRNG (mulberry32) — deterministic random from seed
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash;
}

export interface RacerStats {
  id: number;
  name: string;
  wallet: string;
  isBot: boolean;
  spd: number;
  acc: number;
  sta: number;
  agi: number;
  ref: number;
  lck: number;
  gridPosition: number; // 1 = pole, 4 = last
  passive?: string;
  /**
   * Archetype CODE — speedster / tank / trickster / burst. Never a display
   * name: the label lives in theme.ts (CLAUDE.md §0). The client picks which
   * art folder to draw from this.
   */
  archetype?: string;
  /** Rarity CODE — common…legendary. Visual only; never affects the sim. */
  rarity?: string;

  // --- Wind-Up phase results (see simulation/windUp.ts) ---
  // Optional so an older caller, a replay or the standalone verifier can leave
  // them out and get the pre-Wind-Up behaviour.

  /** Locked spring tension, 0-100. Informational; the grid is already ordered. */
  windTension?: number;
  /** >1 when the racer wound past its Safe Wind and drains stamina faster. */
  staminaDrainMultiplier?: number;
  /** <1 when the spring snapped and the racer starts partly unwound. */
  startStaminaFactor?: number;
}

export interface RaceFrame {
  tick: number;
  positions: { id: number; distance: number; speed: number; event?: string }[];
}

export interface RaceEvent {
  tick: number;
  type: string;
  description: string;
  affectedIds: number[];
}

export interface TacticAction {
  tick: number;
  type: "boost" | "projectile";
  racerId: number;   // who performs the action
  targetId?: number; // for projectile — which racer gets hit (leader if omitted)
}

export type Weather = 'sunny' | 'rainy' | 'windy' | 'foggy' | 'stormy';

export interface RaceResult {
  frames: RaceFrame[];
  events: RaceEvent[];
  finalOrder: { id: number; wallet: string; name: string; isBot: boolean; finishTick: number }[];
  seed: string;
  trackLength: number;
  totalTicks: number;
  weather: Weather;
}

// Determine weather from seed — deterministic
export function getWeatherFromSeed(seed: string): Weather {
  const rng = mulberry32(seedFromString(seed + '_weather'));
  const roll = rng();
  if (roll < 0.40) return 'sunny';
  if (roll < 0.60) return 'rainy';
  if (roll < 0.75) return 'windy';
  if (roll < 0.90) return 'foggy';
  return 'stormy';
}

// --- GDA (Gradual Dutch Auction) Price Engine ---

export interface GDAState {
  boostBasePrice: number;
  projectileBasePrice: number;
  boostPurchases: number;
  projectilePurchases: number;
  lastBoostTick: number;
  lastProjectileTick: number;
}

export function createGDAState(): GDAState {
  return {
    boostBasePrice: 60,   // lowered from 100 — makes tactic mode viable
    projectileBasePrice: 150,  // lowered from 250 — now ~50% of the prize pool, not 100%
    boostPurchases: 0,
    projectilePurchases: 0,
    lastBoostTick: 0,
    lastProjectileTick: 0,
  };
}

/**
 * GDA price formula:
 * currentPrice = basePrice * (scaleFactor ^ totalPurchases) * (decayFactor ^ ticksSinceLastPurchase)
 *
 * Boost: scaleFactor = 1.3 (30% increase per purchase), decayFactor = 0.995 per tick
 * Projectile: scaleFactor = 1.5 (50% increase per purchase), decayFactor = 0.993 per tick
 */
export function getGDAPrice(state: GDAState, actionType: "boost" | "projectile", currentTick: number, chaosMode: boolean = false): number {
  const chaosMul = chaosMode ? 0.5 : 1;
  if (actionType === "boost") {
    const scaleFactor = Math.pow(1.3, state.boostPurchases);
    const ticksSince = currentTick - state.lastBoostTick;
    const decayFactor = Math.pow(0.995, ticksSince);
    return Math.max(15, Math.round(state.boostBasePrice * scaleFactor * decayFactor * chaosMul));
  } else {
    const scaleFactor = Math.pow(1.5, state.projectilePurchases);
    const ticksSince = currentTick - state.lastProjectileTick;
    const decayFactor = Math.pow(0.993, ticksSince);
    return Math.max(30, Math.round(state.projectileBasePrice * scaleFactor * decayFactor * chaosMul));
  }
}

export function applyGDAPurchase(state: GDAState, actionType: "boost" | "projectile", currentTick: number): GDAState {
  if (actionType === "boost") {
    return { ...state, boostPurchases: state.boostPurchases + 1, lastBoostTick: currentTick };
  } else {
    return { ...state, projectilePurchases: state.projectilePurchases + 1, lastProjectileTick: currentTick };
  }
}

// Fallback only. Real races take their distance from the race format
// (backend/src/simulation/formats.ts) — distance is the one lever that
// changes which stat decides the race, so it belongs to the format, not
// to the engine. Callers that omit it are tests and tuning harnesses.
export const DEFAULT_TRACK_LENGTH = 2800; // race distance units

/**
 * Fatigue — the only thing that makes distance a real choice.
 *
 * Two things were wrong here and both are worth naming, because both were
 * invisible while every gate stayed green.
 *
 * 1. The decay coefficient was `0.35 - sta * 0.015`, which reaches the 0.05
 *    floor at STA 20. Every racer in the game sits above 20, so STA 25 and
 *    STA 100 faded at exactly the same rate — six stats were advertised and
 *    one of them did nothing.
 * 2. Fatigue was measured as a fraction of the track (`distance > len * 0.6`),
 *    so a race twice as long faded you over twice the distance at half the
 *    rate. The shape was identical at every distance; a longer track was just
 *    a longer wait.
 *
 * Now it is absolute: everyone runs fresh for `freeDistance`, then fades per
 * `spanDistance` travelled beyond it, at a rate STA actually spans. That makes
 * a long race a genuinely different question from a short one, which is the
 * whole reason for having two.
 *
 * Measure any change with `distanceLever.check.ts` and `fatigueSweep.ts`.
 */
export const FATIGUE = {
  /**
   * Distance covered before anyone starts to fade. Deliberately short: a wound
   * spring starts running down the moment it is released, so a long grace
   * period reads wrong as well as measuring wrong. At 1200 the fade arrived so
   * late that a sprinter had already built an unassailable lead, and the two
   * formats came out identical (-97 vs -99).
   */
  freeDistance: 300,
  /** Each additional span of this distance applies one full `decay` step. */
  spanDistance: 500,
  /** Decay at STA 0. */
  decayAtZeroSta: 0.46,
  /**
   * Subtracted per point of STA — chosen so a maxed-rarity STA (35) lands on
   * the floor. This was 0.0060, scaled for a 0-100 stat range that the game
   * never produces: per-stat caps are 15 and 22-35, so across every racer that
   * can exist the old coefficient spread decay over a band of 0.46 to 0.25 and
   * STA barely separated anyone.
   */
  decayPerSta: 0.0160,
  /** Nobody fades below this, or the tail of a long race stops being a race. */
  minDecay: 0.04,
  /** Hard floor on speed, so a spent racer still crosses the line. */
  minSpeedFactor: 0.30,
} as const;
const TICKS_PER_SECOND = 10;
/**
 * Safety stop, scaled to the distance.
 *
 * This was a flat 1500 ticks, which is fine for a 1600-unit Sprint and not fine
 * for a 3200-unit Endurance: a low-stat racer runs at roughly 4 units/tick and
 * fades from there, so it hit the cap before the line and the race was ranked
 * on an unfinished field. Measured: an Endurance race with a fresh racer ended
 * at exactly 150.0s, which is the cap, not a finish.
 *
 * The floor speed a racer can decay to is maxSpeed * FATIGUE.minSpeedFactor,
 * and the weakest possible maxSpeed is 3, so the slowest anyone crawls is about
 * 0.72 units/tick. Allowing for that exactly would let a hopeless race run for
 * minutes, so this is deliberately a cap and not a guarantee — but it now
 * scales, so the formats behave the same way as each other.
 */
function maxTicksFor(trackLength: number): number {
  return Math.ceil(trackLength / 1.6);
}

// Random events from GDD
const RANDOM_EVENTS = [
  { type: "mass_slow", chance: 0.003, description: "The leader's wind-down is spreading!", stat: "agi" as const },
  { type: "rain", chance: 0.002, description: "Sudden Rain! All speeds dropping!", stat: "sta" as const },
  { type: "luck_orb", chance: 0.0025, description: "Luck Orb appeared!", stat: "lck" as const },
  { type: "collision", chance: 0.0015, description: "Collision! Two racers tangled up!", stat: "ref" as const },
];

export function simulateRace(
  participants: RacerStats[],
  seed: string,
  actions: TacticAction[] = [],
  chaosMode: boolean = false,
  trackLength: number = DEFAULT_TRACK_LENGTH,
  /**
   * Items scheduled onto future ticks. Applying one must never consume
   * randomness — see items.ts. That is what lets the server re-simulate from
   * tick 0 after every submission and still reproduce the frames it has
   * already shown the client.
   */
  items: ScheduledItem[] = []
): RaceResult {
  const maxTicks = maxTicksFor(trackLength);
  const rng = mulberry32(seedFromString(seed));
  const frames: RaceFrame[] = [];
  const events: RaceEvent[] = [];
  const weather = getWeatherFromSeed(seed);

  // Weather modifiers
  const weatherMods = {
    speedMul: weather === 'rainy' ? 0.90 : weather === 'stormy' ? 0.85 : 1.0,
    boostDurMul: weather === 'windy' ? 2.0 : weather === 'stormy' ? 0.5 : 1.0,
    eventFreqMul: weather === 'stormy' ? 2.0 : weather === 'foggy' ? 0.5 : 1.0,
    staMul: weather === 'rainy' ? 1.5 : 1.0, // STA matters more in rain
  };

  // State per racer
  const state = participants.map((p) => ({
    id: p.id,
    wallet: p.wallet,
    name: p.name,
    isBot: p.isBot,
    passive: p.passive || undefined,
    distance: 0,
    speed: 0,
    maxSpeed: (3 + p.spd * 0.15) * weatherMods.speedMul,
    acceleration: 0.3 + p.acc * 0.06,
    // A snapped spring starts the race partly unwound.
    stamina: p.sta * (p.startStaminaFactor ?? 1),
    agility: p.agi,
    reflex: p.ref,
    luck: p.lck,
    gridPosition: p.gridPosition,
    // Overwinding past Safe Wind burns stamina faster for the whole race.
    staminaDrainMultiplier: p.staminaDrainMultiplier ?? 1,
    finished: false,
    finishTick: maxTicks,
    finishOvershoot: 0,
    slowdown: 0,
    boost: 0,
    overtakeBoostEnd: 0,
    prevPosition: p.gridPosition,
  }));

  // Grid advantage is acceleration, not a head start (WIND_UP_PHASE.md §8).
  // All four lanes must stay level at the start line so the broadcast reads as
  // a photo finish; the pole racer instead pulls away harder over the opening
  // ticks. Everyone therefore starts at distance 0.
  const fieldSize = state.length;

  for (let tick = 0; tick < maxTicks; tick++) {
    // Check for random events — chaos mode + weather affect frequency
    const eventInterval = chaosMode ? 5 : 10;
    const leaderDist = Math.max(...state.filter(s => !s.finished).map(s => s.distance));
    const chaosMultiplier = chaosMode && leaderDist > trackLength * 0.7 ? 3 : chaosMode ? 2 : 1;
    if (tick > 30 && tick % eventInterval === 0) {
      for (const event of RANDOM_EVENTS) {
        if (rng() < event.chance * 10 * chaosMultiplier * weatherMods.eventFreqMul) {
          const activeRacers = state.filter((s) => !s.finished);
          if (activeRacers.length < 2) continue;

          const affectedIds: number[] = [];

          if (event.type === "mass_slow") {
            // Leader's wind-down slows everyone behind
            const leader = activeRacers.reduce((a, b) => (a.distance > b.distance ? a : b));
            const others = activeRacers.filter((s) => s.id !== leader.id);
            for (const other of others) {
              const resist = other.agility * 0.1;
              if (rng() > resist / 10) {
                other.slowdown = 15;
                affectedIds.push(other.id);
              }
            }
          } else if (event.type === "rain") {
            // All speeds drop, STA resists (doubled resistance)
            for (const s of activeRacers) {
              const resist = s.stamina * 0.1;
              s.speed *= 0.7 + resist / 10;
              affectedIds.push(s.id);
            }
          } else if (event.type === "luck_orb") {
            // Random racer gets speed boost — rubber band: trailing racers get higher weight
            const maxDist = Math.max(...activeRacers.map(s => s.distance));
            const weights = activeRacers.map((s) => {
              const distBehind = maxDist - s.distance;
              const rubberBand = 1 + distBehind * 0.02; // +2% weight per unit behind
              const dreamCatcherMul = s.passive === 'luck_magnet' ? 1.20 : 1;
              return s.luck * rubberBand * dreamCatcherMul;
            });
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let pick = rng() * totalWeight;
            for (let wi = 0; wi < activeRacers.length; wi++) {
              const s = activeRacers[wi];
              pick -= weights[wi];
              if (pick <= 0) {
                s.boost = Math.round(20 * weatherMods.boostDurMul);
                affectedIds.push(s.id);
                break;
              }
            }
          } else if (event.type === "collision") {
            // Two closest racers clash; REF determines recovery
            const sorted = [...activeRacers].sort((a, b) => a.distance - b.distance);
            for (let i = 0; i < sorted.length - 1; i++) {
              if (Math.abs(sorted[i].distance - sorted[i + 1].distance) < 15) {
                const s1 = sorted[i];
                const s2 = sorted[i + 1];
                s1.slowdown = Math.max(5, 15 - s1.reflex);
                s2.slowdown = Math.max(5, 15 - s2.reflex);
                affectedIds.push(s1.id, s2.id);
                break;
              }
            }
          }

          // misfortune_flip passive: after a bad event, 30% chance to convert to boost
          if (affectedIds.length > 0 && (event.type === 'mass_slow' || event.type === 'rain' || event.type === 'collision')) {
            for (const aid of affectedIds) {
              const affectedRacer = state.find(s => s.id === aid);
              if (affectedRacer && affectedRacer.passive === 'misfortune_flip' && rng() < 0.30) {
                affectedRacer.slowdown = 0;
                affectedRacer.boost = 15;
                events.push({
                  tick,
                  type: 'misfortune_flip',
                  description: `${affectedRacer.name} turned misfortune into speed!`,
                  affectedIds: [aid],
                });
              }
            }
          }

          if (affectedIds.length > 0) {
            events.push({
              tick,
              type: event.type,
              description: event.description,
              affectedIds,
            });
          }
          break; // max 1 event per check
        }
      }
    }

    // Apply tactic actions for this tick
    const tickActions = actions.filter((a) => a.tick === tick);
    for (const action of tickActions) {
      const activeRacers = state.filter((s) => !s.finished);
      if (action.type === "boost") {
        const racer = state.find((s) => s.id === action.racerId);
        if (racer && !racer.finished) {
          racer.boost = Math.round(15 * weatherMods.boostDurMul); // 1.5x speed, weather affects duration
          events.push({
            tick,
            type: "tactic_boost",
            description: `${racer.name} activated BOOST!`,
            affectedIds: [racer.id],
          });
        }
      } else if (action.type === "projectile") {
        // Projectile hits the leader (or targetId)
        const leader = action.targetId
          ? state.find((s) => s.id === action.targetId)
          : activeRacers.reduce((a, b) => (a.distance > b.distance ? a : b));
        const shooter = state.find((s) => s.id === action.racerId);
        if (leader && shooter && leader.id !== shooter.id && !leader.finished) {
          const projectileSlowdown = leader.passive === 'impact_resist' ? 5 : 10;
          leader.slowdown = projectileSlowdown; // speed drops for ticks (reduced by impact_resist)
          leader.speed = leader.passive === 'impact_resist' ? leader.speed * 0.5 : 1;
          events.push({
            tick,
            type: "tactic_projectile",
            description: `${shooter.name} threw a PROJECTILE at ${leader.name}!`,
            affectedIds: [leader.id, shooter.id],
          });
        }
      }
    }

    // Track positions for overtake detection
    const positionsBeforeTick = state
      .filter(s => !s.finished)
      .sort((a, b) => b.distance - a.distance)
      .map(s => s.id);

    // Update each racer
    for (const s of state) {
      if (s.finished) continue;

      // Stamina degradation (after 60% of race) — tripled STA impact, weather affects decay.
      // The Wind-Up multiplier is applied last so overwinding always costs
      // something even for a racer whose decay already floored out.
      const fatigueMul = s.passive === 'fatigue_resist' ? 0.5 : 1;
      const staDecay =
        Math.max(
          FATIGUE.minDecay,
          (FATIGUE.decayAtZeroSta - s.stamina * FATIGUE.decayPerSta * weatherMods.staMul) * fatigueMul
        ) * s.staminaDrainMultiplier;
      // Absolute, not a fraction of the track: distance has to cost something
      // that a longer track charges more of, or the second format is decoration.
      const fadeSpans = Math.max(0, s.distance - FATIGUE.freeDistance) / FATIGUE.spanDistance;
      const staminaFactor = Math.max(FATIGUE.minSpeedFactor, 1 - fadeSpans * staDecay);

      // Passive abilities — speed multiplier
      let passiveSpeedMul = 1;

      // late_surge: last 33% of track +10% speed
      if (s.passive === 'late_surge' && s.distance > trackLength * 0.67) {
        passiveSpeedMul *= 1.10;
      }

      // overtake_boost: after overtaking, 10 tick speed burst
      if (s.overtakeBoostEnd > tick) {
        passiveSpeedMul *= 1.15;
      }

      // Acceleration toward max speed. Grid slot adds a short opening burst
      // rather than a distance head start, so the lanes stay visually level.
      const gridAccelBonus =
        tick < WIND_UP_TUNING.poleAccelerationTicks
          ? poleAccelerationBonus(s.gridPosition, fieldSize)
          : 0;
      // Items multiply the target speed and draw no numbers from `rng`, so the
      // frames before an item's tick come out bit-identical with or without it.
      const isLeader = s.distance >= leaderDist - 1e-9;
      const itemMul = items.length ? itemMultiplier(items, s.id, isLeader, tick) : 1;
      const targetSpeed = s.maxSpeed * staminaFactor * passiveSpeedMul * itemMul;
      if (s.speed < targetSpeed) {
        s.speed = Math.min(targetSpeed, s.speed + (s.acceleration + gridAccelBonus) * 0.1);
      } else {
        s.speed = Math.max(targetSpeed, s.speed - 0.05);
      }

      // Small random variance (seeded)
      s.speed *= 0.97 + rng() * 0.06;

      // Apply temporary modifiers to MOVEMENT only (not base speed) to prevent compounding
      let moveSpeed = s.speed;
      if (s.slowdown > 0) {
        moveSpeed *= 0.3;
        s.slowdown--;
      }
      if (s.boost > 0) {
        moveSpeed *= 1.5;
        s.boost--;
      }

      // Move
      s.distance += moveSpeed;

      // Check finish
      if (s.distance >= trackLength) {
        s.finished = true;
        s.finishTick = tick;
        // Record how far PAST the line this racer went before clamping. Ticks are
        // discrete, so photo finishes land on the same tick constantly — and once
        // distance is clamped to trackLength the tie-break below compares two
        // identical numbers, returns 0, and a stable sort silently falls back to
        // state order, which is grid order. That handed every same-tick finish to
        // whoever started further forward. Overshoot is the real signal: the racer
        // who travelled further past the line crossed it earlier within the tick.
        s.finishOvershoot = s.distance - trackLength;
        s.distance = trackLength;
      }
    }

    // Detect overtakes for overtake_boost passive
    const positionsAfterTick = state
      .filter(s => !s.finished)
      .sort((a, b) => b.distance - a.distance)
      .map(s => s.id);
    for (const s of state) {
      if (s.finished || s.passive !== 'overtake_boost') continue;
      const prevRank = positionsBeforeTick.indexOf(s.id);
      const newRank = positionsAfterTick.indexOf(s.id);
      if (prevRank >= 0 && newRank >= 0 && newRank < prevRank) {
        s.overtakeBoostEnd = tick + 10;
      }
    }

    // Record frame
    frames.push({
      tick,
      positions: state.map((s) => ({
        id: s.id,
        distance: Math.round(s.distance * 100) / 100,
        speed: Math.round(s.speed * 100) / 100,
      })),
    });

    // All finished?
    if (state.every((s) => s.finished)) break;
  }

  // Final order
  const finalOrder = [...state]
    .sort((a, b) => {
      if (a.finishTick !== b.finishTick) return a.finishTick - b.finishTick;
      // Same tick: whoever went further past the line crossed it first. Comparing
      // `distance` here does not work — it is clamped to trackLength on finish,
      // so every photo finish tied at 0 and fell through to grid order.
      return b.finishOvershoot - a.finishOvershoot;
    })
    .map((s, i) => ({
      id: s.id,
      wallet: s.wallet,
      name: s.name,
      isBot: s.isBot,
      finishTick: s.finishTick,
    }));

  return {
    frames,
    events,
    finalOrder,
    seed,
    trackLength: trackLength,
    totalTicks: frames.length,
    weather,
  };
}

// Calculate prize pool distribution per GDD.
// Entry fees are the only source; the pre-race phase costs nothing.
export function calculatePrizePool(
  entryFees: number,
  finishOrder: { id: number; wallet: string; isBot: boolean }[]
): { id: number; wallet: string; reward: number; position: number }[] {
  const platformCut = Math.floor(entryFees * 0.15);
  const distributable = entryFees - platformCut;

  const SHARES = [0.50, 0.30, 0.15, 0.05];

  // Shares are handed out by rank AMONG REAL PLAYERS. Bots hold grid positions
  // and finish alongside everyone, but they neither fund the pool nor take from
  // it, so a bot ahead of you does not cost you a share.
  //
  // The previous version paid every finisher by absolute position and then
  // swept the bots' shares back to the humans proportionally. With one human in
  // the field that meant collecting the entire pool regardless of where they
  // came — measured at 136 back on a 50 entry from a THIRD place finish. Every
  // race was profitable and no result differed from any other.
  let realRank = 0;
  return finishOrder.map((p, index) => {
    if (p.isBot) return { id: p.id, wallet: p.wallet, reward: 0, position: index + 1 };
    const share = SHARES[realRank] ?? 0;
    realRank++;
    return {
      id: p.id,
      wallet: p.wallet,
      reward: Math.floor(distributable * share),
      position: index + 1,
    };
  });
}
