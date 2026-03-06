/**
 * Sloth Rush — Deterministic Race Simulation Engine
 *
 * Given a seed and participant stats, produces identical results every time.
 * This engine will be open-sourced for anyone-can-verify.
 */

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

export interface SlothStats {
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
  type: "boost" | "pillow";
  slothId: number;   // who performs the action
  targetId?: number; // for pillow — which sloth gets hit (leader if omitted)
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
  pillowBasePrice: number;
  boostPurchases: number;
  pillowPurchases: number;
  lastBoostTick: number;
  lastPillowTick: number;
}

export function createGDAState(): GDAState {
  return {
    boostBasePrice: 60,   // lowered from 100 — makes tactic mode viable
    pillowBasePrice: 150, // lowered from 250 — pillow is now ~50% of pot, not 100%
    boostPurchases: 0,
    pillowPurchases: 0,
    lastBoostTick: 0,
    lastPillowTick: 0,
  };
}

/**
 * GDA price formula:
 * currentPrice = basePrice * (scaleFactor ^ totalPurchases) * (decayFactor ^ ticksSinceLastPurchase)
 *
 * Boost: scaleFactor = 1.3 (30% increase per purchase), decayFactor = 0.995 per tick
 * Pillow: scaleFactor = 1.5 (50% increase per purchase), decayFactor = 0.993 per tick
 */
export function getGDAPrice(state: GDAState, actionType: "boost" | "pillow", currentTick: number, chaosMode: boolean = false): number {
  const chaosMul = chaosMode ? 0.5 : 1;
  if (actionType === "boost") {
    const scaleFactor = Math.pow(1.3, state.boostPurchases);
    const ticksSince = currentTick - state.lastBoostTick;
    const decayFactor = Math.pow(0.995, ticksSince);
    return Math.max(15, Math.round(state.boostBasePrice * scaleFactor * decayFactor * chaosMul));
  } else {
    const scaleFactor = Math.pow(1.5, state.pillowPurchases);
    const ticksSince = currentTick - state.lastPillowTick;
    const decayFactor = Math.pow(0.993, ticksSince);
    return Math.max(30, Math.round(state.pillowBasePrice * scaleFactor * decayFactor * chaosMul));
  }
}

export function applyGDAPurchase(state: GDAState, actionType: "boost" | "pillow", currentTick: number): GDAState {
  if (actionType === "boost") {
    return { ...state, boostPurchases: state.boostPurchases + 1, lastBoostTick: currentTick };
  } else {
    return { ...state, pillowPurchases: state.pillowPurchases + 1, lastPillowTick: currentTick };
  }
}

const TRACK_LENGTH = 2800; // race distance units
const TICKS_PER_SECOND = 10;
const MAX_TICKS = 1500; // 150 seconds max

// Random events from GDD
const RANDOM_EVENTS = [
  { type: "yawn_wave", chance: 0.003, description: "Yawn Wave! Leader spread drowsiness!", stat: "agi" as const },
  { type: "rain", chance: 0.002, description: "Sudden Rain! All speeds dropping!", stat: "sta" as const },
  { type: "luck_orb", chance: 0.0025, description: "Luck Orb appeared!", stat: "lck" as const },
  { type: "pillow_fight", chance: 0.0015, description: "Pillow Fight! Two sloths collided!", stat: "ref" as const },
];

export function simulateRace(participants: SlothStats[], seed: string, actions: TacticAction[] = [], chaosMode: boolean = false): RaceResult {
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

  // State per sloth
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
    stamina: p.sta,
    agility: p.agi,
    reflex: p.ref,
    luck: p.lck,
    gridPosition: p.gridPosition,
    finished: false,
    finishTick: MAX_TICKS,
    slowdown: 0,
    boost: 0,
    overtakeBoostEnd: 0,
    prevPosition: p.gridPosition,
  }));

  // Grid position affects starting delay (pole = no delay, 4th = small delay)
  state.forEach((s) => {
    s.distance = (4 - s.gridPosition) * 0.5; // pole position gets 1.5 unit head start (reduced from 6)
  });

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    // Check for random events — chaos mode + weather affect frequency
    const eventInterval = chaosMode ? 5 : 10;
    const leaderDist = Math.max(...state.filter(s => !s.finished).map(s => s.distance));
    const chaosMultiplier = chaosMode && leaderDist > TRACK_LENGTH * 0.7 ? 3 : chaosMode ? 2 : 1;
    if (tick > 30 && tick % eventInterval === 0) {
      for (const event of RANDOM_EVENTS) {
        if (rng() < event.chance * 10 * chaosMultiplier * weatherMods.eventFreqMul) {
          const activeSloths = state.filter((s) => !s.finished);
          if (activeSloths.length < 2) continue;

          const affectedIds: number[] = [];

          if (event.type === "yawn_wave") {
            // Leader spreads yawn, others behind get drowsy
            const leader = activeSloths.reduce((a, b) => (a.distance > b.distance ? a : b));
            const others = activeSloths.filter((s) => s.id !== leader.id);
            for (const other of others) {
              const resist = other.agility * 0.1;
              if (rng() > resist / 10) {
                other.slowdown = 15;
                affectedIds.push(other.id);
              }
            }
          } else if (event.type === "rain") {
            // All speeds drop, STA resists (doubled resistance)
            for (const s of activeSloths) {
              const resist = s.stamina * 0.1;
              s.speed *= 0.7 + resist / 10;
              affectedIds.push(s.id);
            }
          } else if (event.type === "luck_orb") {
            // Random sloth gets speed boost — rubber band: trailing sloths get higher weight
            const maxDist = Math.max(...activeSloths.map(s => s.distance));
            const weights = activeSloths.map((s) => {
              const distBehind = maxDist - s.distance;
              const rubberBand = 1 + distBehind * 0.02; // +2% weight per unit behind
              const dreamCatcherMul = s.passive === 'dream_catcher' ? 1.20 : 1;
              return s.luck * rubberBand * dreamCatcherMul;
            });
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let pick = rng() * totalWeight;
            for (let wi = 0; wi < activeSloths.length; wi++) {
              const s = activeSloths[wi];
              pick -= weights[wi];
              if (pick <= 0) {
                s.boost = Math.round(20 * weatherMods.boostDurMul);
                affectedIds.push(s.id);
                break;
              }
            }
          } else if (event.type === "pillow_fight") {
            // Two closest sloths clash, REF determines recovery
            const sorted = [...activeSloths].sort((a, b) => a.distance - b.distance);
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

          // lucid_dream passive: after a bad event, 30% chance to convert to boost
          if (affectedIds.length > 0 && (event.type === 'yawn_wave' || event.type === 'rain' || event.type === 'pillow_fight')) {
            for (const aid of affectedIds) {
              const affectedSloth = state.find(s => s.id === aid);
              if (affectedSloth && affectedSloth.passive === 'lucid_dream' && rng() < 0.30) {
                affectedSloth.slowdown = 0;
                affectedSloth.boost = 15;
                events.push({
                  tick,
                  type: 'lucid_dream',
                  description: `${affectedSloth.name} turned misfortune into speed!`,
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
      const activeSloths = state.filter((s) => !s.finished);
      if (action.type === "boost") {
        const sloth = state.find((s) => s.id === action.slothId);
        if (sloth && !sloth.finished) {
          sloth.boost = Math.round(15 * weatherMods.boostDurMul); // 1.5x speed, weather affects duration
          events.push({
            tick,
            type: "tactic_boost",
            description: `${sloth.name} activated BOOST!`,
            affectedIds: [sloth.id],
          });
        }
      } else if (action.type === "pillow") {
        // Pillow hits the leader (or targetId)
        const leader = action.targetId
          ? state.find((s) => s.id === action.targetId)
          : activeSloths.reduce((a, b) => (a.distance > b.distance ? a : b));
        const shooter = state.find((s) => s.id === action.slothId);
        if (leader && shooter && leader.id !== shooter.id && !leader.finished) {
          const pillowSlowdown = leader.passive === 'thick_fur' ? 5 : 10;
          leader.slowdown = pillowSlowdown; // speed drops for ticks (reduced by thick_fur)
          leader.speed = leader.passive === 'thick_fur' ? leader.speed * 0.5 : 1;
          events.push({
            tick,
            type: "tactic_pillow",
            description: `${shooter.name} threw a PILLOW at ${leader.name}!`,
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

    // Update each sloth
    for (const s of state) {
      if (s.finished) continue;

      // Stamina degradation (after 60% of race) — tripled STA impact, weather affects decay
      const fatigueMul = s.passive === 'deep_sleep' ? 0.5 : 1;
      const staDecay = Math.max(0.05, (0.35 - s.stamina * 0.015 * weatherMods.staMul) * fatigueMul);
      const staminaFactor = s.distance > TRACK_LENGTH * 0.6
        ? 1 - ((s.distance - TRACK_LENGTH * 0.6) / (TRACK_LENGTH * 0.4)) * staDecay
        : 1;

      // Passive abilities — speed multiplier
      let passiveSpeedMul = 1;

      // caffeine_rush: last 33% of track +10% speed
      if (s.passive === 'caffeine_rush' && s.distance > TRACK_LENGTH * 0.67) {
        passiveSpeedMul *= 1.10;
      }

      // adrenaline_wake: after overtaking, 10 tick speed burst
      if (s.overtakeBoostEnd > tick) {
        passiveSpeedMul *= 1.15;
      }

      // Acceleration toward max speed
      const targetSpeed = s.maxSpeed * staminaFactor * passiveSpeedMul;
      if (s.speed < targetSpeed) {
        s.speed = Math.min(targetSpeed, s.speed + s.acceleration * 0.1);
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
      if (s.distance >= TRACK_LENGTH) {
        s.finished = true;
        s.finishTick = tick;
        s.distance = TRACK_LENGTH;
      }
    }

    // Detect overtakes for adrenaline_wake passive
    const positionsAfterTick = state
      .filter(s => !s.finished)
      .sort((a, b) => b.distance - a.distance)
      .map(s => s.id);
    for (const s of state) {
      if (s.finished || s.passive !== 'adrenaline_wake') continue;
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
      return b.distance - a.distance; // if same tick, further distance wins
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
    trackLength: TRACK_LENGTH,
    totalTicks: frames.length,
    weather,
  };
}

// Calculate pot distribution per GDD
export function calculatePot(
  entryFees: number,
  totalBids: number,
  finishOrder: { id: number; wallet: string; isBot: boolean }[]
): { id: number; wallet: string; payout: number; position: number }[] {
  const totalPot = entryFees + totalBids;
  const platformCut = Math.floor(totalPot * 0.15);
  const distributablePot = totalPot - platformCut;

  const SHARES = [0.50, 0.30, 0.15, 0.05];

  // Separate real players from bots
  const realPlayers = finishOrder.filter((p) => !p.isBot);
  const botSlots = finishOrder.filter((p) => p.isBot);

  // Calculate base payouts
  const payouts = finishOrder.map((player, index) => ({
    id: player.id,
    wallet: player.wallet,
    payout: Math.floor(distributablePot * SHARES[index]),
    position: index + 1,
    isBot: player.isBot,
  }));

  // Redistribute bot payouts to real players proportionally
  const botTotal = payouts.filter((p) => p.isBot).reduce((sum, p) => sum + p.payout, 0);
  if (botTotal > 0 && realPlayers.length > 0) {
    const realPayouts = payouts.filter((p) => !p.isBot);
    const realTotal = realPayouts.reduce((sum, p) => sum + p.payout, 0);

    for (const p of realPayouts) {
      const share = realTotal > 0 ? p.payout / realTotal : 1 / realPlayers.length;
      p.payout += Math.floor(botTotal * share);
    }

    for (const p of payouts.filter((p) => p.isBot)) {
      p.payout = 0;
    }
  }

  return payouts.map(({ isBot, ...rest }) => rest);
}
