import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

interface FeedbackItem {
  id: number;
  wallet: string;
  category: string;
  text: string;
  rating: number;
  created_at: string;
}

interface AnalysisResult {
  id: number;
  ai_category: string;
  ai_sentiment: "positive" | "neutral" | "negative";
  ai_priority: "high" | "medium" | "low";
}

interface WeeklyReport {
  total_feedback: number;
  avg_rating: number;
  top_requests: { text: string; count: number; category: string }[];
  critical_bugs: { text: string; severity: string; feedback_id: number }[];
  sentiment_breakdown: { positive: number; neutral: number; negative: number };
  full_report: string;
}

export async function analyzeFeedback(
  feedbackList: FeedbackItem[]
): Promise<AnalysisResult[]> {
  if (feedbackList.length === 0) return [];

  const feedbackText = feedbackList
    .map(
      (f) =>
        `[ID:${f.id}] Category: ${f.category} | Rating: ${f.rating}/5 | Text: "${f.text}"`
    )
    .join("\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are analyzing player feedback for a blockchain sloth racing game called "Sloth Rush".
For each feedback item, determine:
1. sentiment: "positive", "neutral", or "negative"
2. priority: "high" (game-breaking bugs, critical issues), "medium" (important features, balance issues), or "low" (minor suggestions, cosmetic requests)
3. refined_category: one of "bug", "feature", "balance", "general", "ux", "performance"

Here are the feedback items:
${feedbackText}

Respond with a JSON array only, no other text. Each item: {"id": number, "ai_category": string, "ai_sentiment": string, "ai_priority": string}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") return [];

  try {
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]) as AnalysisResult[];
  } catch {
    console.error("Failed to parse AI analysis response");
    return [];
  }
}

export async function generateWeeklyReport(
  feedbackList: FeedbackItem[]
): Promise<WeeklyReport | null> {
  if (feedbackList.length === 0) return null;

  const totalRating =
    feedbackList.reduce((sum, f) => sum + (f.rating || 0), 0) /
    feedbackList.length;

  const feedbackText = feedbackList
    .map(
      (f) =>
        `[ID:${f.id}] Category: ${f.category} | Rating: ${f.rating}/5 | Text: "${f.text}"`
    )
    .join("\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are generating a weekly feedback report for "Sloth Rush", a blockchain sloth racing game on Base L2.

Analyze these ${feedbackList.length} feedback items from this week:
${feedbackText}

Generate a report with:
1. A JSON object with these fields:
   - top_requests: array of {text, count, category} — most requested features/changes (max 5)
   - critical_bugs: array of {text, severity, feedback_id} — critical bugs reported (max 5)
   - sentiment_breakdown: {positive: number, neutral: number, negative: number} — count of each sentiment

2. A markdown report covering:
   - Overall player satisfaction (based on ratings)
   - Key trends and patterns
   - Top 3 most requested features
   - Critical issues needing attention
   - Recommendations for the dev team

Respond with JSON in this format (no other text):
{
  "top_requests": [...],
  "critical_bugs": [...],
  "sentiment_breakdown": {...},
  "full_report": "markdown string here"
}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") return null;

  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      total_feedback: feedbackList.length,
      avg_rating: Math.round(totalRating * 100) / 100,
      top_requests: parsed.top_requests || [],
      critical_bugs: parsed.critical_bugs || [],
      sentiment_breakdown: parsed.sentiment_breakdown || {
        positive: 0,
        neutral: 0,
        negative: 0,
      },
      full_report: parsed.full_report || "",
    };
  } catch {
    console.error("Failed to parse weekly report response");
    return null;
  }
}
