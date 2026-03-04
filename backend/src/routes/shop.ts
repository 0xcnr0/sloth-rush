import { Router, Request, Response } from "express";
import { query, getOne, runTransaction } from "../db";

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
router.post("/buy-coins", async (req: Request, res: Response) => {
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
  await runTransaction(async (client) => {
    await client.query(
      `INSERT INTO coin_balances (wallet, balance) VALUES ($1, $2)
       ON CONFLICT(wallet) DO UPDATE SET balance = coin_balances.balance + $3, updated_at = NOW()`,
      [wallet, pkg.coins, pkg.coins]
    );

    await client.query(
      "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'shop_purchase', $2, $3)",
      [wallet, pkg.coins, `${pkg.name} package ($${pkg.price} USDC)`]
    );
  });

  const newBalance = await getOne(
    "SELECT balance FROM coin_balances WHERE wallet = $1",
    [wallet]
  );

  res.json({
    purchased: true,
    package: pkg,
    coinsAdded: pkg.coins,
    newBalance: newBalance?.balance || 0,
  });
});

export default router;
