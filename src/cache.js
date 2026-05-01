import crypto from "node:crypto";

export const SUMMARY_VERSION = 2;

export function contentHash(item) {
  return sha256([
    item.title || "",
    item.url || "",
    item.content || "",
    item.transcript || ""
  ].join("\n"));
}

export function summaryCacheKey(item, config) {
  const llm = config.llm || {};
  return sha256(JSON.stringify({
    contentHash: contentHash(item),
    language: config.language || "zh-CN",
    provider: llm.provider || "openai",
    apiStyle: llm.apiStyle || "responses",
    model: llm.model || config.model || "gpt-5.4",
    summaryVersion: SUMMARY_VERSION
  }));
}

export function hasValidSummaryCache(item, config) {
  if (!item.summary || !item.summaryCacheKey) return false;
  return item.summaryVersion === SUMMARY_VERSION && item.summaryCacheKey === summaryCacheKey(item, config);
}

export function attachSummaryCache(item, config, summary) {
  return {
    ...item,
    contentHash: contentHash(item),
    summary,
    summaryCacheKey: summaryCacheKey(item, config),
    summaryVersion: SUMMARY_VERSION,
    summarizedAt: new Date().toISOString()
  };
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
