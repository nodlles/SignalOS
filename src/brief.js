import fs from "node:fs";
import path from "node:path";

export function renderBrief(items, { since, until }) {
  const ranked = {
    P0: items.filter((item) => item.rank === "P0"),
    P1: items.filter((item) => item.rank === "P1"),
    P2: items.filter((item) => item.rank === "P2")
  };
  const lines = [
    `# SignalOS DailyBrief - ${formatDate(until)}`,
    "",
    `时间窗口：${since.toISOString()} -> ${until.toISOString()}`,
    "",
    "## P0 - 头条信号",
    ""
  ];

  appendDetailed(lines, ranked.P0);
  lines.push("## P1 - 高价值信息", "");
  appendDetailed(lines, ranked.P1);
  lines.push("## P2 - 快速扫读", "");
  appendQuick(lines, ranked.P2);
  lines.push("## 视频 / 播客洞察", "");
  appendDetailed(lines, items.filter((item) => ["youtube", "podcast"].includes(item.sourceType) && item.rank !== "discarded"));
  lines.push("## 趋势雷达", "");
  lines.push(renderTrendRadar(items));
  lines.push("", "## Builder Notes - 可执行建议", "");
  lines.push(renderBuilderNotes(items));
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function writeBrief(markdown, until) {
  fs.mkdirSync("briefs", { recursive: true });
  const file = path.join("briefs", `${formatDate(until)}.md`);
  fs.writeFileSync(file, markdown);
  return file;
}

function appendDetailed(lines, items) {
  if (items.length === 0) {
    lines.push("_没有符合条件的内容。_", "");
    return;
  }
  for (const item of items) {
    const summary = item.summary || {};
    lines.push(`### ${displayTitle(item)}`);
    lines.push("");
    if (displayTitle(item) !== item.title) {
      lines.push(`原始标题：${item.title}`);
      lines.push("");
    }
    lines.push(`评分：${item.score} | 来源：${summary.sourceLabel || item.sourceName}`);
    lines.push("");
    lines.push(`发生了什么：${summary.whatHappened || item.content}`);
    lines.push("");
    lines.push(`为什么重要：${summary.whyItMatters || "需要复核。"}`);
    lines.push("");
    lines.push(`开发者影响：${summary.devImpact || "需要复核。"}`);
    lines.push("");
    lines.push(`Builder Notes：${summary.builderNotes || "需要人工复核。"}`);
    lines.push("");
    lines.push(`原文链接：${item.url}`);
    lines.push("");
  }
}

function appendQuick(lines, items) {
  if (items.length === 0) {
    lines.push("_没有符合条件的内容。_", "");
    return;
  }
  for (const item of items) {
    const summary = item.summary?.whatHappened ? ` - ${oneLine(item.summary.whatHappened, 180)}` : "";
    const original = displayTitle(item) !== item.title ? ` / 原始标题：${item.title}` : "";
    lines.push(`- ${displayTitle(item)} (${item.sourceName}${original})${summary} - ${item.url}`);
  }
  lines.push("");
}

function displayTitle(item) {
  return item.summary?.chineseTitle || item.title;
}

function oneLine(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function renderTrendRadar(items) {
  const active = items.filter((item) => item.rank && item.rank !== "discarded");
  if (active.length === 0) return "_这个窗口内没有明显强趋势。_";
  const hasAgent = active.some((item) => /agent/i.test(`${item.title} ${item.content}`));
  const hasApi = active.some((item) => /api|sdk/i.test(`${item.title} ${item.content}`));
  if (hasAgent && hasApi) return "今天最强的开发者信号集中在 Agent 工作流和 API 能力演进。";
  if (hasAgent) return "今天最强的开发者信号集中在 Agent 工作流演进。";
  if (hasApi) return "今天最强的开发者信号集中在 API/SDK 能力变化。";
  return "今天有高信号内容，但没有单一技术主题占据主导。";
}

function renderBuilderNotes(items) {
  const top = items.filter((item) => ["P0", "P1"].includes(item.rank));
  if (top.length === 0) return "_暂无明确可执行建议。_";
  return top
    .slice(0, 5)
    .map((item) => `- ${displayTitle(item)}: ${item.summary?.builderNotes || "复核原文，判断是否能转成可构建的工作流。"}`)
    .join("\n");
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}
