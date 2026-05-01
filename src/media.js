const RIGHTS_STATUSES = new Set([
  "owned",
  "licensed",
  "permission_requested",
  "permission_granted",
  "commentary_fair_use_review",
  "blocked"
]);

export function assertRightsStatus(status) {
  if (!RIGHTS_STATUSES.has(status)) {
    throw new Error(`Invalid rights status: ${status}`);
  }
}

export function createMediaPackage(item, { platform = "bilibili" } = {}) {
  const gate = evaluatePublishGate(item);
  return {
    itemId: item.id,
    platform,
    title: localizeTitle(item.title, platform),
    sourceUrl: item.url,
    rightsStatus: item.rightsStatus || "commentary_fair_use_review",
    publishGate: gate,
    script: [
      `开场: 今天解读一个来自 ${item.sourceName} 的高信号内容。`,
      `核心事实: ${item.summary?.whatHappened || item.content}`,
      `为什么重要: ${item.summary?.whyItMatters || "需要人工复核影响。"}`,
      `开发者视角: ${item.summary?.devImpact || "需要补充开发者影响。"}`,
      "来源说明: 本内容为中文解读与评论，不是原视频逐字搬运。"
    ].join("\n\n"),
    description: [
      item.summary?.builderNotes || "人工复核后再发布。",
      "",
      `Original source: ${item.url}`
    ].join("\n"),
    checklist: [
      "确认原始来源链接可访问",
      "确认 rightsStatus 不是 blocked 或 permission_requested",
      "确认脚本包含实质评论、解读或教育价值",
      "确认标题、简介、封面没有误导为原创首发",
      "人工审核字幕、配音、平台规范"
    ]
  };
}

function evaluatePublishGate(item) {
  const status = item.rightsStatus || "commentary_fair_use_review";
  if (status === "blocked" || status === "permission_requested") {
    return { allowed: false, reason: `Rights status is ${status}.` };
  }
  if (status === "owned" || status === "licensed" || status === "permission_granted") {
    return { allowed: true, reason: "Rights status permits packaging after human review." };
  }
  return {
    allowed: false,
    reason: "Commentary/fair-use style items require human review before publishing."
  };
}

function localizeTitle(title, platform) {
  const suffix = platform === "bilibili" ? "｜中文解读" : " 中文解读";
  return `${title}${suffix}`;
}
