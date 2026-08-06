/**
 * Fatigue tuning grid.
 *
 * Picks the FATIGUE constants by measurement instead of by eye, the same way
 * the Wind-Up grid was settled (docs/WIND_UP_PHASE.md §13).
 *
 * What a good cell looks like:
 *   - SPRINT   — the sprinter build clearly ahead. Short races reward top speed.
 *   - ENDURANCE— the stayer build at least level. If STA never wins anywhere,
 *                nobody will ever train it and the stat is decoration.
 *   - The moderate field (65/45 vs 45/65) must not flip as hard as the extreme
 *     one, or ordinary racers become a coin toss decided by a stat they did
 *     not choose.
 *
 *   npx tsx src/simulation/fatigueSweep.ts
 */
import { simulateRace, RacerStats, FATIGUE } from './engine';

// Frozen `as const` in production so nobody edits it by accident; the sweep is
// the one place allowed to move it. Same trick as tuningSweep.ts.
const F = FATIGUE as unknown as { -readonly [K in keyof typeof FATIGUE]: number };
const ORIGINAL = { ...FATIGUE };

const SPRINT = 1800;
const ENDURANCE = 4600;
const N = 1500;

const mk = (id: number, grid: number, spd: number, sta: number, name: string): RacerStats => ({
  id, name, wallet: `0x${id}`, isBot: false,
  spd, acc: spd, sta, agi: 50, ref: 50, lck: 50, gridPosition: grid,
});

/** Win share of the stayer minus the sprinter, in points. Negative = speed wins. */
function gap(len: number, hi: number, lo: number): number {
  let sprinter = 0, stayer = 0;
  for (let i = 0; i < N; i++) {
    const a = i % 2 ? 1 : 2, b = i % 2 ? 2 : 1;
    const r = simulateRace([
      mk(1, a, hi, lo, 'sprinter'), mk(2, b, lo, hi, 'stayer'),
      mk(3, 3, 55, 55, 'even-a'), mk(4, 4, 55, 55, 'even-b'),
    ], `fs_${len}_${hi}_${i}`, [], false, len);
    if (r.finalOrder[0].name === 'sprinter') sprinter++;
    if (r.finalOrder[0].name === 'stayer') stayer++;
  }
  return ((stayer - sprinter) / N) * 100;
}

console.log(`Sprint ${SPRINT} / Endurance ${ENDURANCE} · ${N} yarış/hücre`);
console.log('Sayılar: stayer kazanma payı eksi sprinter payı (puan). Eksi = hız kazanıyor.\n');
console.log('  perSta  floor  span |  SPRINT uç  END uç | SPRINT ılım  END ılım');

type Cell = { perSta: number; floor: number; span: number; se: number; ee: number; sm: number; em: number };
const cells: Cell[] = [];

for (const perSta of [0.00525, 0.0060, 0.0070]) {
  for (const floor of [0.30, 0.24, 0.18]) {
    for (const span of [1000, 850, 700]) {
      F.decayPerSta = perSta; F.minSpeedFactor = floor; F.spanDistance = span;
      const se = gap(SPRINT, 80, 30), ee = gap(ENDURANCE, 80, 30);
      const sm = gap(SPRINT, 65, 45), em = gap(ENDURANCE, 65, 45);
      cells.push({ perSta, floor, span, se, ee, sm, em });
      const f = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(1);
      console.log(
        `  ${perSta.toFixed(5)}  ${floor.toFixed(2)}  ${span} | ` +
        `${f(se).padStart(8)} ${f(ee).padStart(7)} | ${f(sm).padStart(10)} ${f(em).padStart(8)}`
      );
    }
  }
}

Object.assign(F, ORIGINAL);

// Score: sprint must favour speed, endurance must be near level, and the
// moderate field must stay calmer than the extreme one.
const scored = cells
  .filter(c => c.se < -20)                     // sprint clearly belongs to speed
  .filter(c => Math.abs(c.ee) < 25)            // endurance genuinely contested
  .filter(c => Math.abs(c.em) < Math.abs(c.ee)) // ordinary racers swing less
  .sort((a, b) => Math.abs(a.ee) - Math.abs(b.ee));

console.log('\nGeçen hücreler:', scored.length);
if (scored.length) {
  const w = scored[0];
  console.log(
    `Önerilen: decayPerSta ${w.perSta} · minSpeedFactor ${w.floor} · spanDistance ${w.span}\n` +
    `  sprint uç ${w.se.toFixed(1)} · endurance uç ${w.ee.toFixed(1)} · endurance ılımlı ${w.em.toFixed(1)}`
  );
} else {
  console.log('Hiçbiri geçmedi — eşikler ya da SPD dağılımı yeniden düşünülmeli.');
}
