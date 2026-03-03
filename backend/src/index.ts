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
