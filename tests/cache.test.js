import assert from "node:assert/strict";
import {
  SUMMARY_VERSION,
  attachSummaryCache,
  contentHash,
  hasValidSummaryCache,
  summaryCacheKey
} from "../src/cache.js";

const config = {
  language: "zh-CN",
  model: "glm-4.6",
  llm: {
    provider: "taishi",
    apiStyle: "chat_completions",
    model: "glm-4.6"
  }
};

const item = {
  id: "1",
  title: "Agent API update",
  url: "https://example.com/agent-api",
  content: "New API for agent workflows.",
  transcript: ""
};

const summary = {
  chineseTitle: "Agent API 更新",
  whatHappened: "发布了新 API。",
  whyItMatters: "影响 Agent 工作流。",
  devImpact: "开发者需要评估集成。",
  builderNotes: "检查 SDK。",
  sourceLabel: "[LLM - Example]"
};

const cached = attachSummaryCache(item, config, summary);

assert.equal(cached.contentHash, contentHash(item));
assert.equal(cached.summaryCacheKey, summaryCacheKey(item, config));
assert.equal(cached.summaryVersion, SUMMARY_VERSION);
assert.ok(cached.summarizedAt);
assert.equal(hasValidSummaryCache(cached, config), true);

assert.equal(hasValidSummaryCache({ ...cached, content: "Changed content." }, config), false);
assert.equal(hasValidSummaryCache(cached, { ...config, language: "en" }), false);
assert.equal(hasValidSummaryCache(cached, { ...config, llm: { ...config.llm, model: "gpt-5.4" } }), false);
assert.equal(hasValidSummaryCache({ ...cached, summaryVersion: SUMMARY_VERSION - 1 }, config), false);
assert.equal(hasValidSummaryCache({ ...cached, summaryCacheKey: "" }, config), false);

console.log("cache tests passed");
