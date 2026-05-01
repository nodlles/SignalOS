import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, ensureDataDir } from "./config.js";

const RUNS_DIR = path.join(DATA_DIR, "runs");

export function writeRunReport(report) {
  ensureDataDir();
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  const timestamp = sanitizeTimestamp(report.completedAt || new Date().toISOString());
  const file = path.join(RUNS_DIR, `${timestamp}-${report.command}.json`);
  fs.writeFileSync(file, `${JSON.stringify({ ...report, reportPath: file }, null, 2)}\n`);
  return file;
}

export function readLatestRunReport() {
  if (!fs.existsSync(RUNS_DIR)) return null;
  const files = fs.readdirSync(RUNS_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort();
  if (files.length === 0) return null;
  const file = path.join(RUNS_DIR, files[files.length - 1]);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function summarizeRunReport(report) {
  if (!report) return "暂无运行报告。";
  return [
    `最近运行：${report.completedAt}`,
    `命令：${report.command}`,
    `时间窗口：${report.window?.since} -> ${report.window?.until}`,
    `输出文件：${report.outputFile || "无"}`,
    `信源：${(report.sources || []).join(", ") || "无"}`,
    `抓取：${report.ingest?.fetched ?? 0} 条，错误：${report.ingest?.errors ?? 0}`,
    `处理：${report.processing?.processed ?? 0} 条，候选：${report.processing?.candidates ?? 0} 条，丢弃：${report.processing?.discarded ?? 0} 条`,
    `缓存命中：${report.processing?.cacheHits ?? 0}，LLM 摘要：${report.processing?.summarized ?? 0}，fallback：${report.processing?.fallbacks ?? 0}`,
    `状态：${report.status}`
  ].join("\n");
}

function sanitizeTimestamp(value) {
  return value.replace(/[:.]/g, "-");
}
