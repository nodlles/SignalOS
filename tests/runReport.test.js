import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readLatestRunReport, summarizeRunReport, writeRunReport } from "../src/runReport.js";

const report = {
  command: "run",
  status: "success",
  startedAt: "2026-05-01T01:00:00.000Z",
  completedAt: "2999-05-01T01:00:01.000Z",
  window: {
    since: "2026-04-30T01:00:00.000Z",
    until: "2026-05-01T01:00:00.000Z"
  },
  sources: ["Example"],
  ingest: {
    fetched: 2,
    inserted: 1,
    stored: 3,
    errors: 0
  },
  processing: {
    processed: 2,
    candidates: 1,
    discarded: 1,
    cacheHits: 1,
    summarized: 1,
    fallbacks: 0
  },
  outputFile: "briefs/2026-05-01.md",
  errors: []
};

const file = writeRunReport(report);
assert.ok(fs.existsSync(file));
assert.match(file, /\.signalos\/runs\/2999-05-01T01-00-01-000Z-run\.json$/);

const latest = readLatestRunReport();
assert.equal(latest.command, "run");
assert.equal(latest.status, "success");
assert.equal(latest.outputFile, "briefs/2026-05-01.md");

const summary = summarizeRunReport(latest);
assert.match(summary, /最近运行/);
assert.match(summary, /缓存命中：1/);
assert.match(summary, /LLM 摘要：1/);

fs.unlinkSync(file);
const dir = path.dirname(file);
if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
  fs.rmdirSync(dir);
}

console.log("run report tests passed");
