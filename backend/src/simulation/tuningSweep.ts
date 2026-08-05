/**
 * WIND_UP_PHASE.md §13 — pole avantajı × aşırı kurma cezası taraması.
 *
 * Soru şu: risk almak gerçekten kazandırıyor mu? Doğru ayarda üç strateji de
 * yaşayabilir olmalı — temiz kur, sınırda kur, kırmızıya kur. Bu tartışmayla
 * değil ölçümle çözülür.
 *
 * ÖNEMLİ: bu tarama, foto-finiş beraberliklerini grid sırasına düşüren motor
 * hatası (6138d9b) düzeltildikten SONRA koşmalı. O hata sayılmamış fazladan bir
 * pole avantajıydı — yani tam da burada ölçülen büyüklüğü kirletiyordu.
 *
 *   npx tsx backend/src/simulation/tuningSweep.ts
 *   npx tsx backend/src/simulation/tuningSweep.ts --races 600
 */

import { simulateRace, type RacerStats } from "./engine";
import {
  WIND_UP_TUNING,
  orderGrid,
  overwindDrainMultiplier,
  safeWindThreshold,
} from "./windUp";

// WIND_UP_TUNING `as const` ile dondurulmuş: üretimde yanlışlıkla değiştirilmesin
// diye doğru bir karar. Tarama tam olarak bu iki sayıyı süpürmek zorunda, o yüzden
// burada — SADECE burada — yazılabilir bir görünüm alıyoruz. Tarama bitince ikisi
// de eski değerine geri konuyor.
const TUNING = WIND_UP_TUNING as unknown as {
  poleAccelerationBonus: number;
  overwindDrainPerPoint: number;
  snapPoint: number;
  snapStaminaFactor: number;
};

const arg = (name: string, fallback: number): number => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? Number(process.argv[at + 1]) : fallback;
};

const RACES = arg("--races", 400);
const POLE_STEPS = [0, 0.04, 0.08, 0.12, 0.16, 0.2, 0.24, 0.28];
const PENALTY_STEPS = [0, 0.005, 0.01, 0.015, 0.02, 0.025, 0.03, 0.035];

/** Üç strateji: Safe Wind'e göre nereyi hedefliyorlar. */
const STRATEGIES = [
  { key: "clean", offset: -8 },   // güvenli, stamina cezası yok
  { key: "edge", offset: +2 },    // sınırda, hafif ceza
  { key: "red", offset: +26 },    // kırmızıya yakın, ağır ceza
] as const;

/** Uygulama hatası: oyuncu hedefini tam tutturamaz. */
function jittered(target: number, jitter: number, seed: number): number {
  if (jitter === 0) return target;
  // Deterministik "gürültü" — Math.random kullanmıyoruz ki tarama tekrarlanabilsin.
  const n = Math.sin(seed * 12.9898) * 43758.5453;
  return target + (n - Math.floor(n) - 0.5) * 2 * jitter;
}

interface Cell {
  pole: number;
  penalty: number;
  share: Record<string, number>;
  snapRate: number;
}

function runCell(pole: number, penalty: number, jitter: number, staSpread: number): Cell {
  TUNING.poleAccelerationBonus = pole;
  TUNING.overwindDrainPerPoint = penalty;

  const wins: Record<string, number> = { clean: 0, edge: 0, red: 0 };
  let snapped = 0;

  for (let race = 0; race < RACES; race++) {
    const seed = `sweep_${pole}_${penalty}_${race}`;

    // Üç oyuncu, her biri bir strateji. Dördüncü koltuk bir bot — ödül
    // kazanamaz, sadece alanı doldurur (CLAUDE.md kararı).
    const entries = STRATEGIES.map((s, i) => {
      const sta = 60 + (staSpread === 0 ? 0 : ((race * 7 + i * 13) % (staSpread * 2)) - staSpread);
      const safeWind = safeWindThreshold(sta, seed, i + 1);
      const raw = jittered(safeWind + s.offset, jitter, race * 31 + i);
      const tension = Math.max(0, Math.min(120, raw));
      const didSnap = tension >= TUNING.snapPoint;
      if (s.key === "red" && didSnap) snapped++;
      return { id: i + 1, key: s.key, sta, safeWind, tension, snapped: didSnap };
    });

    // Kopan yay grid'in sonuna düşer; kalanlar gerilime göre sıralanır.
    // orderGrid GridEntry ister: racerId / tension / snapped. Kopan yayı burada
    // ayrıca sona itmiyoruz — orderGrid zaten snapped'i en arkaya koyuyor.
    const ordered = orderGrid(
      entries.map((e) => ({ ...e, racerId: e.id })),
      seed,
    );

    const participants: RacerStats[] = ordered.map((e, slot) => ({
      id: e.id,
      name: e.key,
      wallet: `0x${e.id}`,
      isBot: false,
      spd: 50, acc: 50, sta: e.sta, agi: 50, ref: 50, lck: 50,
      gridPosition: slot + 1,
      staminaDrainMultiplier: e.snapped
        ? 1 / TUNING.snapStaminaFactor
        : overwindDrainMultiplier(e.tension, e.safeWind),
    })) as RacerStats[];

    const winner = simulateRace(participants, seed).finalOrder[0];
    wins[winner.name] += 1;
  }

  const total = Object.values(wins).reduce((a, b) => a + b, 0);
  const share: Record<string, number> = {};
  for (const k of Object.keys(wins)) share[k] = (100 * wins[k]) / total;
  return { pole, penalty, share, snapRate: (100 * snapped) / RACES };
}

const CONDITIONS = [
  { label: "aynasal (jitter 0, STA eşit)", jitter: 0, sta: 0 },
  { label: "hafif uygulama hatası", jitter: 5, sta: 0 },
  { label: "yüksek uygulama hatası", jitter: 12, sta: 0 },
  { label: "lig eşleşmeli (STA ±2)", jitter: 5, sta: 2 },
  { label: "karışık kadro (STA ±12)", jitter: 5, sta: 12 },
];

const FLOOR = 20;   // bu payın altı "aç" sayılır (§13'ün kendi kuralı değil, ölçüm eşiği)
const DOMINANT = 50;

function main(): void {
  const baseline = { pole: TUNING.poleAccelerationBonus, penalty: TUNING.overwindDrainPerPoint };
  console.log(`§13 taraması — ${RACES} yarış/hücre, ${POLE_STEPS.length}×${PENALTY_STEPS.length} ızgara`);
  console.log(`committed hücre: pole ${baseline.pole}, ceza ${baseline.penalty}\n`);

  const survives = new Map<string, number>();
  for (const cond of CONDITIONS) {
    let ok = 0;
    for (const pole of POLE_STEPS) {
      for (const penalty of PENALTY_STEPS) {
        const c = runCell(pole, penalty, cond.jitter, cond.sta);
        const vals = Object.values(c.share);
        const viable = Math.max(...vals) < DOMINANT && Math.min(...vals) >= FLOOR;
        if (viable) {
          ok++;
          const k = `${pole}|${penalty}`;
          survives.set(k, (survives.get(k) ?? 0) + 1);
        }
        if (pole === baseline.pole && penalty === baseline.penalty) {
          console.log(
            `  ${cond.label.padEnd(30)} temiz ${c.share.clean.toFixed(0).padStart(2)} / ` +
            `sınırda ${c.share.edge.toFixed(0).padStart(2)} / kırmızı ${c.share.red.toFixed(0).padStart(2)}` +
            `   (kopma %${c.snapRate.toFixed(0)})${viable ? "" : "   ← ELENDİ"}`,
          );
        }
      }
    }
    survives.set(`__count_${cond.label}`, ok);
  }

  const all = [...survives.entries()].filter(([k]) => !k.startsWith("__"));
  const everywhere = all.filter(([, n]) => n === CONDITIONS.length);
  console.log(`\nbeş koşulun hepsinde ayakta kalan: ${everywhere.length} / ${POLE_STEPS.length * PENALTY_STEPS.length} hücre`);
  const committed = `${baseline.pole}|${baseline.penalty}`;
  console.log(
    survives.get(committed) === CONDITIONS.length
      ? `committed hücre (${baseline.pole}, ${baseline.penalty}) — beş koşulda da AYAKTA`
      : `committed hücre (${baseline.pole}, ${baseline.penalty}) — ${survives.get(committed) ?? 0}/${CONDITIONS.length} koşulda ayakta`,
  );

  TUNING.poleAccelerationBonus = baseline.pole;
  TUNING.overwindDrainPerPoint = baseline.penalty;
}

main();
