/**
 * Does distance actually change which racer wins?
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
  spd, acc: spd, sta, agi: 50, ref: 50, lck: 50, gridPosition: grid,
});

const N = 3000;

console.log('Aynı stat toplamı, farklı dağılım — mesafe kimin kazandığını değiştiriyor mu?\n');
console.log('  uzunluk   sprinter    stayer    dengeli    süre');

const rows: { len: number; gap: number }[] = [];
for (const len of [1200, 1600, 2200, 2800, 3200, 4000]) {
  let sprinter = 0, stayer = 0, even = 0, ticks = 0;
  for (let i = 0; i < N; i++) {
    // Swap the two grid slots every other run so pole position cancels out.
    const a = i % 2 ? 1 : 2, b = i % 2 ? 2 : 1;
    const field = [
      mk(1, a, 80, 30, 'sprinter'), mk(2, b, 30, 80, 'stayer'),
      mk(3, 3, 55, 55, 'even-a'), mk(4, 4, 55, 55, 'even-b'),
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
