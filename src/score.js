const DEV_KEYWORDS = [
  "api", "sdk", "agent", "agents", "workflow", "cli", "developer", "infra",
  "architecture", "model", "llama", "qwen", "kimi", "glm", "openai",
  "anthropic", "gemini", "deepmind", "github", "rag", "mcp"
];

const ACTION_KEYWORDS = ["launch", "release", "open source", "github", "api", "sdk", "demo", "benchmark"];

export function scoreItem(item, sourceQuality = 5, now = new Date()) {
  const text = `${item.title} ${item.content} ${item.transcript || ""}`.toLowerCase();
  const ageHours = Math.max(0, (now - new Date(item.publishedAt)) / 36e5);
  const freshness = ageHours <= 24 ? 1.5 : ageHours <= 48 ? 0.5 : -3;
  const devRelevance = countHits(text, DEV_KEYWORDS, 3);
  const actionability = countHits(text, ACTION_KEYWORDS, 2) * 0.75;
  const impact = countHits(text, ["openai", "anthropic", "google", "meta", "qwen", "kimi", "glm"], 2) * 0.75;
  const thinPenalty = (item.content || "").length < 80 ? 2 : 0;
  const score = clamp(sourceQuality / 5 + freshness + devRelevance + actionability + impact - thinPenalty, 0, 10);
  return Math.round(score * 10) / 10;
}

export function rankScore(score, item, now = new Date()) {
  const ageDays = (now - new Date(item.publishedAt)) / 864e5;
  if (ageDays > 7) return "discarded";
  if (score >= 8.5) return "P0";
  if (score >= 6) return "P1";
  if (score >= 3) return "P2";
  return "discarded";
}

function countHits(text, keywords, cap) {
  const hits = keywords.reduce((total, keyword) => total + (matchesKeyword(text, keyword) ? 1 : 0), 0);
  return Math.min(hits, cap);
}

function matchesKeyword(text, keyword) {
  if (keyword.includes(" ")) return text.includes(keyword);
  return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(text);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
