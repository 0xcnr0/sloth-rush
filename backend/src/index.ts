import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDB } from "./db";
import slugRoutes from "./routes/slug";
import raceRoutes from "./routes/race";
import shopRoutes from "./routes/shop";

dotenv.config();

// Initialize database
initDB();

const app = express();
const PORT = process.env.PORT || 3001;

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

app.listen(PORT, () => {
  console.log(`Slug Rush API running on port ${PORT}`);
});
