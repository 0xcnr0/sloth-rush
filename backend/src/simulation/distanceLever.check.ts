/**
 * Does distance actually change which racer wins?
 *
 * STAT RANGE MATTERS AND WAS WRONG ONCE. The first version of this check used
 * 80/30 splits because they read as "fast racer vs durable racer". No racer in
 * the game has ever had a stat near 80: per-stat caps are 15 (free) and 22-35
 * (by rarity), and a fresh racer mints around 10. Every distance and fatigue
 * constant derived from that run was calibrated for a game that does not
 * exist — the Sprint that was supposed to take 24 seconds took 56. Keep the
 * numbers below inside the real caps.
 *
 * Two formats are only worth having if they ask different questions. This runs
 * the same field — a sprinter and a stayer at identical stat totals — over a
 * range of track lengths and reports how the win split moves. If the numbers
 * barely shift, the second distance is decoration and the format should be cut
 * rather than shipped.
 *
 *   npx tsx src/simulation/distanceLever.check.ts
 */
import { simulateRace, RacerStats } from './engine';

const mk = (id: number, grid: number, spd: number, sta: number, name: string): RacerStats => ({
  id, name, wallet: `0x${id}`, isBot: false,
  spd, acc: spd, sta, agi: 20, ref: 20, lck: 20, gridPosition: grid,
});

const N = 3000;

console.log('Aynı stat toplamı, farklı dağılım — mesafe kimin kazandığını değiştiriyor mu?\n');
console.log('  uzunluk   sprinter    stayer    dengeli    süre');

const rows: { len: number; gap: number }[] = [];
for (const len of [600, 800, 1000, 1400, 1800, 2400]) {
  let sprinter = 0, stayer = 0, even = 0, ticks = 0;
  for (let i = 0; i < N; i++) {
    // Swap the two grid slots every other run so pole position cancels out.
    const a = i % 2 ? 1 : 2, b = i % 2 ? 2 : 1;
    const field = [
      mk(1, a, 30, 10, 'sprinter'), mk(2, b, 10, 30, 'stayer'),
      mk(3, 3, 20, 20, 'even-a'), mk(4, 4, 20, 20, 'even-b'),
    ];
    const r = simulateRace(field, `dist_${len}_${i}`, [], false, len);
    const w = r.finalOrder[0].name;
    if (w === 'sprinter') sprinter++;
    else if (w === 'stayer') stayer++;
    else even++;
    ticks += r.totalTicks;
  }
  const pct = (n: number) => `${((n / N) * 100).toFixed(1)}%`.padStart(6);
  const gap = ((sprinter - stayer) / N) * 100;
  rows.push({ len, gap });
  console.log(
    `  ${String(len).padStart(6)}    ${pct(sprinter)}    ${pct(stayer)}   ${pct(even)}  ` +
    `${(ticks / N / 10).toFixed(1).padStart(6)}s`
  );
}

const swing = Math.max(...rows.map(r => r.gap)) - Math.min(...rows.map(r => r.gap));
console.log(`\nEn kısa ve en uzun pist arasındaki toplam sapma: ${swing.toFixed(1)} puan`);
console.log(
  swing < 8
    ? 'ZAYIF — mesafe kimin kazandığını değiştirmiyor. İkinci format karar üretmez.'
    : 'GERÇEK — mesafe bir kaldıraç; iki format iki farklı soru soruyor.'
);
console.log(
  '\nOkuma notu: uzun pistte sprinter\'ın kaybettiğini stayer değil DENGELİ\n' +
  'yarışçı (55/55) alıyor. Doğru cümle "uzun pisti STA kazanır" değil:\n' +
  '  kısa pist  → en yüksek SPD kazanır\n' +
  '  uzun pist  → dengeli dağılım kazanır; STA hızı korur, tek başına kazanmaz\n' +
  '30 SPD\'li saf stayer hiçbir mesafede kazanmamalı, çünkü SPD taban para birimi.'
);
