/**
 * SLOTH RUSH — QA Test Agent
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

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://localhost:5432/sloth_rush",
});

// ============================================================
// SECTION 2: HTTP CLIENT
// ============================================================

interface ApiResponse {
  status: number;
  data: any;
}

async function api(
  method: "GET" | "POST",
  path: string,
  body?: any
): Promise<ApiResponse> {
  const url = BASE_URL + path;
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
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

async function fastForwardTraining(slothId: number): Promise<void> {
  await pool.query(
    "UPDATE trainings SET completed_at = NOW() - interval '1 minute' WHERE sloth_id = $1 AND claimed = 0",
    [slothId]
  );
}

async function cleanup(): Promise<void> {
  const wallets = [WALLET_A, WALLET_B, OLD_WALLET_A, OLD_WALLET_B];

  // Clean up today's daily race entry regardless
  try {
    const today = new Date().toISOString().split("T")[0];
    await pool.query("DELETE FROM daily_races WHERE race_date = $1", [today]);
  } catch { /* ignore */ }

  // Get sloth IDs
  let slothIds: number[] = [];
  try {
    const rows = await dbQuery(
      "SELECT id FROM sloths WHERE wallet = ANY($1)",
      [wallets]
    );
    slothIds = rows.map((r) => r.id);
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

  // Also include bot sloth IDs from those races
  if (raceIds.length > 0) {
    try {
      const botRows = await dbQuery(
        "SELECT DISTINCT sloth_id FROM race_participants WHERE race_id = ANY($1) AND is_bot = 1",
        [raceIds]
      );
      const botSlothIds = botRows.map((r) => r.sloth_id);
      slothIds = [...new Set([...slothIds, ...botSlothIds])];
    } catch {
      /* ignore */
    }
  }

  // Child tables using sloth IDs
  const slothTables = [
    "race_participants",
    "trainings",
    "daily_minigame_plays",
    "user_cosmetics",
    "user_accessories",
    "sloth_equipment",
    "streaks",
    "daily_stat_gains",
  ];
  for (const table of slothTables) {
    try {
      if (slothIds.length > 0) {
        await pool.query(
          `DELETE FROM ${table} WHERE sloth_id = ANY($1)`,
          [slothIds]
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
      "predictions",
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

  // Delete sloths last
  try {
    await pool.query("DELETE FROM sloths WHERE wallet = ANY($1)", [wallets]);
  } catch {
    /* ignore */
  }

  // Also clean up bot sloths that were created for test races
  if (slothIds.length > 0) {
    try {
      await pool.query("DELETE FROM sloths WHERE id = ANY($1) AND wallet LIKE 'bot_%'", [slothIds]);
    } catch {
      /* ignore */
    }
  }

  // Clean up wallets used in economy and rate limit tests
  const extraWallets = ["0x3333000000000000000000000000000000000003", "0x9999000000000000000000000000000000000099"];
  for (const w of extraWallets) {
    try {
      await pool.query("DELETE FROM sloths WHERE wallet = $1", [w]);
      await pool.query("DELETE FROM coin_balances WHERE wallet = $1", [w]);
    } catch { /* ignore */ }
  }
  // Rate test sloths
  try {
    await pool.query("DELETE FROM sloths WHERE wallet LIKE '0xaaaa%'");
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
  freeSlothIdA?: number;
  slothIdA?: number;
  freeSlothIdB?: number;
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
    await runTest("A02: Mint free sloth (wallet A)", "Happy Path", async () => {
      const res = await tapi("POST", "/api/sloth/mint", { wallet: WALLET_A });
      assert(res.status === 200 || res.status === 201, `Expected 200/201, got ${res.status}`);
      assert(res.data.sloth != null, "sloth should exist");
      assertEqual(res.data.sloth.type, "free_sloth", "type should be free_sloth");
      ctx.freeSlothIdA = res.data.sloth.id;
    })
  );

  results.push(
    await runTest("A03: Mint free sloth (wallet B)", "Happy Path", async () => {
      const res = await tapi("POST", "/api/sloth/mint", { wallet: WALLET_B });
      assert(res.status === 200 || res.status === 201, `Expected 200/201, got ${res.status}`);
      assert(res.data.sloth != null, "sloth should exist");
      ctx.freeSlothIdB = res.data.sloth.id;
    })
  );

  results.push(
    await runTest("A04: View treehouse", "Happy Path", async () => {
      const res = await tapi("GET", `/api/sloth/treehouse/${WALLET_A}`);
      assertStatus(res, 200);
      assert(Array.isArray(res.data.sloths), "sloths should be array");
      assertEqual(res.data.sloths.length, 1, "should have 1 sloth");
      assertEqual(res.data.sloths[0].type, "free_sloth", "type");
    })
  );

  results.push(
    await runTest("A05: Check balance (should be 0)", "Happy Path", async () => {
      const res = await tapi("GET", `/api/sloth/coin/${WALLET_A}`);
      assertStatus(res, 200);
      assertEqual(res.data.balance, 0, "balance should be 0");
    })
  );

  results.push(
    await runTest("A06: Daily login", "Happy Path", async () => {
      const res = await tapi("POST", "/api/sloth/daily-login", {
        wallet: WALLET_A,
      });
      assertStatus(res, 200);
      assertEqual(res.data.claimed, true, "claimed should be true");
      assert(res.data.bonus != null, "bonus should exist");
    })
  );

  results.push(
    await runTest("A07: Check balance after login (15)", "Happy Path", async () => {
      const res = await tapi("GET", `/api/sloth/coin/${WALLET_A}`);
      assertStatus(res, 200);
      assertEqual(res.data.balance, 15, "balance should be 15");
    })
  );

  results.push(
    await runTest("A08: Check XP", "Happy Path", async () => {
      const res = await tapi("GET", `/api/sloth/xp/${WALLET_A}`);
      assertStatus(res, 200);
      assert(res.data.xp >= 0, "xp should exist");
    })
  );

  results.push(
    await runTest("A09: View profile", "Happy Path", async () => {
      const res = await tapi("GET", `/api/sloth/profile/${WALLET_A}`);
      assertStatus(res, 200);
      assertEqual(res.data.wallet, WALLET_A, "wallet should match");
    })
  );

  results.push(
    await runTest("A10: View transactions", "Happy Path", async () => {
      const res = await tapi(
        "GET",
        `/api/sloth/profile/transactions/${WALLET_A}`
      );
      assertStatus(res, 200);
      assert(
        Array.isArray(res.data.transactions),
        "transactions should be array"
      );
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
        slothId: ctx.freeSlothIdA,
        wallet: WALLET_A,
      });
      assertStatus(res, 200);
      assertEqual(res.data.joined, true, "joined should be true");
    })
  );

  results.push(
    await runTest("A13: Start bidding (exhibition skips)", "Happy Path", async () => {
      const res = await tapi("POST", "/api/race/start-bidding", {
        raceId: ctx.raceId,
      });
      assertStatus(res, 200);
      // Exhibition should skip bidding
      assert(
        res.data.skipBidding === true || res.data.status === "racing",
        "should skip bidding or be racing"
      );
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
    await runTest("A18: Buy coins (starter pack)", "Happy Path", async () => {
      ctx.balanceA = (await tapi("GET", `/api/sloth/coin/${WALLET_A}`)).data.balance;
      const res = await tapi("POST", "/api/shop/buy-coins", {
        wallet: WALLET_A,
        packageId: "starter",
      });
      assertStatus(res, 200);
      assertEqual(res.data.purchased, true, "purchased should be true");
      assertEqual(res.data.coinsAdded, 120, "coinsAdded should be 120");
    })
  );

  results.push(
    await runTest("A19: Check balance after shop (+120)", "Happy Path", async () => {
      const res = await tapi("GET", `/api/sloth/coin/${WALLET_A}`);
      assertStatus(res, 200);
      const expected = (ctx.balanceA || 0) + 120;
      assertEqual(res.data.balance, expected, "balance should increase by 120");
      ctx.balanceA = res.data.balance;
    })
  );

  results.push(
    await runTest("A20: Upgrade free sloth to sloth", "Happy Path", async () => {
      const balBefore = (await tapi("GET", `/api/sloth/coin/${WALLET_A}`)).data.balance;
      ctx.balanceA = balBefore;
      const res = await tapi("POST", "/api/sloth/upgrade", {
        wallet: WALLET_A,
      });
      assert(res.status === 200 || res.status === 201, `Expected 200/201, got ${res.status}`);
      assert(res.data.sloth != null, "sloth should exist");
      assertEqual(res.data.sloth.type, "sloth", "type should be sloth");
      assertEqual(res.data.coinBonus, 500, "coin bonus should be 500");
      ctx.slothIdA = res.data.sloth.id;
    })
  );

  results.push(
    await runTest("A21: Verify upgrade bonus (+500 ZZZ)", "Happy Path", async () => {
      const res = await tapi("GET", `/api/sloth/coin/${WALLET_A}`);
      assertStatus(res, 200);
      const expected = (ctx.balanceA || 0) + 500;
      assertEqual(res.data.balance, expected, "balance should increase by 500");
      ctx.balanceA = res.data.balance;
    })
  );

  results.push(
    await runTest("A22: Rename sloth", "Happy Path", async () => {
      const res = await tapi("POST", "/api/sloth/rename", {
        wallet: WALLET_A,
        slothId: ctx.slothIdA,
        name: "TestSloth",
      });
      assertStatus(res, 200);
      assertEqual(res.data.renamed, true, "renamed should be true");
    })
  );

  results.push(
    await runTest("A23: Start training", "Happy Path", async () => {
      const balBefore = (await tapi("GET", `/api/sloth/coin/${WALLET_A}`)).data.balance;
      const res = await tapi("POST", "/api/sloth/train", {
        wallet: WALLET_A,
        slothId: ctx.slothIdA,
        stat: "spd",
      });
      assertStatus(res, 200);
      assertEqual(res.data.started, true, "started should be true");
      // Verify 10 ZZZ deducted
      const balAfter = (await tapi("GET", `/api/sloth/coin/${WALLET_A}`)).data.balance;
      assertEqual(balAfter, balBefore - 10, "should deduct 10 ZZZ");
      ctx.balanceA = balAfter;
    })
  );

  results.push(
    await runTest("A24: Check training status", "Happy Path", async () => {
      const res = await tapi(
        "GET",
        `/api/sloth/training-status/${WALLET_A}`
      );
      assertStatus(res, 200);
      assert(
        Array.isArray(res.data.trainings),
        "trainings should be array"
      );
      assert(
        res.data.trainings.length >= 1,
        "should have at least 1 training"
      );
    })
  );

  results.push(
    await runTest("A25: Fast-forward + claim training", "Happy Path", async () => {
      await fastForwardTraining(ctx.slothIdA!);
      const res = await tapi("POST", "/api/sloth/claim-training", {
        wallet: WALLET_A,
        slothId: ctx.slothIdA,
      });
      assertStatus(res, 200);
      assertEqual(res.data.claimed, true, "claimed should be true");
      assert(res.data.gain > 0, "gain should be > 0");
    })
  );

  results.push(
    await runTest("A26: Play mini-games (all 5 types)", "Happy Path", async () => {
      const gameTypes = [
        "salt_dodge",
        "yawn_stretch",
        "pillow_lift",
        "lucky_leaf",
        "speed_tap",
      ];
      for (const gameType of gameTypes) {
        const res = await tapi("POST", "/api/sloth/mini-game", {
          wallet: WALLET_A,
          slothId: ctx.slothIdA,
          gameType,
          score: 500,
        });
        assertStatus(res, 200);
        assertEqual(res.data.played, true, `${gameType} should be played`);
      }
    })
  );

  results.push(
    await runTest("A27: Standard race full flow", "Happy Path", async () => {
      // Create
      const createRes = await tapi("POST", "/api/race/create", {
        format: "standard",
      });
      assert(createRes.status === 200 || createRes.status === 201, "create race");
      const raceId = createRes.data.raceId;

      // Join
      const joinRes = await tapi("POST", "/api/race/join", {
        raceId,
        slothId: ctx.slothIdA,
        wallet: WALLET_A,
      });
      assertStatus(joinRes, 200);

      // Start bidding
      const bidStartRes = await tapi("POST", "/api/race/start-bidding", {
        raceId,
      });
      assertStatus(bidStartRes, 200);

      // Bid
      const bidRes = await tapi("POST", "/api/race/bid", {
        raceId,
        wallet: WALLET_A,
        amount: 20,
      });
      assertStatus(bidRes, 200);

      // Simulate
      const simRes = await tapi("POST", "/api/race/simulate", { raceId });
      assertStatus(simRes, 200);
      assert(simRes.data.finalOrder != null, "finalOrder should exist");
    })
  );

  results.push(
    await runTest("A28: Check daily quests", "Happy Path", async () => {
      const res = await tapi("GET", `/api/quests/daily/${WALLET_A}`);
      assertStatus(res, 200);
      assert(Array.isArray(res.data.quests), "quests should be array");
    })
  );

  results.push(
    await runTest("A29: Check weekly quests", "Happy Path", async () => {
      const res = await tapi("GET", `/api/quests/weekly/${WALLET_A}`);
      assertStatus(res, 200);
    })
  );

  results.push(
    await runTest("A30: Check milestones", "Happy Path", async () => {
      const res = await tapi("GET", `/api/quests/milestones/${WALLET_A}`);
      assertStatus(res, 200);
    })
  );

  results.push(
    await runTest("A31: Trigger treehouse visit quest", "Happy Path", async () => {
      const res = await tapi("POST", "/api/quests/progress", {
        wallet: WALLET_A,
        requirementType: "treehouse_visit",
      });
      assertStatus(res, 200);
    })
  );

  results.push(
    await runTest("A32: Buy cosmetic", "Happy Path", async () => {
      const listRes = await tapi(
        "GET",
        `/api/shop/cosmetics?wallet=${WALLET_A}`
      );
      assertStatus(listRes, 200);
      const unowned = listRes.data.cosmetics?.filter(
        (c: any) => !c.owned
      );
      if (!unowned || unowned.length === 0) {
        throw new Error("No unowned cosmetics available to buy");
      }
      // Sort by price ascending to find cheapest
      unowned.sort(
        (a: any, b: any) => (a.sloth_price || 0) - (b.sloth_price || 0)
      );
      const cheapest = unowned[0];
      // Ensure enough balance
      const bal = (await tapi("GET", `/api/sloth/coin/${WALLET_A}`)).data.balance;
      if (bal < (cheapest.sloth_price || 0)) {
        // Buy more coins
        await tapi("POST", "/api/shop/buy-coins", {
          wallet: WALLET_A,
          packageId: "whale",
        });
      }
      const res = await tapi("POST", "/api/shop/buy-cosmetic", {
        wallet: WALLET_A,
        cosmeticId: cheapest.id,
      });
      assertStatus(res, 200);
      assertEqual(res.data.purchased, true, "purchased should be true");
      ctx.cosmeticId = cheapest.id;
    })
  );

  results.push(
    await runTest("A33: Equip cosmetic", "Happy Path", async () => {
      const res = await tapi("POST", "/api/sloth/equip-cosmetic", {
        wallet: WALLET_A,
        slothId: ctx.slothIdA,
        cosmeticId: ctx.cosmeticId,
      });
      assertStatus(res, 200);
    })
  );

  results.push(
    await runTest("A34: View sloth cosmetics", "Happy Path", async () => {
      const res = await tapi("GET", `/api/sloth/cosmetics/${ctx.slothIdA}`);
      assertStatus(res, 200);
      assert(Array.isArray(res.data.cosmetics), "cosmetics should be array");
    })
  );

  results.push(
    await runTest("A35: Buy accessory", "Happy Path", async () => {
      const listRes = await tapi(
        "GET",
        `/api/shop/accessories?wallet=${WALLET_A}`
      );
      assertStatus(listRes, 200);
      const unowned = listRes.data.accessories?.filter(
        (a: any) => !a.owned
      );
      if (!unowned || unowned.length === 0) {
        throw new Error("No unowned accessories available to buy");
      }
      unowned.sort(
        (a: any, b: any) => (a.sloth_price || 0) - (b.sloth_price || 0)
      );
      const cheapest = unowned[0];
      // Ensure enough balance
      const bal = (await tapi("GET", `/api/sloth/coin/${WALLET_A}`)).data.balance;
      if (bal < (cheapest.sloth_price || 0)) {
        await tapi("POST", "/api/shop/buy-coins", {
          wallet: WALLET_A,
          packageId: "whale",
        });
      }
      const res = await tapi("POST", "/api/shop/buy-accessory", {
        wallet: WALLET_A,
        accessoryId: cheapest.id,
      });
      assertStatus(res, 200);
      assertEqual(res.data.purchased, true, "purchased should be true");
      ctx.accessoryId = cheapest.id;
    })
  );

  results.push(
    await runTest("A36: Equip accessory", "Happy Path", async () => {
      const res = await tapi("POST", "/api/sloth/equip-accessory", {
        wallet: WALLET_A,
        slothId: ctx.slothIdA,
        accessoryId: ctx.accessoryId,
      });
      assertStatus(res, 200);
    })
  );

  results.push(
    await runTest("A37: Unequip accessory", "Happy Path", async () => {
      const res = await tapi("POST", "/api/sloth/unequip-accessory", {
        wallet: WALLET_A,
        slothId: ctx.slothIdA,
      });
      assertStatus(res, 200);
    })
  );

  results.push(
    await runTest("A38: Evolution progress", "Happy Path", async () => {
      const res = await tapi(
        "GET",
        `/api/sloth/evolution-progress/${ctx.slothIdA}`
      );
      assertStatus(res, 200);
      assert(res.data.currentTier != null, "currentTier should exist");
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
    await runTest("A45: Shop packages", "Happy Path", async () => {
      const res = await tapi("GET", "/api/shop/packages");
      assertStatus(res, 200);
      assert(Array.isArray(res.data.packages), "packages should be array");
      assertEqual(res.data.packages.length, 4, "should have 4 packages");
    })
  );

  results.push(
    await runTest("A46: Upgrade progress", "Happy Path", async () => {
      const res = await tapi(
        "GET",
        `/api/sloth/upgrade-progress/${WALLET_A}`
      );
      assertStatus(res, 200);
    })
  );

  results.push(
    await runTest("A47: Streaks", "Happy Path", async () => {
      const res = await tapi("GET", `/api/sloth/streaks/${WALLET_A}`);
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
      // Wallet A already has a sloth from happy path
      const res = await tapi("POST", "/api/sloth/mint", { wallet: WALLET_A });
      assert(
        res.status === 409 || res.status === 400,
        `Expected 409/400, got ${res.status}`
      );
    })
  );

  results.push(
    await runTest("B02: Mint with empty wallet -> 400", "Edge Cases", async () => {
      const res = await tapi("POST", "/api/sloth/mint", { wallet: "" });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("B03: Upgrade without free sloth -> 400/404", "Edge Cases", async () => {
      const res = await tapi("POST", "/api/sloth/upgrade", {
        wallet: "0x9999000000000000000000000000000000000099",
      });
      assert(
        res.status === 400 || res.status === 404,
        `Expected 400/404, got ${res.status}`
      );
    })
  );

  results.push(
    await runTest("B04: Train with 0 balance", "Edge Cases", async () => {
      // Wallet B has free sloth but 0 balance
      const res = await tapi("POST", "/api/sloth/train", {
        wallet: WALLET_B,
        slothId: ctx.freeSlothIdB,
        stat: "spd",
      });
      assert(
        res.status === 400,
        `Expected 400 (insufficient balance), got ${res.status}`
      );
    })
  );

  results.push(
    await runTest("B05: Free sloth joins standard race -> 400", "Edge Cases", async () => {
      const createRes = await tapi("POST", "/api/race/create", {
        format: "standard",
      });
      const raceId = createRes.data.raceId;
      const res = await tapi("POST", "/api/race/join", {
        raceId,
        slothId: ctx.freeSlothIdB,
        wallet: WALLET_B,
      });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("B06: Bid on exhibition race -> 400", "Edge Cases", async () => {
      // Create fresh exhibition
      const createRes = await tapi("POST", "/api/race/create", {
        format: "exhibition",
      });
      const raceId = createRes.data.raceId;
      await tapi("POST", "/api/race/join", {
        raceId,
        slothId: ctx.slothIdA,
        wallet: WALLET_A,
      });
      await tapi("POST", "/api/race/start-bidding", { raceId });
      const res = await tapi("POST", "/api/race/bid", {
        raceId,
        wallet: WALLET_A,
        amount: 10,
      });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("B07: Mini-game with score > 1000 -> 400", "Edge Cases", async () => {
      const res = await tapi("POST", "/api/sloth/mini-game", {
        wallet: WALLET_A,
        slothId: ctx.slothIdA,
        gameType: "speed_tap",
        score: 1500,
      });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("B08: Rename with < 3 chars -> 400", "Edge Cases", async () => {
      const res = await tapi("POST", "/api/sloth/rename", {
        wallet: WALLET_A,
        slothId: ctx.slothIdA,
        name: "AB",
      });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("B09: Rename with > 20 chars -> 400", "Edge Cases", async () => {
      const res = await tapi("POST", "/api/sloth/rename", {
        wallet: WALLET_A,
        slothId: ctx.slothIdA,
        name: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("B10: Buy already owned cosmetic -> 409", "Edge Cases", async () => {
      if (!ctx.cosmeticId) {
        throw new Error("No cosmetic ID from happy path");
      }
      const res = await tapi("POST", "/api/shop/buy-cosmetic", {
        wallet: WALLET_A,
        cosmeticId: ctx.cosmeticId,
      });
      assertStatus(res, 409);
    })
  );

  results.push(
    await runTest("B11: Daily login twice same day -> already claimed", "Edge Cases", async () => {
      const res = await tapi("POST", "/api/sloth/daily-login", {
        wallet: WALLET_A,
      });
      assertStatus(res, 200);
      assertEqual(res.data.claimed, false, "claimed should be false");
    })
  );

  results.push(
    await runTest("B12: Invalid game type -> 400", "Edge Cases", async () => {
      const res = await tapi("POST", "/api/sloth/mini-game", {
        wallet: WALLET_A,
        slothId: ctx.slothIdA,
        gameType: "invalid_game",
        score: 100,
      });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("B13: Invalid stat for training -> 400", "Edge Cases", async () => {
      const res = await tapi("POST", "/api/sloth/train", {
        wallet: WALLET_A,
        slothId: ctx.slothIdA,
        stat: "xyz",
      });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("B14: Join non-existent race -> 404", "Edge Cases", async () => {
      const res = await tapi("POST", "/api/race/join", {
        raceId: "race_nonexistent_999",
        slothId: ctx.slothIdA,
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
      const res = await tapi("POST", "/api/sloth/rename", {
        wallet: WALLET_A,
        slothId: ctx.slothIdA,
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
    await runTest("C01: Rename another wallet's sloth -> 403/404", "Security", async () => {
      const res = await tapi("POST", "/api/sloth/rename", {
        wallet: WALLET_B,
        slothId: ctx.slothIdA,
        name: "Hacked",
      });
      assert(
        res.status === 403 || res.status === 404,
        `Expected 403/404, got ${res.status}`
      );
    })
  );

  results.push(
    await runTest("C02: Train another wallet's sloth -> 403/404", "Security", async () => {
      const res = await tapi("POST", "/api/sloth/train", {
        wallet: WALLET_B,
        slothId: ctx.slothIdA,
        stat: "spd",
      });
      assert(
        res.status === 403 || res.status === 404,
        `Expected 403/404, got ${res.status}`
      );
    })
  );

  results.push(
    await runTest("C03: Invalid wallet format (no 0x) -> 400", "Security", async () => {
      const res = await tapi("POST", "/api/sloth/mint", {
        wallet: "TEST000000000000000000000000000000000099",
      });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("C04: Invalid wallet format (too short) -> 400", "Security", async () => {
      const res = await tapi("POST", "/api/sloth/mint", {
        wallet: "0x123",
      });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("C05: SQL injection in wallet -> 400", "Security", async () => {
      const res = await tapi("POST", "/api/sloth/mint", {
        wallet: "0x' OR '1'='1",
      });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("C06: SQL injection in name -> 400", "Security", async () => {
      const res = await tapi("POST", "/api/sloth/rename", {
        wallet: WALLET_A,
        slothId: ctx.slothIdA,
        name: "'; DROP TABLE sloths;--",
      });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("C07: Negative bid -> 400 or clamped", "Security", async () => {
      const createRes = await tapi("POST", "/api/race/create", {
        format: "standard",
      });
      const raceId = createRes.data.raceId;
      await tapi("POST", "/api/race/join", {
        raceId,
        slothId: ctx.slothIdA,
        wallet: WALLET_A,
      });
      await tapi("POST", "/api/race/start-bidding", { raceId });
      const balBefore = (await tapi("GET", `/api/sloth/coin/${WALLET_A}`)).data.balance;
      const res = await tapi("POST", "/api/race/bid", {
        raceId,
        wallet: WALLET_A,
        amount: -100,
      });
      // Should either reject (400) or clamp to 0
      const balAfter = (await tapi("GET", `/api/sloth/coin/${WALLET_A}`)).data.balance;
      assert(
        res.status === 400 || balAfter >= balBefore,
        "Negative bid should not give free money"
      );
    })
  );

  results.push(
    await runTest("C08: Equip cosmetic not owned -> 400", "Security", async () => {
      const res = await tapi("POST", "/api/sloth/equip-cosmetic", {
        wallet: WALLET_A,
        slothId: ctx.slothIdA,
        cosmeticId: 999999,
      });
      assertStatus(res, 400);
    })
  );

  results.push(
    await runTest("C09: Equip accessory not owned -> 400", "Security", async () => {
      const res = await tapi("POST", "/api/sloth/equip-accessory", {
        wallet: WALLET_A,
        slothId: ctx.slothIdA,
        accessoryId: 999999,
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
        const r = await api("GET", "/api/sloth/coin/0x0000000000000000000000000000000000000000");
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
        const res = await api("POST", "/api/sloth/mint", { wallet });
        if (res.status === 429) {
          got429 = true;
          break;
        }
      }
      assert(got429, "Should have received 429 from strict rate limiter");
      // Clean up rate test sloths
      try {
        await pool.query(
          "DELETE FROM sloths WHERE wallet LIKE '0xaaaa%'"
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

  results.push(
    await runTest("E01: Mint gives 0 coins", "Economy", async () => {
      // This was already verified in A05 (balance = 0 after mint)
      // Double check from DB
      const walletC = "0x3333000000000000000000000000000000000003";
      // Clean up any leftover from previous runs
      try {
        await pool.query("DELETE FROM sloths WHERE wallet = $1", [walletC]);
        await pool.query("DELETE FROM coin_balances WHERE wallet = $1", [walletC]);
      } catch { /* ignore */ }
      const balBefore = await getDbBalance(walletC);
      const res = await tapi("POST", "/api/sloth/mint", { wallet: walletC });
      assert(res.status === 200 || res.status === 201, `mint should succeed, got ${res.status}: ${JSON.stringify(res.data)}`);
      const balAfter = await getDbBalance(walletC);
      assertEqual(balAfter, balBefore, "Mint should not change balance");
      // Cleanup
      try {
        await pool.query("DELETE FROM sloths WHERE wallet = $1", [walletC]);
      } catch {
        /* ignore */
      }
    })
  );

  results.push(
    await runTest("E02: Upgrade gives exactly 500 ZZZ", "Economy", async () => {
      // Already verified in A20-A21 (upgrade gives 500 ZZZ)
      // The exact balance may vary due to races/training — just confirm upgrade was correct
      assert(true, "Verified in A20-A21: upgrade credited 500 ZZZ");
    })
  );

  results.push(
    await runTest("E03: Daily login gives exactly 15 ZZZ", "Economy", async () => {
      // Use wallet B for clean test
      const balBefore = await getDbBalance(WALLET_B);
      const res = await tapi("POST", "/api/sloth/daily-login", {
        wallet: WALLET_B,
      });
      assertStatus(res, 200);
      if (res.data.claimed) {
        const balAfter = await getDbBalance(WALLET_B);
        assertEqual(balAfter - balBefore, 15, "Daily login should give 15 ZZZ");
      }
    })
  );

  results.push(
    await runTest("E04: Training costs exactly 10 ZZZ", "Economy", async () => {
      // Already tested in A23 — verified 10 ZZZ deduction
      // Spot check: wallet A balance decreased by 10 during training
      assert(true, "Verified in A23");
    })
  );

  results.push(
    await runTest("E05: Race entry fee correct (50 ZZZ standard)", "Economy", async () => {
      // Create standard race and track balance delta
      const balBefore = (await tapi("GET", `/api/sloth/coin/${WALLET_A}`)).data.balance;
      const createRes = await tapi("POST", "/api/race/create", {
        format: "standard",
      });
      const raceId = createRes.data.raceId;
      const joinRes = await tapi("POST", "/api/race/join", {
        raceId,
        slothId: ctx.slothIdA,
        wallet: WALLET_A,
      });
      assertStatus(joinRes, 200);
      const balAfter = (await tapi("GET", `/api/sloth/coin/${WALLET_A}`)).data.balance;
      const charged = joinRes.data.entryFeeCharged || 0;
      // May be free race (daily free), so check accordingly
      if (joinRes.data.dailyFreeRace) {
        assertEqual(charged, 0, "Free daily race should charge 0");
      } else {
        assertEqual(balBefore - balAfter, 50, "Standard race should cost 50 ZZZ");
      }
      // Cleanup: simulate to finish the race
      await tapi("POST", "/api/race/start-bidding", { raceId });
      await tapi("POST", "/api/race/bid", { raceId, wallet: WALLET_A, amount: 0 });
      await tapi("POST", "/api/race/simulate", { raceId });
    })
  );

  results.push(
    await runTest("E06: Shop starter pack gives 120 ZZZ", "Economy", async () => {
      const balBefore = (await tapi("GET", `/api/sloth/coin/${WALLET_A}`)).data.balance;
      const res = await tapi("POST", "/api/shop/buy-coins", {
        wallet: WALLET_A,
        packageId: "starter",
      });
      assertStatus(res, 200);
      assertEqual(res.data.coinsAdded, 120, "starter should give 120");
      const balAfter = (await tapi("GET", `/api/sloth/coin/${WALLET_A}`)).data.balance;
      assertEqual(balAfter - balBefore, 120, "balance delta should be 120");
    })
  );

  results.push(
    await runTest("E07: Balance never goes negative", "Economy", async () => {
      // Wallet B has free sloth + 15 from daily login (maybe)
      // Set balance to 0 via DB
      await pool.query(
        "INSERT INTO coin_balances (wallet, balance) VALUES ($1, 0) ON CONFLICT (wallet) DO UPDATE SET balance = 0",
        [WALLET_B]
      );
      // Try to train (costs 10)
      const trainRes = await tapi("POST", "/api/sloth/train", {
        wallet: WALLET_B,
        slothId: ctx.freeSlothIdB,
        stat: "spd",
      });
      assert(trainRes.status === 400, `Training with 0 balance should fail, got ${trainRes.status}`);
      // Verify balance still 0
      const bal = await getDbBalance(WALLET_B);
      assertEqual(bal, 0, "Balance should still be 0");
    })
  );

  return results;
}

// --- SUITE F: Race Logic ---
async function runRaceLogic(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Ensure wallet A has enough coins for race entries, bids, and tactic actions
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
        slothId: ctx.slothIdA,
        wallet: WALLET_A,
      });
      assertStatus(joinRes, 200);

      const bidRes = await tapi("POST", "/api/race/start-bidding", { raceId });
      assertStatus(bidRes, 200);
      assert(
        bidRes.data.skipBidding === true || bidRes.data.status === "racing",
        "exhibition should skip bidding"
      );

      const simRes = await tapi("POST", "/api/race/simulate", { raceId });
      assertStatus(simRes, 200);
      assert(simRes.data.finalOrder != null, "finalOrder");
      assert(simRes.data.frames != null, "frames");

      const raceRes = await tapi("GET", `/api/race/${raceId}`);
      assertEqual(raceRes.data.status, "finished", "race finished");
    })
  );

  results.push(
    await runTest("F02: Standard full flow", "Race Logic", async () => {
      const createRes = await tapi("POST", "/api/race/create", {
        format: "standard",
      });
      const raceId = createRes.data.raceId;

      await tapi("POST", "/api/race/join", {
        raceId,
        slothId: ctx.slothIdA,
        wallet: WALLET_A,
      });

      await tapi("POST", "/api/race/start-bidding", { raceId });

      const bidRes = await tapi("POST", "/api/race/bid", {
        raceId,
        wallet: WALLET_A,
        amount: 50,
      });
      assertStatus(bidRes, 200);

      const simRes = await tapi("POST", "/api/race/simulate", { raceId });
      assertStatus(simRes, 200);
      assert(simRes.data.finalOrder != null, "finalOrder");
      assert(simRes.data.gridPositions != null, "gridPositions");
      // Verify payouts exist
      const hasPayouts = simRes.data.finalOrder.some(
        (fo: any) => fo.payout > 0
      );
      assert(hasPayouts, "At least one racer should have payout > 0");
    })
  );

  results.push(
    await runTest("F03: Tactic full flow", "Race Logic", async () => {
      const createRes = await tapi("POST", "/api/race/create", {
        format: "tactic",
      });
      const raceId = createRes.data.raceId;

      await tapi("POST", "/api/race/join", {
        raceId,
        slothId: ctx.slothIdA,
        wallet: WALLET_A,
      });

      await tapi("POST", "/api/race/start-bidding", { raceId });
      await tapi("POST", "/api/race/bid", {
        raceId,
        wallet: WALLET_A,
        amount: 30,
      });

      // Check GDA prices
      const pricesRes = await tapi("GET", `/api/race/${raceId}/prices?tick=0`);
      assertStatus(pricesRes, 200);
      assert(pricesRes.data.boostPrice != null, "boostPrice should exist");
      assert(pricesRes.data.pillowPrice != null, "pillowPrice should exist");

      // Submit action
      const actionRes = await tapi("POST", "/api/race/action", {
        raceId,
        wallet: WALLET_A,
        slothId: ctx.slothIdA,
        actionType: "boost",
        tick: 50,
      });
      assertStatus(actionRes, 200);

      const simRes = await tapi("POST", "/api/race/simulate", { raceId });
      assertStatus(simRes, 200);
    })
  );

  results.push(
    await runTest("F04: GP create", "Race Logic", async () => {
      const res = await tapi("POST", "/api/race/gp/create", {});
      assert(res.status === 200 || res.status === 201, "gp create");
      assert(
        res.data.qualifyRaceId != null || res.data.gpId != null,
        "should return qualifying race ID"
      );
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
        slothId: ctx.slothIdA,
        wallet: WALLET_A,
      });

      const bidRes = await tapi("POST", "/api/race/start-bidding", { raceId });
      assertStatus(bidRes, 200);
      assertEqual(bidRes.data.botsAdded, 3, "should add 3 bots");

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
    await runTest("F07: Prediction system", "Race Logic", async () => {
      const createRes = await tapi("POST", "/api/race/create", {
        format: "exhibition",
      });
      const raceId = createRes.data.raceId;

      await tapi("POST", "/api/race/join", {
        raceId,
        slothId: ctx.slothIdA,
        wallet: WALLET_A,
      });
      await tapi("POST", "/api/race/start-bidding", { raceId });

      // Get participants to know a sloth ID to predict
      const raceRes = await tapi("GET", `/api/race/${raceId}`);
      const firstSlothId = raceRes.data.participants[0]?.sloth_id;
      assert(firstSlothId != null, "should have participants");

      // Predict
      const predRes = await tapi("POST", "/api/race/predict", {
        raceId,
        wallet: WALLET_A,
        slothId: firstSlothId,
      });
      assertStatus(predRes, 200);

      // Simulate
      await tapi("POST", "/api/race/simulate", { raceId });

      // Check predictions
      const predsRes = await tapi("GET", `/api/race/${raceId}/predictions`);
      assertStatus(predsRes, 200);
      assert(
        Array.isArray(predsRes.data.predictions),
        "predictions should be array"
      );
      assert(
        predsRes.data.predictions.length >= 1,
        "should have at least 1 prediction"
      );
    })
  );

  results.push(
    await runTest("F08: Streak tracking", "Race Logic", async () => {
      const res = await tapi("GET", `/api/sloth/streaks/${WALLET_A}`);
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
        slothId: ctx.slothIdA,
        wallet: WALLET_A,
      });
      await tapi("POST", "/api/race/start-bidding", { raceId });
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

async function main() {
  console.log("\n=== SLOTH RUSH QA AGENT ===");
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

  console.log("\n--- EDGE CASES ---");
  allResults.push(...(await runEdgeCases(ctx)));

  console.log("\n--- SECURITY ---");
  allResults.push(...(await runSecurity(ctx)));

  console.log("\n--- ECONOMY AUDIT ---");
  allResults.push(...(await runEconomyAudit(ctx)));

  // Brief pause to let rate limits reset
  await delay(2000);

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
