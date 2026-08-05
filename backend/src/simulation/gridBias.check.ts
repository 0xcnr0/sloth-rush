import { simulateRace } from './engine';

// Dört ÖZDEŞ yarışçı. Hiçbir stat farkı, hiçbir pole bonusu farkı yok —
// adil bir motorda kazanma oranı %25/%25/%25/%25 olmalı.
const mk = (id: number) => ({
  id, wallet: `0x${id}`, name: `P${id}`, isBot: false,
  spd: 50, acc: 50, sta: 50, agi: 50, ref: 50, lck: 50,
  archetype: 'tank', passive: null, gridPosition: 1,   // hepsi aynı → tasarlanmış pole bonusu nötr
  staminaDrainMultiplier: 1,
} as any);

const N = 4000;
const wins = [0, 0, 0, 0];
for (let i = 0; i < N; i++) {
  const r = simulateRace([mk(1), mk(2), mk(3), mk(4)], `bias_${i}`);
  wins[r.finalOrder[0].id - 1]++;
}
const pct = wins.map(w => (100 * w / N).toFixed(1));
console.log(`N=${N}  P1 ${pct[0]}%  P2 ${pct[1]}%  P3 ${pct[2]}%  P4 ${pct[3]}%`);
const spread = Math.max(...wins) - Math.min(...wins);
const se = Math.sqrt(N * 0.25 * 0.75);
console.log(`en yüksek-en düşük fark: ${spread} yarış  (1 SE ≈ ${se.toFixed(0)})  → ${(spread/se).toFixed(1)} SE`);
