import { Router } from "express";
import { query, getOne, getAll } from "../db";
import { analyzeFeedback, generateWeeklyReport } from "../services/aiAnalysis";

const router = Router();

const VALID_CATEGORIES = ["bug", "feature", "balance", "general"];
const MAX_FEEDBACK_PER_DAY = 3;
const MIN_RACES_REQUIRED = 10;
const MAX_TEXT_LENGTH = 500;

// POST /submit — Submit feedback (quest-gated: 10+ races)
router.post("/submit", async (req, res) => {
  try {
    const { wallet, category, text, rating } = req.body;

    if (!wallet || !category || !text || !rating) {
      return res.status(400).json({ error: "Missing required fields: wallet, category, text, rating" });
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` });
    }

    if (typeof text !== "string" || text.trim().length === 0 || text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ error: `Text must be 1-${MAX_TEXT_LENGTH} characters` });
    }

    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Quest gate: check if player has 10+ races
    const raceCount = await getOne(
      "SELECT COUNT(*) as count FROM race_participants WHERE LOWER(wallet) = LOWER($1)",
      [wallet]
    );
    if (parseInt(raceCount.count) < MIN_RACES_REQUIRED) {
      return res.status(403).json({
        error: `Complete at least ${MIN_RACES_REQUIRED} races to unlock feedback`,
        racesCompleted: parseInt(raceCount.count),
        racesRequired: MIN_RACES_REQUIRED,
      });
    }

    // Rate limit: max 3 per day per wallet
    const today = new Date().toISOString().split("T")[0];
    const dailyCount = await getOne(
      "SELECT COUNT(*) as count FROM feedback WHERE wallet = $1 AND created_at::date = $2::date",
      [wallet.toLowerCase(), today]
    );
    if (parseInt(dailyCount.count) >= MAX_FEEDBACK_PER_DAY) {
      return res.status(429).json({
        error: `Maximum ${MAX_FEEDBACK_PER_DAY} feedback per day. Try again tomorrow.`,
      });
    }

    const result = await query(
      "INSERT INTO feedback (wallet, category, text, rating) VALUES ($1, $2, $3, $4) RETURNING *",
      [wallet.toLowerCase(), category, text.trim(), ratingNum]
    );

    res.status(201).json({
      submitted: true,
      feedback: result.rows[0],
      message: "Thanks! Your feedback helps shape the game.",
    });
  } catch (err) {
    console.error("Feedback submit error:", err);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

// GET /my/:wallet — Player's own feedback
router.get("/my/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const feedbacks = await getAll(
      "SELECT * FROM feedback WHERE wallet = $1 ORDER BY created_at DESC",
      [wallet.toLowerCase()]
    );

    res.json({ feedbacks });
  } catch (err) {
    console.error("Feedback fetch error:", err);
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

// GET /stats — Public stats
router.get("/stats", async (_req, res) => {
  try {
    const total = await getOne("SELECT COUNT(*) as count FROM feedback");
    const categories = await getAll(
      "SELECT category, COUNT(*) as count FROM feedback GROUP BY category ORDER BY count DESC"
    );
    const avgRating = await getOne(
      "SELECT COALESCE(AVG(rating), 0) as avg FROM feedback"
    );
    const statusBreakdown = await getAll(
      "SELECT status, COUNT(*) as count FROM feedback GROUP BY status ORDER BY count DESC"
    );

    res.json({
      total: parseInt(total.count),
      avgRating: Math.round(parseFloat(avgRating.avg) * 100) / 100,
      categories,
      statusBreakdown,
    });
  } catch (err) {
    console.error("Feedback stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// GET /eligibility/:wallet — Check if wallet can submit feedback
router.get("/eligibility/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const raceCount = await getOne(
      "SELECT COUNT(*) as count FROM race_participants WHERE LOWER(wallet) = LOWER($1)",
      [wallet]
    );
    const races = parseInt(raceCount.count);

    const today = new Date().toISOString().split("T")[0];
    const dailyCount = await getOne(
      "SELECT COUNT(*) as count FROM feedback WHERE LOWER(wallet) = LOWER($1) AND created_at::date = $2::date",
      [wallet, today]
    );
    const feedbackToday = parseInt(dailyCount.count);

    res.json({
      eligible: races >= MIN_RACES_REQUIRED,
      racesCompleted: races,
      racesRequired: MIN_RACES_REQUIRED,
      feedbackToday,
      feedbackLimit: MAX_FEEDBACK_PER_DAY,
      canSubmit: races >= MIN_RACES_REQUIRED && feedbackToday < MAX_FEEDBACK_PER_DAY,
    });
  } catch (err) {
    console.error("Eligibility check error:", err);
    res.status(500).json({ error: "Failed to check eligibility" });
  }
});

// POST /analyze — Admin: AI analyze pending feedback
router.post("/analyze", async (_req, res) => {
  try {
    const pending = await getAll(
      "SELECT * FROM feedback WHERE ai_sentiment IS NULL ORDER BY created_at ASC LIMIT 50"
    );

    if (pending.length === 0) {
      return res.json({ analyzed: 0, message: "No pending feedback to analyze" });
    }

    const results = await analyzeFeedback(pending);

    let updated = 0;
    for (const result of results) {
      await query(
        "UPDATE feedback SET ai_category = $1, ai_sentiment = $2, ai_priority = $3 WHERE id = $4",
        [result.ai_category, result.ai_sentiment, result.ai_priority, result.id]
      );
      updated++;
    }

    res.json({ analyzed: updated, total: pending.length });
  } catch (err) {
    console.error("AI analysis error:", err);
    res.status(500).json({ error: "AI analysis failed" });
  }
});

// POST /report/generate — Admin: Generate weekly report
router.post("/report/generate", async (_req, res) => {
  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    const feedbacks = await getAll(
      "SELECT * FROM feedback WHERE created_at >= $1 ORDER BY created_at ASC",
      [weekStart.toISOString()]
    );

    if (feedbacks.length === 0) {
      return res.json({ generated: false, message: "No feedback in the last 7 days" });
    }

    const report = await generateWeeklyReport(feedbacks);
    if (!report) {
      return res.status(500).json({ error: "Failed to generate report" });
    }

    const result = await query(
      `INSERT INTO feedback_reports (week_start, week_end, total_feedback, avg_rating, top_requests, critical_bugs, sentiment_breakdown, full_report)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        weekStart.toISOString().split("T")[0],
        now.toISOString().split("T")[0],
        report.total_feedback,
        report.avg_rating,
        JSON.stringify(report.top_requests),
        JSON.stringify(report.critical_bugs),
        JSON.stringify(report.sentiment_breakdown),
        report.full_report,
      ]
    );

    res.status(201).json({ generated: true, report: result.rows[0] });
  } catch (err) {
    console.error("Report generation error:", err);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

// GET /report/latest — Latest weekly report
router.get("/report/latest", async (_req, res) => {
  try {
    const report = await getOne(
      "SELECT * FROM feedback_reports ORDER BY created_at DESC LIMIT 1"
    );

    if (!report) {
      return res.json({ report: null });
    }

    res.json({ report });
  } catch (err) {
    console.error("Report fetch error:", err);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

// GET /report/:weekId — Specific week report
router.get("/report/:weekId", async (req, res) => {
  try {
    const { weekId } = req.params;
    const report = await getOne(
      "SELECT * FROM feedback_reports WHERE id = $1",
      [parseInt(weekId)]
    );

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json({ report });
  } catch (err) {
    console.error("Report fetch error:", err);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

// GET /community — All feedback with pagination
router.get("/community", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const sort = req.query.sort === "upvotes" ? "upvotes DESC" : "created_at DESC";
    const category = req.query.category as string;
    const status = req.query.status as string;

    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (category && VALID_CATEGORIES.includes(category)) {
      params.push(category);
      whereClause += ` AND category = $${params.length}`;
    }

    if (status && ["pending", "reviewed", "implemented", "rejected"].includes(status)) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }

    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const feedbacks = await getAll(
      `SELECT * FROM feedback ${whereClause} ORDER BY ${sort} LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countResult = await getOne(
      `SELECT COUNT(*) as count FROM feedback ${whereClause.replace(` LIMIT $${params.length - 1} OFFSET $${params.length}`, '')}`,
      params.slice(0, -2)
    );

    res.json({
      feedbacks,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.count),
        totalPages: Math.ceil(parseInt(countResult.count) / limit),
      },
    });
  } catch (err) {
    console.error("Community feed error:", err);
    res.status(500).json({ error: "Failed to fetch community feedback" });
  }
});

// POST /:id/upvote — Upvote feedback (1 per wallet per feedback)
router.post("/:id/upvote", async (req, res) => {
  try {
    const feedbackId = parseInt(req.params.id);
    const { wallet } = req.body;

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    // Check feedback exists
    const feedback = await getOne("SELECT id FROM feedback WHERE id = $1", [feedbackId]);
    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    // Check if already upvoted
    const existing = await getOne(
      "SELECT feedback_id FROM feedback_upvotes WHERE feedback_id = $1 AND wallet = $2",
      [feedbackId, wallet.toLowerCase()]
    );
    if (existing) {
      return res.status(409).json({ error: "Already upvoted this feedback" });
    }

    // Insert upvote and increment counter
    await query(
      "INSERT INTO feedback_upvotes (feedback_id, wallet) VALUES ($1, $2)",
      [feedbackId, wallet.toLowerCase()]
    );
    await query(
      "UPDATE feedback SET upvotes = upvotes + 1 WHERE id = $1",
      [feedbackId]
    );

    const updated = await getOne("SELECT upvotes FROM feedback WHERE id = $1", [feedbackId]);

    res.json({ upvoted: true, feedbackId, upvotes: updated.upvotes });
  } catch (err) {
    console.error("Upvote error:", err);
    res.status(500).json({ error: "Failed to upvote" });
  }
});

// GET /trending — Top 10 most upvoted feedback
router.get("/trending", async (_req, res) => {
  try {
    const trending = await getAll(
      "SELECT * FROM feedback WHERE upvotes > 0 ORDER BY upvotes DESC, created_at DESC LIMIT 10"
    );

    res.json({ trending });
  } catch (err) {
    console.error("Trending fetch error:", err);
    res.status(500).json({ error: "Failed to fetch trending" });
  }
});

export default router;
