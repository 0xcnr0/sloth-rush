/**
 * Wind-Up phase logic tests.
 *
 * Run with: npm run test:unit
 *
 * These assert the SHAPE of the mechanic (higher tension wins the grid, past
 * Safe Wind costs stamina, snapping is strictly bad), not the specific starting
 * numbers in WIND_UP_TUNING — those are expected to move after the first
 * playtest. Where a test does touch a number it reads it from WIND_UP_TUNING so
 * retuning does not turn the suite red for the wrong reason.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  WIND_UP_TUNING,
  botSigmaForSkill,
  botTension,
  orderGrid,
  overwindDrainMultiplier,
  poleAccelerationBonus,
  rawTensionFromHold,
  resolveWind,
  safeWindDisplayBand,
  safeWindThreshold,
  seededUnit,
} from "./windUp";

const SEED = "a1b2c3d4e5f6";
const OTHER_SEED = "ffffffffffff";

describe("seededUnit", () => {
  it("is deterministic for the same seed and label", () => {
    assert.equal(seededUnit(SEED, "x"), seededUnit(SEED, "x"));
  });

  it("differs across labels and across seeds", () => {
    assert.notEqual(seededUnit(SEED, "x"), seededUnit(SEED, "y"));
    assert.notEqual(seededUnit(SEED, "x"), seededUnit(OTHER_SEED, "x"));
  });

  it("stays inside [0, 1)", () => {
    for (let i = 0; i < 500; i++) {
      const v = seededUnit(SEED, `label-${i}`);
      assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
    }
  });
});

describe("safeWindThreshold", () => {
  it("rises with stamina", () => {
    const low = safeWindThreshold(10, SEED, 1);
    const high = safeWindThreshold(60, SEED, 1);
    assert.ok(high > low, `expected STA 60 (${high}) above STA 10 (${low})`);
  });

  it("lands near 70 at STA 60, per spec §6", () => {
    const t = safeWindThreshold(60, SEED, 1);
    assert.ok(
      Math.abs(t - 70) <= WIND_UP_TUNING.safeWindJitterPct,
      `expected ~70 +/- ${WIND_UP_TUNING.safeWindJitterPct}, got ${t}`
    );
  });

  it("shifts per race but never past the jitter budget", () => {
    const base = WIND_UP_TUNING.safeWindBase + 60 / WIND_UP_TUNING.safeWindStaDivisor;
    for (let i = 0; i < 200; i++) {
      const t = safeWindThreshold(60, `seed-${i}`, 7);
      assert.ok(
        Math.abs(t - base) <= WIND_UP_TUNING.safeWindJitterPct + 1e-9,
        `jitter escaped budget: ${t} vs base ${base}`
      );
    }
  });

  it("gives different racers in one race different thresholds", () => {
    assert.notEqual(safeWindThreshold(60, SEED, 1), safeWindThreshold(60, SEED, 2));
  });

  it("is reproducible, so a result can be re-checked after the race", () => {
    assert.equal(safeWindThreshold(42, SEED, 9), safeWindThreshold(42, SEED, 9));
  });

  it("always leaves room to overwind below the snap point", () => {
    for (let sta = 0; sta <= 200; sta += 5) {
      const t = safeWindThreshold(sta, SEED, sta);
      assert.ok(t < WIND_UP_TUNING.snapPoint, `threshold ${t} reached the snap point`);
    }
  });
});

describe("safeWindDisplayBand", () => {
  it("brackets every threshold the seed can produce", () => {
    const sta = 48;
    const band = safeWindDisplayBand(sta);
    for (let i = 0; i < 200; i++) {
      const actual = safeWindThreshold(sta, `seed-${i}`, 3);
      assert.ok(
        actual >= band.low - 1e-9 && actual <= band.high + 1e-9,
        `threshold ${actual} outside displayed band ${band.low}..${band.high}`
      );
    }
  });

  it("is a band, not a line — perfect play still carries risk", () => {
    const band = safeWindDisplayBand(60);
    assert.ok(band.high > band.low);
  });
});

describe("rawTensionFromHold", () => {
  it("treats no touch as zero tension", () => {
    assert.equal(rawTensionFromHold(0), 0);
    assert.equal(rawTensionFromHold(-50), 0);
  });

  it("rejects nonsense rather than producing NaN", () => {
    assert.equal(rawTensionFromHold(NaN), 0);
    assert.equal(rawTensionFromHold(Infinity), 0);
  });

  it("reaches the snap point exactly at the full wind time", () => {
    assert.equal(rawTensionFromHold(WIND_UP_TUNING.fullWindMs), WIND_UP_TUNING.snapPoint);
  });

  it("is linear in hold time", () => {
    const half = rawTensionFromHold(WIND_UP_TUNING.fullWindMs / 2);
    assert.ok(Math.abs(half - WIND_UP_TUNING.snapPoint / 2) < 1e-9);
  });

  it("keeps climbing past the snap point so a snap is detectable", () => {
    assert.ok(rawTensionFromHold(WIND_UP_TUNING.fullWindMs * 1.5) > WIND_UP_TUNING.snapPoint);
  });
});

describe("resolveWind", () => {
  const SAFE = 70;

  it("classifies a short hold as under-wound with no penalty", () => {
    const out = resolveWind(WIND_UP_TUNING.fullWindMs * 0.3, SAFE);
    assert.equal(out.band, "under");
    assert.equal(out.snapped, false);
    assert.equal(out.staminaDrainMultiplier, 1);
    assert.equal(out.startStaminaFactor, 1);
  });

  it("charges nothing for landing exactly on Safe Wind", () => {
    const holdMs = (SAFE / WIND_UP_TUNING.snapPoint) * WIND_UP_TUNING.fullWindMs;
    const out = resolveWind(holdMs, SAFE);
    assert.equal(out.tension, SAFE);
    assert.equal(out.band, "under");
    assert.equal(out.staminaDrainMultiplier, 1);
  });

  it("charges stamina for overwinding, and more the further past", () => {
    const nearMiss = resolveWind((75 / 100) * WIND_UP_TUNING.fullWindMs, SAFE);
    const deep = resolveWind((95 / 100) * WIND_UP_TUNING.fullWindMs, SAFE);
    assert.equal(nearMiss.band, "over");
    assert.equal(deep.band, "over");
    assert.ok(nearMiss.staminaDrainMultiplier > 1);
    assert.ok(deep.staminaDrainMultiplier > nearMiss.staminaDrainMultiplier);
  });

  it("snaps past the snap point and applies the starting stamina penalty", () => {
    const out = resolveWind(WIND_UP_TUNING.fullWindMs * 1.2, SAFE);
    assert.equal(out.snapped, true);
    assert.equal(out.band, "snapped");
    assert.equal(out.startStaminaFactor, WIND_UP_TUNING.snapStaminaFactor);
    assert.ok(out.startStaminaFactor < 1);
  });

  it("reports a snapped spring at the clamped maximum, not above it", () => {
    const out = resolveWind(WIND_UP_TUNING.fullWindMs * 5, SAFE);
    assert.equal(out.tension, WIND_UP_TUNING.snapPoint);
  });

  it("never reports a tension outside 0-100, whatever the hold", () => {
    for (const hold of [-1000, 0, 1, 500, 3500, 9999, 1e9]) {
      const out = resolveWind(hold, SAFE);
      assert.ok(out.tension >= 0 && out.tension <= 100, `tension ${out.tension} for hold ${hold}`);
      assert.ok(Number.isInteger(out.tension), `tension ${out.tension} is not an integer`);
    }
  });

  it("gives a low-stamina racer a penalty where a high-stamina one pays none", () => {
    const hold = (72 / 100) * WIND_UP_TUNING.fullWindMs;
    const fragile = resolveWind(hold, 65);
    const sturdy = resolveWind(hold, 80);
    assert.equal(fragile.band, "over");
    assert.equal(sturdy.band, "under");
    assert.ok(fragile.staminaDrainMultiplier > sturdy.staminaDrainMultiplier);
  });
});

describe("overwindDrainMultiplier", () => {
  it("is exactly 1 at or below Safe Wind", () => {
    assert.equal(overwindDrainMultiplier(50, 70), 1);
    assert.equal(overwindDrainMultiplier(70, 70), 1);
  });

  it("adds the configured rate per point over", () => {
    const expected = 1 + 10 * WIND_UP_TUNING.overwindDrainPerPoint;
    assert.ok(Math.abs(overwindDrainMultiplier(80, 70) - expected) < 1e-9);
  });

  it("increases monotonically with tension", () => {
    let previous = 0;
    for (let t = 70; t <= 100; t++) {
      const m = overwindDrainMultiplier(t, 70);
      assert.ok(m >= previous, `multiplier dipped at tension ${t}`);
      previous = m;
    }
  });
});

describe("botTension", () => {
  it("is deterministic for a given race and racer", () => {
    assert.equal(botTension(70, 4, SEED, 3), botTension(70, 4, SEED, 3));
  });

  it("differs between bots in the same race", () => {
    const a = botTension(70, 8, SEED, 1);
    const b = botTension(70, 8, SEED, 2);
    const c = botTension(70, 8, SEED, 3);
    assert.ok(new Set([a, b, c]).size > 1, "all bots wound to the same tension");
  });

  it("stays inside the configured bounds across many races", () => {
    for (let i = 0; i < 1000; i++) {
      const t = botTension(70, WIND_UP_TUNING.botSigmaSloppy, `seed-${i}`, 1);
      assert.ok(
        t >= WIND_UP_TUNING.botMinTension && t <= WIND_UP_TUNING.botMaxTension,
        `bot tension ${t} escaped bounds`
      );
      assert.ok(Number.isInteger(t));
    }
  });

  it("aims below Safe Wind on average", () => {
    const safe = 70;
    let total = 0;
    const runs = 2000;
    for (let i = 0; i < runs; i++) {
      total += botTension(safe, WIND_UP_TUNING.botSigmaSkilled, `seed-${i}`, 1);
    }
    const mean = total / runs;
    assert.ok(mean < safe, `bots averaged ${mean}, expected below ${safe}`);
  });

  it("makes sloppy bots miss wider than skilled ones", () => {
    const safe = 70;
    const spread = (sigma: number) => {
      const samples: number[] = [];
      for (let i = 0; i < 2000; i++) samples.push(botTension(safe, sigma, `seed-${i}`, 1));
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      return Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length);
    };
    assert.ok(
      spread(WIND_UP_TUNING.botSigmaSloppy) > spread(WIND_UP_TUNING.botSigmaSkilled),
      "sloppy bots were not more erratic than skilled ones"
    );
  });

  it("lets sloppy bots reach the snap point but keeps skilled ones off it", () => {
    const safe = 70;
    let sloppyAtMax = 0;
    let skilledAtMax = 0;
    for (let i = 0; i < 2000; i++) {
      if (botTension(safe, WIND_UP_TUNING.botSigmaSloppy, `s-${i}`, 1) >= 95) sloppyAtMax++;
      if (botTension(safe, WIND_UP_TUNING.botSigmaSkilled, `s-${i}`, 1) >= 95) skilledAtMax++;
    }
    assert.ok(sloppyAtMax > skilledAtMax, "sloppy bots did not overwind more often");
  });
});

describe("botSigmaForSkill", () => {
  it("maps 1 to the skilled sigma and 0 to the sloppy one", () => {
    assert.equal(botSigmaForSkill(1), WIND_UP_TUNING.botSigmaSkilled);
    assert.equal(botSigmaForSkill(0), WIND_UP_TUNING.botSigmaSloppy);
  });

  it("clamps out-of-range skill instead of extrapolating", () => {
    assert.equal(botSigmaForSkill(5), WIND_UP_TUNING.botSigmaSkilled);
    assert.equal(botSigmaForSkill(-5), WIND_UP_TUNING.botSigmaSloppy);
  });
});

describe("orderGrid", () => {
  it("puts the highest tension on pole", () => {
    const ordered = orderGrid(
      [
        { racerId: 1, tension: 40, snapped: false },
        { racerId: 2, tension: 90, snapped: false },
        { racerId: 3, tension: 65, snapped: false },
      ],
      SEED
    );
    assert.deepEqual(ordered.map((e) => e.racerId), [2, 3, 1]);
  });

  it("sends a snapped spring to the back however hard it wound", () => {
    const ordered = orderGrid(
      [
        { racerId: 1, tension: 100, snapped: true },
        { racerId: 2, tension: 20, snapped: false },
      ],
      SEED
    );
    assert.deepEqual(ordered.map((e) => e.racerId), [2, 1]);
  });

  it("still orders snapped racers among themselves", () => {
    const ordered = orderGrid(
      [
        { racerId: 1, tension: 100, snapped: true },
        { racerId: 2, tension: 100, snapped: true },
        { racerId: 3, tension: 10, snapped: false },
      ],
      SEED
    );
    assert.equal(ordered[0].racerId, 3);
    assert.equal(ordered.filter((e) => e.snapped).length, 2);
  });

  it("breaks ties on the seed, not on input order", () => {
    const tied = [
      { racerId: 1, tension: 50, snapped: false },
      { racerId: 2, tension: 50, snapped: false },
      { racerId: 3, tension: 50, snapped: false },
      { racerId: 4, tension: 50, snapped: false },
    ];
    const forwards = orderGrid(tied, SEED).map((e) => e.racerId);
    const backwards = orderGrid([...tied].reverse(), SEED).map((e) => e.racerId);
    assert.deepEqual(forwards, backwards, "grid depended on row order");
  });

  it("resolves the same tie differently in a different race", () => {
    const tied = [
      { racerId: 1, tension: 50, snapped: false },
      { racerId: 2, tension: 50, snapped: false },
      { racerId: 3, tension: 50, snapped: false },
      { racerId: 4, tension: 50, snapped: false },
    ];
    const seeds = ["s1", "s2", "s3", "s4", "s5", "s6"];
    const orders = new Set(seeds.map((s) => orderGrid(tied, s).map((e) => e.racerId).join(",")));
    assert.ok(orders.size > 1, "every seed produced the same tie-break order");
  });

  it("does not mutate its input", () => {
    const input = [
      { racerId: 1, tension: 10, snapped: false },
      { racerId: 2, tension: 90, snapped: false },
    ];
    const snapshot = input.map((e) => e.racerId);
    orderGrid(input, SEED);
    assert.deepEqual(input.map((e) => e.racerId), snapshot);
  });

  it("keeps every racer — nobody is dropped from the grid", () => {
    const input = Array.from({ length: 4 }, (_, i) => ({
      racerId: i + 1,
      tension: (i * 37) % 100,
      snapped: i === 2,
    }));
    const ordered = orderGrid(input, SEED);
    assert.equal(ordered.length, 4);
    assert.deepEqual(new Set(ordered.map((e) => e.racerId)), new Set([1, 2, 3, 4]));
  });
});

describe("poleAccelerationBonus", () => {
  it("gives pole the full bonus and the back of the grid none", () => {
    assert.equal(poleAccelerationBonus(1, 4), WIND_UP_TUNING.poleAccelerationBonus);
    assert.equal(poleAccelerationBonus(4, 4), 0);
  });

  it("decreases down the grid", () => {
    const bonuses = [1, 2, 3, 4].map((p) => poleAccelerationBonus(p, 4));
    for (let i = 1; i < bonuses.length; i++) {
      assert.ok(bonuses[i] < bonuses[i - 1], `bonus rose at position ${i + 1}`);
    }
  });

  it("handles a one-racer field without dividing by zero", () => {
    assert.equal(poleAccelerationBonus(1, 1), 0);
  });

  it("clamps positions outside the field", () => {
    assert.equal(poleAccelerationBonus(0, 4), WIND_UP_TUNING.poleAccelerationBonus);
    assert.equal(poleAccelerationBonus(99, 4), 0);
  });
});

describe("the mechanic as a whole", () => {
  it("makes overwinding a real trade: better grid, worse stamina", () => {
    const safe = 70;
    const cautious = resolveWind((60 / 100) * WIND_UP_TUNING.fullWindMs, safe);
    const greedy = resolveWind((90 / 100) * WIND_UP_TUNING.fullWindMs, safe);

    // Greedy wins the grid...
    const ordered = orderGrid(
      [
        { racerId: 1, tension: cautious.tension, snapped: cautious.snapped },
        { racerId: 2, tension: greedy.tension, snapped: greedy.snapped },
      ],
      SEED
    );
    assert.equal(ordered[0].racerId, 2);

    // ...and pays for it in stamina.
    assert.ok(greedy.staminaDrainMultiplier > cautious.staminaDrainMultiplier);
  });

  it("makes snapping strictly worse than stopping just short of it", () => {
    const safe = 70;
    const edge = resolveWind(WIND_UP_TUNING.fullWindMs * 0.99, safe);
    const snapped = resolveWind(WIND_UP_TUNING.fullWindMs * 1.01, safe);

    const ordered = orderGrid(
      [
        { racerId: 1, tension: edge.tension, snapped: edge.snapped },
        { racerId: 2, tension: snapped.tension, snapped: snapped.snapped },
      ],
      SEED
    );
    assert.equal(ordered[0].racerId, 1, "snapping should not win the grid");
    assert.ok(snapped.startStaminaFactor < edge.startStaminaFactor);
  });
});
