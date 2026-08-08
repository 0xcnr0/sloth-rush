/**
 * Does each stat actually change who wins?
 *
 * Three of the six did not, and nothing in the repo would have said so. The
 * distance lever had a check like this and the stats did not, which is why
 * `Math.max(5, 15 - reflex)` — a formula that returns the same number for every
 * racer the game can produce — sat in the engine unnoticed.
 *
 * One racer is raised while the other three stay at the mint floor, and the
 * grid slot rotates so pole position cannot masquerade as the effect. Expected
 * baseline is 25%: anything at 25 is decoration.
 *
 *   npx tsx src/simulation/statLever.check.ts
 */
import { simulateRace, RacerStats } from './engine';
import { SPRINT_LENGTH, ENDURANCE_LENGTH } from './formats';
import { MINT_BASE_STAT } from '../progression';

const BASE = {
  spd: MINT_BASE_STAT, acc: MINT_BASE_STAT, sta: MINT_BASE_STAT,
  agi: MINT_BASE_STAT, ref: MINT_BASE_STAT, lck: MINT_BASE_STAT,
};
type Stat = keyof typeof BASE;

const mk = (id: number, over: Partial<typeof BASE>): RacerStats => ({
  id, name: `r${id}`, wallet: `0x${id}`, isBot: false, gridPosition: id, ...BASE, ...over,
});

const N = 4000;

function winRate(stat: Stat, value: number, len: number): number {
  let wins = 0;
  for (let i = 0; i < N; i++) {
    const slot = (i % 4) + 1;
    const field = [1, 2, 3, 4].map(id => mk(id, id === slot ? { [stat]: value } : {}));
    const r = simulateRace(field, `lever-${stat}-${value}-${len}-${i}`, [], false, len);
    if (r.finalOrder[0].id === slot) wins++;
  }
  return (wins / N) * 100;
}

/** A stat below this at the free ceiling is doing nothing a player could feel. */
const DEAD_BELOW = 3;

console.log(`One racer raised, the other three at ${MINT_BASE_STAT}. Win rate, baseline 25%.\n`);
console.log('  stat  value    sprint   endurance      gain');

const rows: { stat: Stat; value: number; gain: number }[] = [];
for (const [stat, value] of [
  ['spd', 18], ['acc', 18], ['sta', 18],
  ['ref', 18], ['agi', 18], ['lck', 18],
] as [Stat, number][]) {
  const s = winRate(stat, value, SPRINT_LENGTH);
  const e = winRate(stat, value, ENDURANCE_LENGTH);
  const gain = (s - 25 + (e - 25)) / 2;
  rows.push({ stat, value, gain });
  console.log(
    `  ${stat.toUpperCase().padEnd(5)} ${String(value).padStart(5)}   ${s.toFixed(1).padStart(6)}%   ${e.toFixed(1).padStart(7)}%   ${gain >= 0 ? '+' : ''}${gain.toFixed(1).padStart(6)}`
  );
}

const dead = rows.filter(r => r.gain < DEAD_BELOW);
console.log();
if (dead.length) {
  console.log(`DEAD: ${dead.map(d => d.stat.toUpperCase()).join(', ')} — below +${DEAD_BELOW} at the free ceiling.`);
  console.log('A stat that cannot be felt is a slot on the card the player is asked to care about for nothing.');
} else {
  console.log('Every stat moves the result. SPD/ACC/STA lead, and that is the intended order —');
  console.log('SPD is the base currency of a race; the other three are secondary on purpose.');
}
