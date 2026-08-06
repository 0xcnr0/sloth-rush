/**
 * RACER RUSH — QA Test Agent
 * Automated end-to-end test suite that plays the entire game and finds bugs.
 * Run with: npx tsx qa-agent.ts
 */

import { Pool } from "pg";

// ============================================================
// SECTION 1: CONFIGURATION
// ============================================================

const BASE_URL = process.env.QA_BASE_URL || "http://localhost:3001";
const WALLET_A = "0x1111000000000000000000000000000000000001";
const WALLET_B = "0x2222000000000000000000000000000000000002";
const OLD_WALLET_A = "0x1111111111111111111111111111111111111111";
const OLD_WALLET_B = "0x2222222222222222222222222222222222222222";

// Economy constants — these mirror backend/src/routes/racer.ts. Sprint 8
// rebalanced training and added the mint welcome bonus; the suite went stale
// against that change, so keep code, tests and CLAUDE.md moving together.
const WELCOME_BONUS = 10;
const DAILY_LOGIN_BONUS = 15;
const TRAINING_COST = 5;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://localhost:5432/wind_up_rush",
});

// ============================================================
// SECTION 2: HTTP CLIENT
// ============================================================

interface ApiResponse {
  status: number;
  data: any;
}

/**
 * Shared secret that lets this suite opt out of rate limiting. The backend only
 * honours it outside production and only when the same value is configured
 * there, so it cannot weaken a deployed server. Suite D omits it on purpose.
 */
const QA_BYPASS_TOKEN = process.env.QA_BYPASS_TOKEN || "";

async function api(
  method: "GET" | "POST",
  path: string,
  body?: any,
  opts_?: { rateLimited?: boolean }
): Promise<ApiResponse> {
  const url = BASE_URL + path;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // Suite D needs the real limiter, so it asks to stay rate limited.
  if (QA_BYPASS_TOKEN && !opts_?.rateLimited) headers["x-qa-bypass"] = QA_BYPASS_TOKEN;
  const opts: RequestInit = {
    method,
    headers,
  };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, opts);
    let data: any;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = { _raw: text };
    }
    if (res.status >= 400) {
      // Log failures for debugging but don't throw
    }
    return { status: res.status, data };
  } catch (err: any) {
    console.error(`  [HTTP ERROR] ${method} ${path} → ${err.message}`);
    throw err;
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Throttled API call — adds 100ms delay after each request to avoid rate limits */
async function tapi(
  method: "GET" | "POST",
  path: string,
  body?: any
): Promise<ApiResponse> {
  const res = await api(method, path, body);
  await delay(100);
  return res;
}

// ============================================================
// SECTION 3: DATABASE HELPERS
// ============================================================

async function dbQuery(sql: string, params: any[] = []): Promise<any[]> {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function dbGetOne(sql: string, params: any[] = []): Promise<any | null> {
  const rows = await dbQuery(sql, params);
  return rows[0] || null;
}

async function getDbBalance(wallet: string): Promise<number> {
  const row = await dbGetOne(
    "SELECT balance FROM coin_balances WHERE wallet = $1",
    [wallet]
  );
  return row ? Number(row.balance) : 0;
}

async function fastForwardTraining(racerId: number): Promise<void> {
  await pool.query(
    "UPDATE trainings SET completed_at = NOW() - interval '1 minute' WHERE racer_id = $1 AND claimed = 0",
    [racerId]
  );
}

async function cleanup(): Promise<void> {
  const wallets = [WALLET_A, WALLET_B, OLD_WALLET_A, OLD_WALLET_B];

  // Clean up today's daily race entry regardless
  try {
    const today = new Date().toISOString().split("T")[0];
    await pool.query("DELETE FROM daily_races WHERE race_date = $1", [today]);
  } catch { /* ignore */ }

  // Get racer IDs
  let racerIds: number[] = [];
  try {
    const rows = await dbQuery(
      "SELECT id FROM racers WHERE wallet = ANY($1)",
      [wallets]
    );
    racerIds = rows.map((r) => r.id);
  } catch {
    /* table might not exist */
  }

  // Get race IDs these wallets participated in
  let raceIds: string[] = [];
  try {
    const rows = await dbQuery(
      "SELECT DISTINCT race_id FROM race_participants WHERE wallet = ANY($1)",
      [wallets]
    );
    raceIds = rows.map((r) => r.race_id);
  } catch {
    /* ignore */
  }

  // Also include bot racer IDs from those races
  if (raceIds.length > 0) {
    try {
      const botRows = await dbQuery(
        "SELECT DISTINCT racer_id FROM race_participants WHERE race_id = ANY($1) AND is_bot = 1",
        [raceIds]
      );
      const botRacerIds = botRows.map((r) => r.racer_id);
      racerIds = [...new Set([...racerIds, ...botRacerIds])];
    } catch {
      /* ignore */
    }
  }

  // Child tables using racer IDs
  const racerTables = [
    "race_participants",
    "trainings",
    "daily_minigame_plays",
    "user_cosmetics",
    "user_accessories",
    "racer_equipment",
    "streaks",
    "daily_stat_gains",
  ];
  for (const table of racerTables) {
    try {
      if (racerIds.length > 0) {
        await pool.query(
          `DELETE FROM ${table} WHERE racer_id = ANY($1)`,
          [racerIds]
        );
      }
    } catch {
      /* table might not exist */
    }
  }

  // Race-keyed tables
  if (raceIds.length > 0) {
    for (const table of [
      "race_replays",
      "tactic_actions",
      "weather_log",
      "daily_races",
    ]) {
      try {
        await pool.query(`DELETE FROM ${table} WHERE race_id = ANY($1)`, [
          raceIds,
        ]);
      } catch {
        /* ignore */
      }
    }
    // Delete races themselves
    try {
      await pool.query("DELETE FROM races WHERE id = ANY($1)", [raceIds]);
    } catch {
      /* ignore */
    }
  }

  // Wallet-keyed tables
  const walletTables = [
    "coin_balances",
    "transactions",
    "daily_logins",
    "user_xp",
    "user_quest_progress",
    "daily_free_races",
    "race_points",
    "gp_points",
  ];
  for (const table of walletTables) {
    try {
      await pool.query(`DELETE FROM ${table} WHERE wallet = ANY($1)`, [
        wallets,
      ]);
    } catch {
      /* table might not exist */
    }
  }

  // Delete racers last
  try {
    await pool.query("DELETE FROM racers WHERE wallet = ANY($1)", [wallets]);
  } catch {
    /* ignore */
  }

  // Also clean up bot racers that were created for test races
  if (racerIds.length > 0) {
    try {
      await pool.query("DELETE FROM racers WHERE id = ANY($1) AND wallet LIKE 'bot_%'", [racerIds]);
    } catch {
      /* ignore */
    }
  }

  // Clean up wallets used in economy and rate limit tests
  const extraWallets = ["0x3333000000000000000000000000000000000003", "0x9999000000000000000000000000000000000099"];
  for (const w of extraWallets) {
    try {
      await pool.query("DELETE FROM racers WHERE wallet = $1", [w]);
      await pool.query("DELETE FROM coin_balances WHERE wallet = $1", [w]);
    } catch { /* ignore */ }
  }
  // Rate test racers
  try {
    await pool.query("DELETE FROM racers WHERE wallet LIKE '0xaaaa%'");
  } catch { /* ignore */ }
}

// ============================================================
// SECTION 4: TEST FRAMEWORK
// ============================================================

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  duration: number;
  error?: string;
  response?: any;
}

interface TestContext {
  walletA: string;
  walletB: string;
  freeRacerIdA?: number;
  racerIdA?: number;
  freeRacerIdB?: number;
  raceId?: string;
  balanceA?: number;
  cosmeticId?: number;
  accessoryId?: number;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual(actual: any, expected: any, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertStatus(res: ApiResponse, expected: number): void {
  if (res.status !== expected) {
    throw new Error(
      `Expected status ${expected}, got ${res.status} — ${JSON.stringify(res.data)}`
    );
  }
}

async function runTest(
  name: string,
  category: string,
  fn: () => Promise<void>
): Promise<TestResult> {
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    console.log(`  [PASS] ${name} (${duration}ms)`);
    return { name, category, passed: true, duration };
  } catch (err: any) {
    const duration = Date.now() - start;
    console.log(`  [FAIL] ${name} (${duration}ms) → ${err.message}`);
    return {
      name,
      category,
      passed: false,
      duration,
      error: err.message,
    };
  }
}

function printReport(results: TestResult[]): void {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log("\n" + "=".repeat(60));
  console.log("  QA REPORT");
  console.log("=".repeat(60));
  console.log(`  Total:  ${total}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Rate:   ${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%`);

  // Per-category breakdown
  const categories = [...new Set(results.map((r) => r.category))];
  console.log("\n  Per Category:");
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    const catPassed = catResults.filter((r) => r.passed).length;
    const catFailed = catResults.length - catPassed;
    const icon = catFailed === 0 ? "OK" : "!!";
    console.log(
      `    [${icon}] ${cat}: ${catPassed}/${catResults.length} passed`
    );
  }

  if (failed > 0) {
    console.log("\n  Failures:");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`    - [${r.category}] ${r.name}`);
      console.log(`      ${r.error}`);
    }
  }

  console.log("\n" + "=".repeat(60));
}

// ============================================================
// SECTION 5: TEST SUITES
// ============================================================

// --- SUITE A: Happy Path ---
async function runHappyPath(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(
    await runTest("A01: Health check", "Happy Path", async () => {
      const res = await tapi("GET", "/health");
      assertStatus(res, 200);
      assertEqual(res.data.status, "ok", "health status");
    })
  );

  results.push(
    await runTest("A02: Mint free racer (wallet A)", "Happy Path", async () => {
      const res = await tapi("POST", "/api/racer/mint", { wallet: WALLET_A });
      assert(res.status === 200 || res.status === 201, `Expected 200/201, got ${res.status}`);
      assert(res.data.racer != null, "racer should exist");
      assertEqual(res.data.racer.type, "free", "type should be free");
      ctx.freeRacerIdA = res.data.racer.id;
    })
  );

  results.push(
    await runTest("A03: Mint free racer (wallet B)", "Happy Path", async () => {
      const res = await tapi("POST", "/api/racer/mint", { wallet: WALLET_B });
      assert(res.status === 200 || res.status === 201, `Expected 200/201, got ${res.status}`);
      assert(res.data.racer != null, "racer should exist");
      ctx.freeRacerIdB = res.data.racer.id;
    })
  );

  results.push(
    await runTest("A04: View collection", "Happy Path", async () => {
      const res = await tapi("GET", `/api/racer/collection/${WALLET_A}`);
      assertStatus(res, 200);
      assert(Array.isArray(res.data.racers), "racers should be array");
      assertEqual(res.data.racers.length, 1, "should have 1 racer");
      assertEqual(res.data.racers[0].type, "free", "type");
    })
  );

        results.push(
    await runTest("A08: Check XP", "Happy Path", async () => {
      const res = await tapi("GET", `/api/racer/xp/${WALLET_A}`);
      assertStatus(res, 200);
      assert(res.data.xp >= 0, "xp should exist");
    })
  );

  results.push(
    await runTest("A09: View profile", "Happy Path", async () => {
      const res = await tapi("GET", `/api/racer/profile/${WALLET_A}`);
      assertStatus(res, 200);
      assertEqual(res.data.wallet, WALLET_A, "wallet should match");
    })
  );

    results.push(
    await runTest("A11: Get daily race", "Happy Path", async () => {
      const res = await tapi("GET", "/api/race/daily");
      assertStatus(res, 200);
      assert(res.data.raceId != null, "raceId should exist");
      ctx.raceId = res.data.raceId;
    })
  );

  results.push(
    await runTest("A12: Join exhibition race", "Happy Path", async () => {
      const res = await tapi("POST", "/api/race/join", {
        raceId: ctx.raceId,
        racerId: ctx.freeRacerIdA,
        wallet: WALLET_A,
      });
      assertStatus(res, 200);
      assertEqual(res.data.joined, true, "joined should be true");
    })
  );

  results.push(
    await runTest("A13: Start the race", "Happy Path", async () => {
      const res = await tapi("POST", "/api/race/start", {
        raceId: ctx.raceId,
      });
      assertStatus(res, 200);
      assertEqual(res.data.status, "racing", "the race should start running");
    })
  );

  // --- In-race items -------------------------------------------------------
  // The pure functions have unit tests; this covers the HTTP contract, which is
  // where the guarantee actually lives: the server picks the tick, and it must
  // always be ahead of what the player has already watched.

  results.push(
    await runTest("A13a: Items report the loadout and a future tick", "Happy Path", async () => {
      const res = await tapi("GET", `/api/race/${ctx.raceId}/items?racerId=${ctx.freeRacerIdA}`);
      assertStatus(res, 200);
      assert(Array.isArray(res.data.loadout), "loadout should be an array");
      assert(
        res.data.earliestTick > res.data.revealedTick,
        `an item must land ahead of the frontier: ${res.data.earliestTick} vs ${res.data.revealedTick}`
      );
    })
  );

  results.push(
    await runTest("A13b: Deploying schedules past the reveal frontier", "Happy Path", async () => {
      const before = await tapi("GET", `/api/race/${ctx.raceId}/items?racerId=${ctx.freeRacerIdA}`);
      const res = await tapi("POST", "/api/race/item", {
        raceId: ctx.raceId, racerId: ctx.freeRacerIdA, wallet: WALLET_A, code: "boost",
      });
      assertStatus(res, 200);
      assert(
        res.data.tick > res.data.revealedTick,
        `scheduled into the past: tick ${res.data.tick}, frontier ${res.data.revealedTick}`
      );
      const after = await tapi("GET", `/api/race/${ctx.raceId}/items?racerId=${ctx.freeRacerIdA}`);
      assert(
        after.data.remaining.length < before.data.remaining.length,
        "deploying should consume one item"
      );
    })
  );

  results.push(
    await runTest("A13c: A racer cannot use more than it carries", "Happy Path", async () => {
      // Drain whatever is left, then ask once more.
      for (let i = 0; i < 4; i++) {
        await tapi("POST", "/api/race/item", {
          raceId: ctx.raceId, racerId: ctx.freeRacerIdA, wallet: WALLET_A, code: "boost",
        });
        await tapi("POST", "/api/race/item", {
          raceId: ctx.raceId, racerId: ctx.freeRacerIdA, wallet: WALLET_A, code: "hinder",
        });
      }
      const boost = await tapi("POST", "/api/race/item", {
        raceId: ctx.raceId, racerId: ctx.freeRacerIdA, wallet: WALLET_A, code: "boost",
      });
      assert(boost.status === 400, `an empty loadout should refuse, got ${boost.status}`);
    })
  );

  results.push(
    await runTest("A13d: Only the owner may deploy", "Happy Path", async () => {
      const res = await tapi("POST", "/api/race/item", {
        raceId: ctx.raceId, racerId: ctx.freeRacerIdA, wallet: WALLET_B, code: "boost",
      });
      assert(res.status === 403, `another wallet should be refused, got ${res.status}`);
    })
  );


  results.push(
    await runTest("A14: Simulate race", "Happy Path", async () => {
      const res = await tapi("POST", "/api/race/simulate", {
        raceId: ctx.raceId,
      });
      assertStatus(res, 200);
      assert(res.data.finalOrder != null, "finalOrder should exist");
      assert(res.data.frames != null, "frames should exist");
      assert(res.data.weather != null, "weather should exist");
    })
  );

  results.push(
    await runTest("A15: View race results", "Happy Path", async () => {
      const res = await tapi("GET", `/api/race/${ctx.raceId}`);
      assertStatus(res, 200);
      assertEqual(res.data.status, "finished", "race should be finished");
    })
  );

  results.push(
    await runTest("A16: View race replay", "Happy Path", async () => {
      const res = await tapi("GET", `/api/race/${ctx.raceId}/replay`);
      assertStatus(res, 200);
      assert(res.data.frames != null, "frames should exist");
    })
  );

  results.push(
    await runTest("A17: View race history", "Happy Path", async () => {
      const res = await tapi("GET", `/api/race/history/${WALLET_A}`);
      assertStatus(res, 200);
      assert(Array.isArray(res.data.races), "races should be array");
      assert(res.data.races.length >= 1, "should have at least 1 race");
    })
  );

      results.push(
    await runTest("A20: Upgrade free racer to racer", "Happy Path", async () => {
      const balBefore = (await tapi("GET", `/api/racer/coin/${WALLET_A}`)).data.balance;
      ctx.balanceA = balBefore;
      const res = await tapi("POST", "/api/racer/upgrade", {
        wallet: WALLET_A,
      });
      assert(res.status === 200 || res.status === 201, `Expected 200/201, got ${res.status}`);
      assert(res.data.racer != null, "racer should exist");
      assertEqual(res.data.racer.type, "pro", "type should be racer");
      assertEqual(res.data.coinBonus, 500, "coin bonus should be 500");
      ctx.racerIdA = res.data.racer.id;
    })
  );

    results.push(
    await runTest("A22: Rename racer", "Happy Path", async () => {
      const res = await tapi("POST", "/api/racer/rename", {
        wallet: WALLET_A,
        racerId: ctx.racerIdA,
        name: "TestRacer",
      });
      assertStatus(res, 200);
      assertEqual(res.data.renamed, true, "renamed should be true");
    })
  );

          results.push(
    await runTest("A27: Standard race full flow", "Happy Path", async () => {
      // Create
      const createRes = await tapi("POST", "/api/race/create", {
        format: "sprint",
      });
      assert(createRes.status === 200 || createRes.status === 201, "create race");
      const raceId = createRes.data.raceId;

      // Join
      const joinRes = await tapi("POST", "/api/race/join", {
        raceId,
        racerId: ctx.racerIdA,
        wallet: WALLET_A,
      });
      assertStatus(joinRes, 200);

      // Start tuning
      const tuneStartRes = await tapi("POST", "/api/race/start", {
        raceId,
      });
      assertStatus(tuneStartRes, 200);

      // Simulate
      const simRes = await tapi("POST", "/api/race/simulate", { raceId });
      assertStatus(simRes, 200);
      assert(simRes.data.finalOrder != null, "finalOrder should exist");
    })
  );

                        results.push(
    await runTest("A39: Leaderboard (me)", "Happy Path", async () => {
      const res = await tapi("GET", `/api/leaderboard/me/${WALLET_A}`);
      assertStatus(res, 200);
    })
  );

  results.push(
    await runTest("A40: Career leaderboard", "Happy Path", async () => {
      const res = await tapi("GET", "/api/leaderboard/career");
      assertStatus(res, 200);
      assert(
        Array.isArray(res.data.leaderboard),
        "leaderboard should be array"
      );
    })
  );

  results.push(
    await runTest("A41: Hall of fame", "Happy Path", async () => {
      const res = await tapi("GET", "/api/leaderboard/hall-of-fame");
      assertStatus(res, 200);
    })
  );

  results.push(
    await runTest("A42: League leaderboard", "Happy Path", async () => {
      const res = await tapi("GET", "/api/leaderboard/bronze");
      assertStatus(res, 200);
    })
  );

  results.push(
    await runTest("A43: Current season", "Happy Path", async () => {
      const res = await tapi("GET", "/api/season/current");
      assertStatus(res, 200);
    })
  );

  results.push(
    await runTest("A44: Active races", "Happy Path", async () => {
      const res = await tapi("GET", "/api/race/active");
      assertStatus(res, 200);
    })
  );

    results.push(
    await runTest("A46: Upgrade progress", "Happy Path", async () => {
      const res = await tapi(
        "GET",
        `/api/racer/upgrade-progress/${WALLET_A}`
      );
      assertStatus(res, 200);
    })
  );

  results.push(
    await runTest("A47: Streaks", "Happy Path", async () => {
      const res = await tapi("GET", `/api/racer/streaks/${WALLET_A}`);
      assertStatus(res, 200);
    })
  );

  return results;
}

// --- SUITE B: Edge Cases ---
async function runEdgeCases(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(
    await runTest("B01: Double mint -> 409", "Edge Cases", async () => {
      // Wallet A already has a racer from happy path
      const res = await tapi("POST", "/api/racer/mint", { wallet: WALLET_A });
      assert(
        res.status === 409 || res.status === 400,
        `Expected 409/400, got ${res.status}`
      );
    })
  );

  results.push(
    await runTest("B02: Mint with empty wallet -> 400", "Edge Cases", async () => {
      const res = await tapi("POST", "/api/racer/mint", { wallet: "" });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("B03: Upgrade without free racer -> 400/404", "Edge Cases", async () => {
      const res = await tapi("POST", "/api/racer/upgrade", {
        wallet: "0x9999000000000000000000000000000000000099",
      });
      assert(
        res.status === 400 || res.status === 404,
        `Expected 400/404, got ${res.status}`
      );
    })
  );

    results.push(
    await runTest("B05: Free racer joins paid race -> 400", "Edge Cases", async () => {
      const createRes = await tapi("POST", "/api/race/create", {
        format: "sprint",
      });
      const raceId = createRes.data.raceId;
      const res = await tapi("POST", "/api/race/join", {
        raceId,
        racerId: ctx.freeRacerIdB,
        wallet: WALLET_B,
      });
      assertStatus(res, 400);
    })
  );

    results.push(
    await runTest("B08: Rename with < 3 chars -> 400", "Edge Cases", async () => {
      const res = await tapi("POST", "/api/racer/rename", {
        wallet: WALLET_A,
        racerId: ctx.racerIdA,
        name: "AB",
      });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("B09: Rename with > 20 chars -> 400", "Edge Cases", async () => {
      const res = await tapi("POST", "/api/racer/rename", {
        wallet: WALLET_A,
        racerId: ctx.racerIdA,
        name: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      });
      assertStatus(res, 400);
    })
  );

          results.push(
    await runTest("B14: Join non-existent race -> 404", "Edge Cases", async () => {
      const res = await tapi("POST", "/api/race/join", {
        raceId: "race_nonexistent_999",
        racerId: ctx.racerIdA,
        wallet: WALLET_A,
      });
      assertStatus(res, 404);
    })
  );

  results.push(
    await runTest("B15: Invalid package ID -> 404", "Edge Cases", async () => {
      const res = await tapi("POST", "/api/shop/buy-coins", {
        wallet: WALLET_A,
        packageId: "invalid_pack",
      });
      assertStatus(res, 404);
    })
  );

  results.push(
    await runTest("B16: Rename with profanity -> 400", "Edge Cases", async () => {
      const res = await tapi("POST", "/api/racer/rename", {
        wallet: WALLET_A,
        racerId: ctx.racerIdA,
        name: "fuck you",
      });
      assertStatus(res, 400);
    })
  );

  return results;
}

// --- SUITE C: Security ---
async function runSecurity(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(
    await runTest("C01: Rename another wallet's racer -> 403/404", "Security", async () => {
      const res = await tapi("POST", "/api/racer/rename", {
        wallet: WALLET_B,
        racerId: ctx.racerIdA,
        name: "Hacked",
      });
      assert(
        res.status === 403 || res.status === 404,
        `Expected 403/404, got ${res.status}`
      );
    })
  );

    results.push(
    await runTest("C03: Invalid wallet format (no 0x) -> 400", "Security", async () => {
      const res = await tapi("POST", "/api/racer/mint", {
        wallet: "TEST000000000000000000000000000000000099",
      });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("C04: Invalid wallet format (too short) -> 400", "Security", async () => {
      const res = await tapi("POST", "/api/racer/mint", {
        wallet: "0x123",
      });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("C05: SQL injection in wallet -> 400", "Security", async () => {
      const res = await tapi("POST", "/api/racer/mint", {
        wallet: "0x' OR '1'='1",
      });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("C06: SQL injection in name -> 400", "Security", async () => {
      const res = await tapi("POST", "/api/racer/rename", {
        wallet: WALLET_A,
        racerId: ctx.racerIdA,
        name: "'; DROP TABLE racers;--",
      });
      assertStatus(res, 400);
    })
  );

      results.push(
    await runTest("C10: Invalid league name -> 400", "Security", async () => {
      const res = await tapi("GET", "/api/leaderboard/platinum");
      assertStatus(res, 400);
    })
  );

  return results;
}

// --- SUITE D: Rate Limits ---
async function runRateLimits(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(
    await runTest("D01: General rate limit (101 rapid requests)", "Rate Limits", async () => {
      let got429 = false;
      // Use /api endpoint (general limiter applies to /api, not /health)
      for (let i = 0; i < 120; i++) {
        const r = await api("GET", "/api/racer/coin/0x0000000000000000000000000000000000000000", undefined, { rateLimited: true });
        if (r.status === 429) {
          got429 = true;
          break;
        }
      }
      assert(got429, "Should have received 429 from rate limiter after 100+ requests");
    })
  );

  // Wait for rate limit window to reset
  await delay(2000);

  results.push(
    await runTest("D02: Strict rate limit on mint (11 rapid)", "Rate Limits", async () => {
      let got429 = false;
      for (let i = 0; i < 15; i++) {
        const wallet = `0xaaaa000000000000000000000000000000000${String(i).padStart(3, "0")}`;
        const res = await api("POST", "/api/racer/mint", { wallet }, { rateLimited: true });
        if (res.status === 429) {
          got429 = true;
          break;
        }
      }
      assert(got429, "Should have received 429 from strict rate limiter");
      // Clean up rate test racers
      try {
        await pool.query(
          "DELETE FROM racers WHERE wallet LIKE '0xaaaa%'"
        );
      } catch {
        /* ignore */
      }
    })
  );

  return results;
}

// --- SUITE E: Economy Audit ---
async function runEconomyAudit(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Ensure wallet A has enough coins for economy tests (race entry, etc.)
  try {
    await pool.query(
      "INSERT INTO coin_balances (wallet, balance) VALUES ($1, 2000) ON CONFLICT (wallet) DO UPDATE SET balance = 2000",
      [WALLET_A]
    );
  } catch { /* ignore */ }

                return results;
}

// --- SUITE F: Race Logic ---
async function runRaceLogic(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Ensure wallet A has enough coins for race entries and tactic actions
  try {
    await pool.query(
      "INSERT INTO coin_balances (wallet, balance) VALUES ($1, 5000) ON CONFLICT (wallet) DO UPDATE SET balance = 5000",
      [WALLET_A]
    );
  } catch { /* ignore */ }

  results.push(
    await runTest("F01: Exhibition full flow", "Race Logic", async () => {
      const createRes = await tapi("POST", "/api/race/create", {
        format: "exhibition",
      });
      assert(createRes.status === 200 || createRes.status === 201, "create");
      const raceId = createRes.data.raceId;

      const joinRes = await tapi("POST", "/api/race/join", {
        raceId,
        racerId: ctx.racerIdA,
        wallet: WALLET_A,
      });
      assertStatus(joinRes, 200);

      const tuneRes = await tapi("POST", "/api/race/start", { raceId });
      assertStatus(tuneRes, 200);

      const simRes = await tapi("POST", "/api/race/simulate", { raceId });
      assertStatus(simRes, 200);
      assert(simRes.data.finalOrder != null, "finalOrder");
      assert(simRes.data.frames != null, "frames");

      const raceRes = await tapi("GET", `/api/race/${raceId}`);
      assertEqual(raceRes.data.status, "finished", "race finished");
    })
  );

  results.push(
    await runTest("F02: A race runs end to end", "Race Logic", async () => {
      const createRes = await tapi("POST", "/api/race/create", {
        format: "sprint",
      });
      const raceId = createRes.data.raceId;

      await tapi("POST", "/api/race/join", {
        raceId,
        racerId: ctx.racerIdA,
        wallet: WALLET_A,
      });

      await tapi("POST", "/api/race/start", { raceId });

      const simRes = await tapi("POST", "/api/race/simulate", { raceId });
      assertStatus(simRes, 200);
      assert(simRes.data.finalOrder != null, "finalOrder");
      assert(simRes.data.gridPositions != null, "gridPositions");
      // Verify rewards exist
    })
  );

      results.push(
    await runTest("E01: Racing is free and pays nothing", "Economy", async () => {
      // V1 has no in-game currency. This test exists because the last two
      // versions of the economy both leaked: bots funded a prize pool they were
      // not in, and practice paid a reward the lobby said it did not.
      for (const format of ["exhibition", "sprint", "endurance"]) {
        const createRes = await tapi("POST", "/api/race/create", { format });
        assertStatus(createRes, 201);
        const raceId = createRes.data.raceId;
        const joinRes = await tapi("POST", "/api/race/join", {
          raceId, racerId: ctx.racerIdA, wallet: WALLET_A,
        });
        assertStatus(joinRes, 200);
        assert(
          joinRes.data.entryFeeCharged === 0,
          `${format} charged ${joinRes.data.entryFeeCharged}`
        );
        await tapi("POST", "/api/race/start", { raceId });
        const sim = await tapi("POST", "/api/race/simulate", { raceId });
        assertStatus(sim, 200);
        const paid = sim.data.finalOrder.filter((o: any) => (o.reward || 0) > 0);
        assert(paid.length === 0, `${format} paid out to ${paid.length} racers`);
      }
    })
  );

  results.push(
    await runTest("E02: Racing is the only thing that grows a racer", "Economy", async () => {
      // Training, mini-games, boosters and accessories are gone, so if this
      // stops working there is no progression left in the game at all.
      const before = await tapi("GET", `/api/racer/collection/${WALLET_A}`);
      const statTotal = (r: any) => r.spd + r.acc + r.sta + r.agi + r.ref + r.lck;
      const mine = (d: any) => d.data.racers.find((r: any) => r.id === ctx.racerIdA);

      const createRes = await tapi("POST", "/api/race/create", { format: "sprint" });
      const raceId = createRes.data.raceId;
      await tapi("POST", "/api/race/join", { raceId, racerId: ctx.racerIdA, wallet: WALLET_A });
      await tapi("POST", "/api/race/start", { raceId });
      await tapi("POST", "/api/race/simulate", { raceId });

      const after = await tapi("GET", `/api/racer/collection/${WALLET_A}`);
      assert(
        statTotal(mine(after)) > statTotal(mine(before)),
        `stats did not grow: ${statTotal(mine(before))} -> ${statTotal(mine(after))}`
      );
    })
  );

  results.push(
    await runTest("E03: Retired systems are gone from the API", "Economy", async () => {
      // Deleting a page but leaving its endpoint mounted is how a cut feature
      // comes back. Each of these used to exist.
      const gone: [string, string][] = [
        ["POST", "/api/racer/train"],
        ["POST", "/api/racer/mini-game"],
        ["POST", "/api/racer/daily-login"],
        ["POST", "/api/racer/evolve"],
        ["GET", "/api/shop/packages"],
        ["GET", "/api/quests/daily/" + WALLET_A],
      ];
      for (const [method, path] of gone) {
        const res = method === "GET"
          ? await tapi("GET", path)
          : await tapi("POST", path, {});
        assert(res.status === 404, `${method} ${path} still answers ${res.status}`);
      }
    })
  );

  results.push(
    await runTest("F03: Sprint and Endurance run different distances", "Race Logic", async () => {
      // The whole point of having two paid formats. If they simulate to the
      // same track length the second one is decoration, and this test is the
      // only thing standing between that and a shipped build.
      const run = async (format: string) => {
        const createRes = await tapi("POST", "/api/race/create", { format });
        assertStatus(createRes, 201);
        const raceId = createRes.data.raceId;
        await tapi("POST", "/api/race/join", {
          raceId,
          racerId: ctx.racerIdA,
          wallet: WALLET_A,
        });
        await tapi("POST", "/api/race/start", { raceId });
        const simRes = await tapi("POST", "/api/race/simulate", { raceId });
        assertStatus(simRes, 200);
        return simRes.data;
      };

      const sprint = await run("sprint");
      const endurance = await run("endurance");

      assert(
        endurance.trackLength > sprint.trackLength,
        `endurance should be longer: ${endurance.trackLength} vs ${sprint.trackLength}`
      );
      assert(
        endurance.totalTicks > sprint.totalTicks,
        `endurance should take longer: ${endurance.totalTicks} vs ${sprint.totalTicks} ticks`
      );
    })
  );

  results.push(
    await runTest("F04: Retired formats are refused by the server", "Race Logic", async () => {
      // Cut means cut. Hiding a format behind a UI flag leaves the endpoint
      // open, and an endpoint that still creates Grand Prix races is a feature
      // that still has to work.
      for (const format of ["grand_prix", "tactic", "standard"]) {
        const res = await tapi("POST", "/api/race/create", { format });
        assert(res.status === 400, `${format} should be refused, got ${res.status}`);
      }
    })
  );

  results.push(
    await runTest("F05: Bot filling (3 bots for 1 player)", "Race Logic", async () => {
      const createRes = await tapi("POST", "/api/race/create", {
        format: "exhibition",
      });
      const raceId = createRes.data.raceId;

      await tapi("POST", "/api/race/join", {
        raceId,
        racerId: ctx.racerIdA,
        wallet: WALLET_A,
      });

      const tuneRes = await tapi("POST", "/api/race/start", { raceId });
      assertStatus(tuneRes, 200);
      assertEqual(tuneRes.data.botsAdded, 3, "should add 3 bots");

      // Verify total participants = 4
      const raceRes = await tapi("GET", `/api/race/${raceId}`);
      assert(
        raceRes.data.participants && raceRes.data.participants.length === 4,
        `should have 4 participants, got ${raceRes.data.participants?.length || 0}`
      );

      // Cleanup
      await tapi("POST", "/api/race/simulate", { raceId });
    })
  );

  results.push(
    await runTest("F06: Daily race same ID same day", "Race Logic", async () => {
      const res1 = await tapi("GET", "/api/race/daily");
      const res2 = await tapi("GET", "/api/race/daily");
      assertStatus(res1, 200);
      assertStatus(res2, 200);
      assertEqual(
        res1.data.raceId,
        res2.data.raceId,
        "same day should return same race ID"
      );
    })
  );

  results.push(
    await runTest("F08: Streak tracking", "Race Logic", async () => {
      const res = await tapi("GET", `/api/racer/streaks/${WALLET_A}`);
      assertStatus(res, 200);
      assert(Array.isArray(res.data.streaks), "streaks should be array");
    })
  );

  results.push(
    await runTest("F09: Race replay saved", "Race Logic", async () => {
      // Use a race we've already simulated — find one from history
      const histRes = await tapi("GET", `/api/race/history/${WALLET_A}`);
      assertStatus(histRes, 200);
      if (histRes.data.races && histRes.data.races.length > 0) {
        const lastRaceId = histRes.data.races[0].raceId;
        const replayRes = await tapi("GET", `/api/race/${lastRaceId}/replay`);
        assertStatus(replayRes, 200);
        assert(replayRes.data.frames != null, "replay frames should exist");
      } else {
        throw new Error("No race history to check replay");
      }
    })
  );

  results.push(
    await runTest("F10: Weather exists in simulation", "Race Logic", async () => {
      const createRes = await tapi("POST", "/api/race/create", {
        format: "exhibition",
      });
      const raceId = createRes.data.raceId;
      await tapi("POST", "/api/race/join", {
        raceId,
        racerId: ctx.racerIdA,
        wallet: WALLET_A,
      });
      await tapi("POST", "/api/race/start", { raceId });
      const simRes = await tapi("POST", "/api/race/simulate", { raceId });
      assertStatus(simRes, 200);
      assert(simRes.data.weather != null, "weather should exist");
      const validWeathers = ["sunny", "rainy", "windy", "foggy", "stormy"];
      assert(
        validWeathers.includes(simRes.data.weather),
        `Invalid weather: ${simRes.data.weather}`
      );
    })
  );

  return results;
}

// ============================================================
// SECTION 6: MAIN RUNNER
// ============================================================

/** Blocks until the general rate-limit window has drained (max ~70s). */
async function waitForRateLimitReset(label: string): Promise<void> {
  const probe = "/api/racer/coin/0x0000000000000000000000000000000000000000";
  for (let elapsed = 0; elapsed < 70000; elapsed += 2000) {
    const res = await api("GET", probe, undefined, { rateLimited: true });
    if (res.status !== 429) return;
    if (elapsed === 0) console.log(`  Rate limit window exhausted; waiting before ${label}...`);
    await delay(2000);
  }
}

async function main() {
  console.log("\n=== RACER RUSH QA AGENT ===");
  console.log("Target: " + BASE_URL);
  console.log("Wallets: " + WALLET_A + ", " + WALLET_B);
  console.log("Started: " + new Date().toISOString());
  console.log("");

  // 1. Verify server
  try {
    const health = await api("GET", "/health");
    if (health.status !== 200) {
      console.error("Backend not running at " + BASE_URL);
      process.exit(1);
    }
  } catch {
    console.error(
      "Cannot connect to " + BASE_URL + ". Start backend first."
    );
    process.exit(1);
  }

  // 2. Cleanup
  console.log("Cleaning up test data...");
  await cleanup();
  console.log("Cleanup done.\n");

  const ctx: TestContext = { walletA: WALLET_A, walletB: WALLET_B };
  const allResults: TestResult[] = [];

  // 3. Run suites
  console.log("--- HAPPY PATH ---");
  allResults.push(...(await runHappyPath(ctx)));

  await waitForRateLimitReset("EDGE CASES");
  console.log("\n--- EDGE CASES ---");
  allResults.push(...(await runEdgeCases(ctx)));

  await waitForRateLimitReset("SECURITY");
  console.log("\n--- SECURITY ---");
  allResults.push(...(await runSecurity(ctx)));

  await waitForRateLimitReset("ECONOMY AUDIT");
  console.log("\n--- ECONOMY AUDIT ---");
  allResults.push(...(await runEconomyAudit(ctx)));

  await waitForRateLimitReset("RACE LOGIC");
  console.log("\n--- RACE LOGIC ---");
  allResults.push(...(await runRaceLogic(ctx)));

  // Rate limit tests run LAST to avoid polluting other suites
  // Wait for rate limit windows to fully reset (60s window)
  console.log("\n  Waiting 62s for rate limit window to reset...");
  await delay(62000);

  console.log("\n--- RATE LIMITS ---");
  allResults.push(...(await runRateLimits()));

  // 4. Report
  printReport(allResults);

  // 5. Cleanup + exit
  await cleanup();
  await pool.end();

  const failures = allResults.filter((r) => r.passed === false).length;
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
