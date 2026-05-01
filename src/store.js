import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, ensureDataDir } from "./config.js";

const ITEMS_PATH = path.join(DATA_DIR, "items.json");
const STATE_PATH = path.join(DATA_DIR, "state.json");

export function loadItems() {
  if (!fs.existsSync(ITEMS_PATH)) return [];
  return JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8"));
}

export function saveItems(items) {
  ensureDataDir();
  fs.writeFileSync(ITEMS_PATH, `${JSON.stringify(items, null, 2)}\n`);
}

export function upsertItems(newItems) {
  const existing = loadItems();
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const item of newItems) {
    byId.set(item.id, { ...byId.get(item.id), ...item });
  }
  const merged = [...byId.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  saveItems(merged);
  return { inserted: merged.length - existing.length, total: merged.length, items: merged };
}

export function loadState() {
  if (!fs.existsSync(STATE_PATH)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
}

export function saveState(state) {
  ensureDataDir();
  fs.writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

export function selectWindowItems(items, since, until) {
  return items.filter((item) => {
    const publishedAt = new Date(item.publishedAt);
    return publishedAt >= since && publishedAt < until;
  });
}
