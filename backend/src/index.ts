import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDB, getOne, getAll } from "./db";
import racerRoutes from "./routes/racer";
import raceRoutes from "./routes/race";
import shopRoutes from "./routes/shop";
import leaderboardRoutes from "./routes/leaderboard";
import seasonRoutes from "./routes/season";
import socialRoutes from "./routes/social";
import rateLimit from 'express-rate-limit';

dotenv.config();

const PORT = process.env.PORT || 3001;

async function main() {
  // Initialize database
  await initDB();

  const app = express();

  const isProduction = process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT === "production";
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',')
    : ['http://localhost:5173', 'http://localhost:3000'];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn("Blocked CORS request from:", origin);
        callback(null, false);
      }
    }
  }));
  app.use(express.json());

  // Rate limiting.
  //
  // The end-to-end QA suite makes far more requests per minute than a real
  // player ever would, so outside production it may present a shared secret to
  // opt out. The secret is only honoured when QA_BYPASS_TOKEN is explicitly
  // set AND we are not in production, so a deployed server can never be
  // talked out of rate limiting. The suite's own rate-limit tests deliberately
  // omit the header, so they still exercise the real limiter.
  const qaBypassToken = process.env.QA_BYPASS_TOKEN;
  const skipRateLimit = (req: express.Request): boolean =>
    !isProduction && !!qaBypassToken && req.headers["x-qa-bypass"] === qaBypassToken;

  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: "Too many requests, please try again later" },
    skip: skipRateLimit,
  });
  app.use('/api', generalLimiter);

  const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: "Too many requests, please try again later" },
    skip: skipRateLimit,
  });
  app.use('/api/racer/mint', strictLimiter);
  app.use('/api/racer/daily-login', strictLimiter);
  app.use('/api/racer/evolve', strictLimiter);
  app.use('/api/shop/buy-coins', strictLimiter);

  // Routes
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "race-api" });
  });

  app.use("/api/racer", racerRoutes);
  app.use("/api/race", raceRoutes);
  app.use("/api/shop", shopRoutes);
  app.use("/api/leaderboard", leaderboardRoutes);
  app.use("/api/season", seasonRoutes);
  app.use("/api/social", socialRoutes);

  // Debug endpoints (non-production only)
  if (!isProduction) {
    app.get("/api/debug/economy-stats", async (_req, res) => {
      const totalCoins = await getOne("SELECT COALESCE(SUM(balance), 0) as total FROM coin_balances");
      const avgBalance = await getOne("SELECT COALESCE(AVG(balance), 0) as avg FROM coin_balances");
      const playerCount = await getOne("SELECT COUNT(*) as count FROM coin_balances WHERE balance > 0");
      res.json({ totalCoinsInCirculation: parseInt(totalCoins.total), averageBalance: Math.round(parseFloat(avgBalance.avg)), activePlayers: parseInt(playerCount.count) });
    });

    app.get("/api/debug/progression-stats", async (_req, res) => {
      const avgXP = await getOne("SELECT COALESCE(AVG(total_xp), 0) as avg FROM user_xp");
      const tierDist = await getAll("SELECT COALESCE(tier, 0) as tier, COUNT(*) as count FROM racers WHERE is_burned = 0 AND type = 'pro' GROUP BY tier ORDER BY tier");
      res.json({ averageXP: Math.round(parseFloat(avgXP.avg)), tierDistribution: tierDist });
    });
  }

  // Global error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  });

  app.listen(PORT, () => {
    console.log(`Race API running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
