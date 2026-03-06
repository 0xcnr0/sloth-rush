import { Router, Request, Response } from "express";
import { query, getOne, getAll, runTransaction } from "../db";
import { isValidWallet } from "../middleware/validateWallet";

const router = Router();

const COIN_PACKAGES = [
  { id: "starter", name: "Starter", price: 1, coins: 120, bonus: 0 },
  { id: "popular", name: "Popular", price: 5, coins: 650, bonus: 8 },
  { id: "pro", name: "Pro", price: 10, coins: 1400, bonus: 17 },
  { id: "whale", name: "Whale", price: 25, coins: 4000, bonus: 25 },
] as const;

// GET /api/shop/packages — List available packages
router.get("/packages", (_req: Request, res: Response) => {
  try {
    res.json({ packages: COIN_PACKAGES });
  } catch (err) {
    console.error("GET /packages error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/shop/buy-coins — Purchase a coin package (mock USDC)
router.post("/buy-coins", async (req: Request, res: Response) => {
  try {
    const { wallet, packageId } = req.body;

    if (!wallet || !packageId) {
      res.status(400).json({ error: "wallet and packageId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
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
  } catch (err) {
    console.error("POST /buy-coins error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/shop/cosmetics — List all cosmetics
router.get("/cosmetics", async (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet as string | undefined;

    if (wallet && !isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const cosmetics = await getAll("SELECT * FROM cosmetics ORDER BY id");

    let owned: number[] = [];
    if (wallet) {
      const ownedRows = await getAll("SELECT cosmetic_id FROM user_cosmetics WHERE wallet = $1", [wallet]);
      owned = ownedRows.map((r: any) => r.cosmetic_id);
    }

    res.json({
      cosmetics: cosmetics.map((c: any) => ({ ...c, owned: owned.includes(c.id) })),
    });
  } catch (err) {
    console.error("GET /cosmetics error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/shop/buy-cosmetic — Purchase a cosmetic
router.post("/buy-cosmetic", async (req: Request, res: Response) => {
  try {
    const { wallet, cosmeticId } = req.body;
    if (!wallet || !cosmeticId) {
      res.status(400).json({ error: "wallet and cosmeticId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const cosmetic = await getOne("SELECT * FROM cosmetics WHERE id = $1", [cosmeticId]);
    if (!cosmetic) {
      res.status(404).json({ error: "cosmetic not found" });
      return;
    }

    // Check if already owned
    const existing = await getOne("SELECT id FROM user_cosmetics WHERE wallet = $1 AND cosmetic_id = $2", [wallet, cosmeticId]);
    if (existing) {
      res.status(409).json({ error: "already owned" });
      return;
    }

    try {
      await runTransaction(async (client) => {
        const balanceRow = (await client.query(
          "SELECT balance FROM coin_balances WHERE wallet = $1 FOR UPDATE",
          [wallet]
        )).rows[0];
        if ((balanceRow?.balance || 0) < cosmetic.sloth_price) {
          throw new Error("INSUFFICIENT_BALANCE");
        }
        await client.query(
          "UPDATE coin_balances SET balance = balance - $1, updated_at = NOW() WHERE wallet = $2",
          [cosmetic.sloth_price, wallet]
        );
        await client.query(
          "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'cosmetic_purchase', $2, $3)",
          [wallet, -cosmetic.sloth_price, `Purchased ${cosmetic.name}`]
        );
        await client.query(
          "INSERT INTO user_cosmetics (wallet, cosmetic_id) VALUES ($1, $2)",
          [wallet, cosmeticId]
        );
      });
    } catch (err: any) {
      if (err.message === "INSUFFICIENT_BALANCE") {
        res.status(400).json({ error: "insufficient ZZZ balance" });
        return;
      }
      throw err;
    }

    const newBalance = await getOne("SELECT balance FROM coin_balances WHERE wallet = $1", [wallet]);
    res.json({ purchased: true, newBalance: newBalance?.balance || 0 });
  } catch (err) {
    console.error("POST /buy-cosmetic error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/shop/accessories — List all accessories
router.get("/accessories", async (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet as string | undefined;

    if (wallet && !isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const accessories = await getAll("SELECT * FROM accessories ORDER BY id");

    let owned: number[] = [];
    if (wallet) {
      const ownedRows = await getAll("SELECT accessory_id FROM user_accessories WHERE wallet = $1", [wallet]);
      owned = ownedRows.map((r: any) => r.accessory_id);
    }

    res.json({
      accessories: accessories.map((a: any) => ({ ...a, owned: owned.includes(a.id) })),
    });
  } catch (err) {
    console.error("GET /accessories error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/shop/buy-accessory — Purchase an accessory
router.post("/buy-accessory", async (req: Request, res: Response) => {
  try {
    const { wallet, accessoryId } = req.body;
    if (!wallet || !accessoryId) {
      res.status(400).json({ error: "wallet and accessoryId required" });
      return;
    }

    if (!isValidWallet(wallet as string)) {
      res.status(400).json({ error: "Invalid wallet address format" });
      return;
    }

    const accessory = await getOne("SELECT * FROM accessories WHERE id = $1", [accessoryId]);
    if (!accessory) {
      res.status(404).json({ error: "accessory not found" });
      return;
    }

    const existing = await getOne("SELECT id FROM user_accessories WHERE wallet = $1 AND accessory_id = $2", [wallet, accessoryId]);
    if (existing) {
      res.status(409).json({ error: "already owned" });
      return;
    }

    try {
      await runTransaction(async (client) => {
        const balanceRow = (await client.query(
          "SELECT balance FROM coin_balances WHERE wallet = $1 FOR UPDATE",
          [wallet]
        )).rows[0];
        if ((balanceRow?.balance || 0) < accessory.sloth_price) {
          throw new Error("INSUFFICIENT_BALANCE");
        }
        await client.query(
          "UPDATE coin_balances SET balance = balance - $1, updated_at = NOW() WHERE wallet = $2",
          [accessory.sloth_price, wallet]
        );
        await client.query(
          "INSERT INTO transactions (wallet, type, amount, description) VALUES ($1, 'accessory_purchase', $2, $3)",
          [wallet, -accessory.sloth_price, `Purchased ${accessory.name}`]
        );
        await client.query(
          "INSERT INTO user_accessories (wallet, accessory_id) VALUES ($1, $2)",
          [wallet, accessoryId]
        );
      });
    } catch (err: any) {
      if (err.message === "INSUFFICIENT_BALANCE") {
        res.status(400).json({ error: "insufficient ZZZ balance" });
        return;
      }
      throw err;
    }

    const newBalance = await getOne("SELECT balance FROM coin_balances WHERE wallet = $1", [wallet]);
    res.json({ purchased: true, newBalance: newBalance?.balance || 0 });
  } catch (err) {
    console.error("POST /buy-accessory error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
