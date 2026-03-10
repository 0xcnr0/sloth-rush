import { Router, Request, Response } from "express";
import crypto from "crypto";
import { query, getOne, getAll, runTransaction } from "../db";

const router = Router();

const APP_URL = process.env.APP_URL || "https://app.slothrush.xyz";

// =============================================
// FARCASTER FRAME — Race Result
// =============================================

// GET /api/social/frame/:raceId — Farcaster Frame HTML for race result
router.get("/frame/:raceId", async (req: Request, res: Response) => {
  try {
    const { raceId } = req.params;

    const race = await getOne("SELECT * FROM races WHERE id = $1", [raceId]);
    if (!race) {
      res.status(404).send("Race not found");
      return;
    }

    const replay = await getOne("SELECT metadata FROM race_replays WHERE race_id = $1", [raceId]);
    let finalOrder: any[] = [];
    if (replay?.metadata) {
      const meta = typeof replay.metadata === "string" ? JSON.parse(replay.metadata) : replay.metadata;
      finalOrder = meta.finalOrder || [];
    }

    const winner = finalOrder[0];
    const title = winner ? `${winner.name} wins the race!` : "Sloth Rush Race Result";
    const description = finalOrder.slice(0, 4).map((fo: any, i: number) => `${i + 1}. ${fo.name}`).join(" | ");
    const ogImageUrl = `${APP_URL}/api/social/og/${raceId}`;
    const raceUrl = `${APP_URL}/race/${raceId}`;

    // Farcaster Frame v2 HTML
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${ogImageUrl}" />
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
  <meta property="fc:frame:button:1" content="Race Now" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="${APP_URL}" />
  <meta property="fc:frame:button:2" content="View Result" />
  <meta property="fc:frame:button:2:action" content="link" />
  <meta property="fc:frame:button:2:target" content="${raceUrl}" />
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    console.error("GET /frame/:raceId error:", err);
    res.status(500).send("Error");
  }
});

// =============================================
// OG:IMAGE — Dynamic SVG race result card
// =============================================

// GET /api/social/og/:raceId — Dynamic SVG race result image
router.get("/og/:raceId", async (req: Request, res: Response) => {
  try {
    const { raceId } = req.params;

    const replay = await getOne("SELECT metadata FROM race_replays WHERE race_id = $1", [raceId]);
    let finalOrder: any[] = [];
    let format = "standard";
    if (replay?.metadata) {
      const meta = typeof replay.metadata === "string" ? JSON.parse(replay.metadata) : replay.metadata;
      finalOrder = meta.finalOrder || [];
      format = meta.format || "standard";
    }

    const race = await getOne("SELECT format FROM races WHERE id = $1", [raceId]);
    if (race?.format) format = race.format;

    const winner = finalOrder[0];
    const winnerName = winner?.name || "Unknown";
    const formatLabel = format.charAt(0).toUpperCase() + format.slice(1);

    // Generate SVG
    const standings = finalOrder.slice(0, 4).map((fo: any, i: number) => {
      const y = 200 + i * 50;
      const medal = i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : "4.";
      const color = i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7f32" : "#6b7280";
      const payout = fo.payout > 0 ? `+${fo.payout} ZZZ` : "";
      return `
        <text x="60" y="${y}" fill="${color}" font-size="22" font-weight="bold" font-family="sans-serif">${medal} ${fo.name}</text>
        ${payout ? `<text x="540" y="${y}" fill="#22c55e" font-size="18" font-weight="bold" font-family="sans-serif" text-anchor="end">${payout}</text>` : ""}
      `;
    }).join("");

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="600" height="400" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0e17"/>
      <stop offset="100%" stop-color="#1a2332"/>
    </linearGradient>
  </defs>
  <rect width="600" height="400" fill="url(#bg)" rx="16"/>

  <!-- Header -->
  <text x="300" y="50" fill="#22c55e" font-size="28" font-weight="bold" font-family="sans-serif" text-anchor="middle">SLOTH RUSH</text>
  <text x="300" y="80" fill="#6b7280" font-size="14" font-family="sans-serif" text-anchor="middle">${formatLabel} Race Result</text>

  <!-- Winner highlight -->
  <rect x="30" y="100" width="540" height="60" rx="12" fill="rgba(245,158,11,0.1)" stroke="#f59e0b" stroke-width="1"/>
  <text x="300" y="125" fill="#f59e0b" font-size="16" font-weight="bold" font-family="sans-serif" text-anchor="middle">WINNER</text>
  <text x="300" y="148" fill="#ffffff" font-size="22" font-weight="bold" font-family="sans-serif" text-anchor="middle">${winnerName}</text>

  <!-- Standings -->
  ${standings}

  <!-- Footer -->
  <text x="300" y="385" fill="#4a5568" font-size="12" font-family="sans-serif" text-anchor="middle">app.slothrush.xyz — Race on Base L2</text>
</svg>`;

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(svg);
  } catch (err) {
    console.error("GET /og/:raceId error:", err);
    // Return a fallback SVG
    const fallback = `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="600" height="400" fill="#0a0e17" rx="16"/>
      <text x="300" y="200" fill="#22c55e" font-size="28" font-weight="bold" font-family="sans-serif" text-anchor="middle">SLOTH RUSH</text>
    </svg>`;
    res.setHeader("Content-Type", "image/svg+xml");
    res.send(fallback);
  }
});

// =============================================
// REFERRAL SYSTEM
// =============================================

// POST /api/social/referral/generate — Generate referral code for wallet
router.post("/referral/generate", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.body;
    if (!wallet) { res.status(400).json({ error: "wallet required" }); return; }

    const w = wallet.toLowerCase();

    // Check if already has a code
    const existing = await getOne("SELECT code FROM referral_codes WHERE wallet = $1", [w]);
    if (existing) {
      res.json({ code: existing.code, link: `${APP_URL}/invite/${existing.code}` });
      return;
    }

    // Generate unique 8-char code
    const code = crypto.randomBytes(4).toString("hex");
    await query("INSERT INTO referral_codes (wallet, code) VALUES ($1, $2)", [w, code]);

    res.json({ code, link: `${APP_URL}/invite/${code}` });
  } catch (err) {
    console.error("POST /referral/generate error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/social/referral/code/:wallet — Get referral code for wallet
router.get("/referral/code/:wallet", async (req: Request, res: Response) => {
  try {
    const w = String(req.params.wallet).toLowerCase();
    const existing = await getOne("SELECT code FROM referral_codes WHERE wallet = $1", [w]);
    if (!existing) { res.json({ code: null }); return; }
    res.json({ code: existing.code, link: `${APP_URL}/invite/${existing.code}` });
  } catch (err) {
    console.error("GET /referral/code error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/social/referral/apply — Apply referral code (called after mint)
router.post("/referral/apply", async (req: Request, res: Response) => {
  try {
    const { wallet, code } = req.body;
    if (!wallet || !code) { res.status(400).json({ error: "wallet and code required" }); return; }

    const w = wallet.toLowerCase();

    // Check if already used a referral
    const alreadyReferred = await getOne("SELECT id FROM referrals WHERE referee_wallet = $1", [w]);
    if (alreadyReferred) { res.status(409).json({ error: "Already used a referral code" }); return; }

    // Find referrer
    const referrer = await getOne("SELECT wallet FROM referral_codes WHERE code = $1", [code]);
    if (!referrer) { res.status(404).json({ error: "Invalid referral code" }); return; }

    // Can't refer yourself
    if (referrer.wallet === w) { res.status(400).json({ error: "Cannot use your own code" }); return; }

    await runTransaction(async (client) => {
      // Record referral
      await client.query(
        "INSERT INTO referrals (referrer_wallet, referee_wallet, code) VALUES ($1, $2, $3)",
        [referrer.wallet, w, code]
      );

      // Reward referrer: 25 ZZZ
      await client.query(
        `INSERT INTO coin_balances (wallet, balance) VALUES ($1, 25)
         ON CONFLICT(wallet) DO UPDATE SET balance = coin_balances.balance + 25, updated_at = NOW()`,
        [referrer.wallet]
      );
      await client.query(
        "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'referral_bonus', 25, $2)",
        [referrer.wallet, `Referral bonus: ${w.slice(0, 8)}...`]
      );

      // Mark rewarded
      await client.query(
        "UPDATE referrals SET rewarded = 1 WHERE referee_wallet = $1",
        [w]
      );
    });

    res.json({ applied: true, referrerRewarded: true });
  } catch (err) {
    console.error("POST /referral/apply error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/social/referral/stats/:wallet — Referral stats
router.get("/referral/stats/:wallet", async (req: Request, res: Response) => {
  try {
    const w = String(req.params.wallet).toLowerCase();
    const stats = await getOne(
      "SELECT COUNT(*)::int as total, COALESCE(SUM(CASE WHEN rewarded = 1 THEN 1 ELSE 0 END), 0)::int as rewarded FROM referrals WHERE referrer_wallet = $1",
      [w]
    );
    const code = await getOne("SELECT code FROM referral_codes WHERE wallet = $1", [w]);
    res.json({
      totalReferrals: stats?.total || 0,
      totalRewarded: stats?.rewarded || 0,
      totalEarned: (stats?.rewarded || 0) * 25,
      code: code?.code || null,
    });
  } catch (err) {
    console.error("GET /referral/stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
