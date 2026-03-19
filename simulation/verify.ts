#!/usr/bin/env node
/**
 * Sloth Rush — Standalone Race Verifier
 *
 * Independently verify any race result using the same deterministic engine.
 * Given a seed and participant stats, this produces the exact same outcome
 * as the game server — proving the race was fair.
 *
 * Usage:
 *   npx tsx verify.ts --seed <seed> --participants '<JSON array>'
 *
 * Example:
 *   npx tsx verify.ts \
 *     --seed "abc123" \
 *     --participants '[
 *       {"name":"Sloth1","spd":15,"acc":12,"sta":10,"agi":8,"ref":7,"lck":6},
 *       {"name":"Sloth2","spd":10,"acc":14,"sta":12,"agi":10,"ref":9,"lck":5},
 *       {"name":"Sloth3","spd":12,"acc":10,"sta":14,"agi":6,"ref":11,"lck":8},
 *       {"name":"Sloth4","spd":11,"acc":11,"sta":11,"agi":11,"ref":11,"lck":11}
 *     ]'
 *
 * Options:
 *   --seed          Race seed (string, from race API response)
 *   --participants  JSON array of participants with stats
 *   --actions       Optional: JSON array of tactic actions
 *   --chaos         Optional: Enable chaos mode
 *   --json          Optional: Output raw JSON instead of formatted text
 *   --hash-only     Optional: Output only the result hash
 */

import * as crypto from "crypto";
import { simulateRace, getWeatherFromSeed, SlothStats, TacticAction } from "./engine";

interface ParticipantInput {
  name: string;
  spd: number;
  acc: number;
  sta: number;
  agi: number;
  ref: number;
  lck: number;
  id?: number;
  wallet?: string;
  isBot?: boolean;
  gridPosition?: number;
  passive?: string;
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (key === "chaos" || key === "json" || key === "hash-only") {
        result[key] = "true";
      } else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        result[key] = args[i + 1];
        i++;
      }
    }
  }
  return result;
}

function printUsage(): void {
  console.log(`
Sloth Rush Race Verifier — Provably Fair Racing

Usage:
  npx tsx verify.ts --seed <seed> --participants '<JSON>'

Options:
  --seed          Race seed string (from race API response)
  --participants  JSON array of participant stats
  --actions       JSON array of tactic actions (optional)
  --chaos         Enable chaos mode (optional)
  --json          Output raw JSON (optional)
  --hash-only     Output only the result hash (optional)

Participant format:
  { "name": "SlothName", "spd": 10, "acc": 10, "sta": 10, "agi": 10, "ref": 10, "lck": 10 }

Optional participant fields:
  id, wallet, isBot, gridPosition, passive

Example:
  npx tsx verify.ts --seed "abc123" --participants '[{"name":"Sloth1","spd":15,"acc":12,"sta":10,"agi":8,"ref":7,"lck":6},{"name":"Sloth2","spd":10,"acc":14,"sta":12,"agi":10,"ref":9,"lck":5}]'
  `);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (!args.seed || !args.participants) {
    printUsage();
    process.exit(1);
  }

  // Parse participants
  let participantInputs: ParticipantInput[];
  try {
    participantInputs = JSON.parse(args.participants);
    if (!Array.isArray(participantInputs) || participantInputs.length < 2) {
      console.error("Error: participants must be a JSON array with at least 2 entries");
      process.exit(1);
    }
  } catch (e) {
    console.error("Error: Invalid JSON for --participants");
    console.error((e as Error).message);
    process.exit(1);
  }

  // Validate required stats
  const requiredStats = ["name", "spd", "acc", "sta", "agi", "ref", "lck"] as const;
  for (let i = 0; i < participantInputs.length; i++) {
    const p = participantInputs[i];
    for (const stat of requiredStats) {
      if (p[stat] === undefined || p[stat] === null) {
        console.error(`Error: Participant ${i + 1} is missing required field: ${stat}`);
        process.exit(1);
      }
    }
  }

  // Build SlothStats array with defaults
  const participants: SlothStats[] = participantInputs.map((p, i) => ({
    id: p.id ?? i + 1,
    name: p.name,
    wallet: p.wallet ?? `0x${"0".repeat(38)}${(i + 1).toString(16).padStart(2, "0")}`,
    isBot: p.isBot ?? false,
    spd: p.spd,
    acc: p.acc,
    sta: p.sta,
    agi: p.agi,
    ref: p.ref,
    lck: p.lck,
    gridPosition: p.gridPosition ?? i + 1,
    passive: p.passive,
  }));

  // Parse optional tactic actions
  let actions: TacticAction[] = [];
  if (args.actions) {
    try {
      actions = JSON.parse(args.actions);
    } catch (e) {
      console.error("Error: Invalid JSON for --actions");
      process.exit(1);
    }
  }

  const chaosMode = args.chaos === "true";
  const seed = args.seed;

  // Run simulation
  const result = simulateRace(participants, seed, actions, chaosMode);

  // Generate result hash (same as server: SHA-256 of JSON.stringify(finalOrder))
  const resultHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(result.finalOrder))
    .digest("hex");

  // Output
  if (args["hash-only"]) {
    console.log(resultHash);
    return;
  }

  if (args.json === "true") {
    console.log(JSON.stringify({
      seed,
      weather: result.weather,
      trackLength: result.trackLength,
      totalTicks: result.totalTicks,
      totalEvents: result.events.length,
      resultHash,
      finalOrder: result.finalOrder.map((s, i) => ({
        position: i + 1,
        ...s,
      })),
    }, null, 2));
    return;
  }

  // Formatted output
  const weather = getWeatherFromSeed(seed);
  console.log("=".repeat(50));
  console.log("  SLOTH RUSH — Race Verification Result");
  console.log("=".repeat(50));
  console.log();
  console.log(`  Seed:       ${seed}`);
  console.log(`  Weather:    ${weather}`);
  console.log(`  Track:      ${result.trackLength} units`);
  console.log(`  Duration:   ${result.totalTicks} ticks (${(result.totalTicks / 10).toFixed(1)}s)`);
  console.log(`  Events:     ${result.events.length} race events`);
  console.log();
  console.log("-".repeat(50));
  console.log("  FINAL ORDER");
  console.log("-".repeat(50));

  result.finalOrder.forEach((s, i) => {
    const medal = i === 0 ? " [WINNER]" : "";
    const finishTime = s.finishTick < 1500
      ? `${(s.finishTick / 10).toFixed(1)}s`
      : "DNF";
    console.log(`  ${i + 1}. ${s.name.padEnd(20)} Tick: ${String(s.finishTick).padStart(5)}  (${finishTime})${medal}`);
  });

  console.log();
  console.log("-".repeat(50));
  console.log(`  Result Hash (SHA-256):`);
  console.log(`  ${resultHash}`);
  console.log("-".repeat(50));

  if (result.events.length > 0) {
    console.log();
    console.log("  KEY EVENTS:");
    for (const event of result.events.slice(0, 10)) {
      console.log(`  [Tick ${String(event.tick).padStart(4)}] ${event.type}: ${event.description}`);
    }
    if (result.events.length > 10) {
      console.log(`  ... and ${result.events.length - 10} more events`);
    }
  }

  console.log();
  console.log("  Verify: Run this command again with the same seed and");
  console.log("  participants to confirm the result hash matches.");
  console.log("=".repeat(50));
}

main();
