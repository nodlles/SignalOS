import assert from "node:assert/strict";
import { getBriefWindow } from "../src/config.js";

const until = new Date("2026-05-01T01:00:00.000Z");

// Stale lastBriefAt (7 days ago) should be clamped to maxLookbackHours (48h default).
const clamped = getBriefWindow(
  { dailyHour: 9, maxLookbackHours: 48 },
  { lastBriefAt: new Date(until.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() },
  { until: until.toISOString() }
);
assert.equal(
  clamped.since.toISOString(),
  new Date(until.getTime() - 48 * 60 * 60 * 1000).toISOString(),
  "since should be clamped to 48h before until when lastBriefAt is stale"
);
assert.equal(clamped.until.toISOString(), until.toISOString());

// Fresh lastBriefAt (within maxLookback) should be preserved.
const freshSince = new Date(until.getTime() - 12 * 60 * 60 * 1000);
const fresh = getBriefWindow(
  { dailyHour: 9, maxLookbackHours: 48 },
  { lastBriefAt: freshSince.toISOString() },
  { until: until.toISOString() }
);
assert.equal(fresh.since.toISOString(), freshSince.toISOString(), "fresh since should not be clamped");

// Explicit --since should bypass the cap so manual backfills still work.
const manual = getBriefWindow(
  { dailyHour: 9, maxLookbackHours: 48 },
  { lastBriefAt: until.toISOString() },
  {
    since: new Date(until.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    until: until.toISOString()
  }
);
assert.equal(
  manual.since.toISOString(),
  new Date(until.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  "explicit --since should bypass maxLookbackHours"
);

console.log("config window tests passed");
