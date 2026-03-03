import { Router, Request, Response } from "express";
import db from "../db";

const router = Router();

const COIN_PACKAGES = [
  { id: "starter", name: "Starter", price: 1, coins: 120, bonus: 0 },
  { id: "popular", name: "Popular", price: 5, coins: 650, bonus: 8 },
  { id: "pro", name: "Pro", price: 10, coins: 1400, bonus: 17 },
  { id: "whale", name: "Whale", price: 25, coins: 4000, bonus: 25 },
] as const;

// GET /api/shop/packages — List available packages
router.get("/packages", (_req: Request, res: Response) => {
  res.json({ packages: COIN_PACKAGES });
});

// POST /api/shop/buy-coins — Purchase a coin package (mock USDC)
router.post("/buy-coins", (req: Request, res: Response) => {
  const { wallet, packageId } = req.body;

  if (!wallet || !packageId) {
    res.status(400).json({ error: "wallet and packageId required" });
    return;
  }

  const pkg = COIN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) {
    res.status(404).json({ error: "package not found" });
    return;
  }

  // Mock USDC payment — in production this would verify on-chain USDC transfer
  const buyCoins = db.transaction(() => {
    db.prepare(
      `INSERT INTO coin_balances (wallet, balance) VALUES (?, ?)
       ON CONFLICT(wallet) DO UPDATE SET balance = balance + ?, updated_at = datetime('now')`
    ).run(wallet, pkg.coins, pkg.coins);

    db.prepare(
      "INSERT INTO transactions (wallet, type, amount, description) VALUES (?, 'shop_purchase', ?, ?)"
    ).run(wallet, pkg.coins, `${pkg.name} package ($${pkg.price} USDC)`);
  });

  buyCoins();

  const newBalance = db.prepare(
    "SELECT balance FROM coin_balances WHERE wallet = ?"
  ).get(wallet) as any;

  res.json({
    purchased: true,
    package: pkg,
    coinsAdded: pkg.coins,
    newBalance: newBalance?.balance || 0,
  });
});

export default router;
