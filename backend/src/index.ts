import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDB, getOne, getAll } from "./db";
import slugRoutes from "./routes/slug";
import raceRoutes from "./routes/race";
import shopRoutes from "./routes/shop";
import questRoutes from "./routes/quest";
import leaderboardRoutes from "./routes/leaderboard";
import seasonRoutes from "./routes/season";
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

  // Rate limiting
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: "Too many requests, please try again later" },
  });
  app.use('/api', generalLimiter);

  const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: "Too many requests, please try again later" },
  });
  app.use('/api/slug/mint', strictLimiter);
  app.use('/api/slug/daily-login', strictLimiter);
  app.use('/api/slug/evolve', strictLimiter);
  app.use('/api/shop/buy-coins', strictLimiter);

  // Routes
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "slug-rush-api" });
  });

  app.use("/api/slug", slugRoutes);
  app.use("/api/race", raceRoutes);
  app.use("/api/shop", shopRoutes);
  app.use("/api/quests", questRoutes);
  app.use("/api/leaderboard", leaderboardRoutes);
  app.use("/api/season", seasonRoutes);

  // Debug endpoints (non-production only)
  if (!isProduction) {
    app.get("/api/debug/economy-stats", async (_req, res) => {
      const totalSlug = await getOne("SELECT COALESCE(SUM(balance), 0) as total FROM coin_balances");
      const avgBalance = await getOne("SELECT COALESCE(AVG(balance), 0) as avg FROM coin_balances");
      const playerCount = await getOne("SELECT COUNT(*) as count FROM coin_balances WHERE balance > 0");
      res.json({ totalSlugInCirculation: parseInt(totalSlug.total), averageBalance: Math.round(parseFloat(avgBalance.avg)), activePlayers: parseInt(playerCount.count) });
    });

    app.get("/api/debug/progression-stats", async (_req, res) => {
      const avgXP = await getOne("SELECT COALESCE(AVG(total_xp), 0) as avg FROM user_xp");
      const tierDist = await getAll("SELECT COALESCE(tier, 0) as tier, COUNT(*) as count FROM slugs WHERE is_burned = 0 AND type = 'snail' GROUP BY tier ORDER BY tier");
      res.json({ averageXP: Math.round(parseFloat(avgXP.avg)), tierDistribution: tierDist });
    });
  }

  // Global error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  });

  app.listen(PORT, () => {
    console.log(`Slug Rush API running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
