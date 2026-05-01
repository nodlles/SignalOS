import assert from "node:assert/strict";
import { getDiscardReason, rankScore, scoreItem } from "../src/score.js";

const now = new Date("2026-05-01T12:00:00.000Z");

const thinYoutube = {
  title: "Short clip",
  sourceType: "youtube",
  publishedAt: "2026-05-01T10:00:00.000Z",
  content: "Watch this clip.",
  transcript: ""
};

assert.equal(getDiscardReason(thinYoutube, now), "low information content");
assert.equal(scoreItem(thinYoutube, 8, now), 0);
assert.equal(rankScore(10, thinYoutube, now), "discarded");

const richYoutube = {
  title: "AI distribution moat",
  sourceType: "youtube",
  publishedAt: "2026-05-01T10:00:00.000Z",
  content: "A".repeat(800),
  transcript: ""
};

assert.equal(getDiscardReason(richYoutube, now), "");
assert.equal(rankScore(1, richYoutube, now), "P2");

const transcriptYoutube = {
  title: "Agent workflow demo",
  sourceType: "youtube",
  publishedAt: "2026-05-01T10:00:00.000Z",
  content: "Short description.",
  transcript: "This transcript discusses agent workflow, API integration, and developer automation. ".repeat(8)
};

assert.equal(getDiscardReason(transcriptYoutube, now), "");

console.log("score tests passed");
