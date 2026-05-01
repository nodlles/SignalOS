#!/usr/bin/env node
// Extract P0/P1 headlines from today's brief and send to Telegram.
// Reads: briefs/YYYY-MM-DD.md
// Env:   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

import fs from "node:fs";
import path from "node:path";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!botToken || !chatId) {
  console.error("notify-telegram: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set; skipping.");
  process.exit(0);
}

const briefPath = process.argv[2] || defaultBriefPath();
if (!fs.existsSync(briefPath)) {
  console.error(`notify-telegram: brief not found at ${briefPath}; skipping.`);
  process.exit(0);
}

const markdown = fs.readFileSync(briefPath, "utf8");
const headlines = extractHeadlines(markdown);
const message = composeMessage(briefPath, headlines);

const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: "HTML",
    disable_web_page_preview: true
  })
});

if (!response.ok) {
  const body = await response.text();
  console.error(`notify-telegram: HTTP ${response.status}: ${body}`);
  process.exit(1);
}
console.log(`notify-telegram: sent ${headlines.length} headline(s).`);

function defaultBriefPath() {
  const date = new Date();
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return path.join("briefs", `${y}-${m}-${d}.md`);
}

function extractHeadlines(md) {
  const sections = splitSections(md);
  const items = [];
  for (const rank of ["P0", "P1"]) {
    const body = sections[rank];
    if (!body) continue;
    for (const block of body.split(/\n### /).slice(1)) {
      const headline = block.split("\n")[0].trim();
      const score = (block.match(/评分：([\d.]+)/) || [])[1];
      const link = (block.match(/原文链接：(\S+)/) || [])[1];
      if (!link) continue;
      items.push({ rank, headline, score, link });
    }
  }
  return items;
}

function splitSections(md) {
  const sections = {};
  const parts = md.split(/^## /m);
  for (const part of parts) {
    const match = part.match(/^(P0|P1|P2)\b/);
    if (match) sections[match[1]] = part;
  }
  return sections;
}

function composeMessage(briefPath, headlines) {
  const filename = path.basename(briefPath).replace(/\.md$/, "");
  if (headlines.length === 0) {
    return `<b>SignalOS ${escapeHtml(filename)}</b>\n\n今天没有 P0/P1 头条。完整 brief: ${escapeHtml(briefPath)}`;
  }
  const lines = [`<b>SignalOS ${escapeHtml(filename)}</b>`, ""];
  const byRank = { P0: [], P1: [] };
  for (const item of headlines) byRank[item.rank].push(item);
  for (const rank of ["P0", "P1"]) {
    const items = byRank[rank];
    if (items.length === 0) continue;
    lines.push(`<b>${rank}</b>`);
    for (const item of items) {
      const score = item.score ? ` · ${item.score}` : "";
      lines.push(`• <a href="${escapeHtml(item.link)}">${escapeHtml(item.headline)}</a>${score}`);
    }
    lines.push("");
  }
  lines.push(`完整 brief: <code>${escapeHtml(briefPath)}</code>`);
  const message = lines.join("\n");
  return message.length > 4000 ? `${message.slice(0, 3950)}\n… (truncated)` : message;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
