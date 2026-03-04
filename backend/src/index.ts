import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDB } from "./db";
import slugRoutes from "./routes/slug";
import raceRoutes from "./routes/race";
import shopRoutes from "./routes/shop";
import questRoutes from "./routes/quest";
import leaderboardRoutes from "./routes/leaderboard";

dotenv.config();

const PORT = process.env.PORT || 3001;

async function main() {
  // Initialize database
  await initDB();

  const app = express();

  const isProduction = process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT === "production";
  if (isProduction && !process.env.FRONTEND_URL) {
    console.error("FATAL: FRONTEND_URL must be set in production. Exiting.");
    process.exit(1);
  }
  app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
  app.use(express.json());

  // Routes
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "slug-rush-api" });
  });

  app.use("/api/slug", slugRoutes);
  app.use("/api/race", raceRoutes);
  app.use("/api/shop", shopRoutes);
  app.use("/api/quests", questRoutes);
  app.use("/api/leaderboard", leaderboardRoutes);

  app.listen(PORT, () => {
    console.log(`Slug Rush API running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
