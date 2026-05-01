#!/usr/bin/env node
import fs from "node:fs";
import { initConfig, loadConfig, saveConfig, getBriefWindow } from "./config.js";
import { ingestSources } from "./ingest/index.js";
import { renderBrief, writeBrief } from "./brief.js";
import { createMediaPackage, assertRightsStatus } from "./media.js";
import { getDiscardReason, rankScore, scoreItem } from "./score.js";
import { summarizeItem, testLlm } from "./summarize.js";
import { loadItems, loadState, saveState, selectWindowItems, upsertItems, saveItems } from "./store.js";
import { fetchYouTubeTranscript, resolveYouTubeFeedUrl } from "./ingest/youtube.js";

const args = process.argv.slice(2);
const command = args[0] || "help";

try {
  await main(command, args.slice(1));
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}

async function main(command, argv) {
  if (command === "help" || command === "--help" || command === "-h") return printHelp();
  if (command === "init") return cmdInit(argv);
  if (command === "sources") return cmdSources(argv);
  if (command === "ingest") return cmdIngest(argv);
  if (command === "brief") return cmdBrief(argv);
  if (command === "run") return cmdRun(argv);
  if (command === "llm") return cmdLlm(argv);
  if (command === "media") return cmdMedia(argv);
  if (command === "youtube") return cmdYoutube(argv);
  throw new Error(`Unknown command: ${command}`);
}

function cmdInit(argv) {
  const result = initConfig({ force: argv.includes("--force") });
  console.log(result.created ? `Created ${result.path}` : `${result.path} already exists`);
}

async function cmdSources(argv) {
  const sub = argv[0];
  const config = loadConfig();
  if (sub === "list") {
    for (const source of config.sources) {
      console.log(`${source.name}\t${source.type}\tq=${source.quality || 5}\t${source.url}`);
    }
    return;
  }
  if (sub === "add") {
    const [name, url] = argv.slice(1);
    if (!name || !url) throw new Error("Usage: signalos sources add <name> <url> [--type rss|youtube|podcast]");
    const type = readOption(argv, "--type") || "rss";
    config.sources.push({ name, url, type, quality: Number(readOption(argv, "--quality") || 5) });
    saveConfig(config);
    console.log(`Added source: ${name}`);
    return;
  }
  if (sub === "add-youtube") {
    const [name, channel] = argv.slice(1);
    if (!name || !channel) throw new Error("Usage: signalos sources add-youtube <name> <channelId|channelUrl|feedUrl> [--quality 1-10]");
    const url = await resolveYouTubeFeedUrl(channel);
    config.sources.push({ name, url, type: "youtube", quality: Number(readOption(argv, "--quality") || 8) });
    saveConfig(config);
    console.log(`Added YouTube source: ${name}\t${url}`);
    return;
  }
  throw new Error("Usage: signalos sources list|add");
}

async function cmdIngest(argv) {
  const { config, window } = loadContext(argv);
  const logger = createLogger(argv);
  const sources = selectSources(config.sources, argv);
  logger(`ingest: ${sources.length} source(s), ${window.since.toISOString()} -> ${window.until.toISOString()}`);
  const { items, errors } = await ingestSources(sources, window, { logger });
  reportErrors(errors);
  if (argv.includes("--dry-run")) {
    console.log(`Fetched ${items.length} item(s), dry-run only.`);
    for (const item of items) console.log(`${item.publishedAt}\t${item.sourceName}\t${item.title}`);
    return;
  }
  const result = upsertItems(items);
  console.log(`Fetched ${items.length}; inserted ${result.inserted}; stored ${result.total}.`);
}

async function cmdBrief(argv) {
  const { config, state, window } = loadContext(argv);
  const logger = createLogger(argv);
  const items = filterItemsBySource(selectWindowItems(loadItems(), window.since, window.until), argv);
  logger(`brief: ${items.length} stored item(s) in window`);
  const processed = await processItems(items, config, {
    offline: argv.includes("--offline"),
    refresh: argv.includes("--refresh"),
    limit: Number(readOption(argv, "--limit") || 0),
    logger
  });
  const markdown = renderBrief(processed, window);
  const file = writeBrief(markdown, window.until);
  saveItems(mergeProcessed(loadItems(), processed));
  saveState({ ...state, lastBriefAt: window.until.toISOString() });
  console.log(`Wrote ${file} with ${processed.length} item(s).`);
}

async function cmdRun(argv) {
  const { config, state, window } = loadContext(argv);
  const logger = createLogger(argv);
  const sources = selectSources(config.sources, argv);
  logger(`run: ${sources.length} source(s), ${window.since.toISOString()} -> ${window.until.toISOString()}`);
  const { items, errors } = await ingestSources(sources, window, { logger });
  reportErrors(errors);
  if (argv.includes("--dry-run")) {
    console.log(`Window ${window.since.toISOString()} -> ${window.until.toISOString()}`);
    console.log(`Fetched ${items.length} item(s), dry-run only.`);
    for (const item of items) console.log(`${item.publishedAt}\t${item.sourceName}\t${item.title}`);
    return;
  }
  upsertItems(items);
  const selected = filterItemsBySource(selectWindowItems(loadItems(), window.since, window.until), argv);
  logger(`run: ${selected.length} item(s) selected for scoring/summarization`);
  const processed = await processItems(selected, config, {
    offline: argv.includes("--offline"),
    refresh: argv.includes("--refresh"),
    limit: Number(readOption(argv, "--limit") || 0),
    logger
  });
  saveItems(mergeProcessed(loadItems(), processed));
  const markdown = renderBrief(processed, window);
  const file = writeBrief(markdown, window.until);
  saveState({ ...state, lastBriefAt: window.until.toISOString() });
  console.log(`Wrote ${file} with ${processed.length} item(s).`);
}

async function cmdLlm(argv) {
  const sub = argv[0];
  const config = loadConfig();
  if (sub === "config") {
    console.log(JSON.stringify(maskLlmConfig(config.llm), null, 2));
    return;
  }
  if (sub === "set") {
    const next = {
      ...config,
      llm: {
        ...config.llm,
        provider: readOption(argv, "--provider") || config.llm.provider,
        baseUrl: readOption(argv, "--base-url") || config.llm.baseUrl,
        apiStyle: readOption(argv, "--api-style") || config.llm.apiStyle,
        model: readOption(argv, "--model") || config.llm.model,
        apiKeyEnv: readOption(argv, "--api-key-env") || config.llm.apiKeyEnv,
        authScheme: readOption(argv, "--auth-scheme") || config.llm.authScheme
      },
      model: readOption(argv, "--model") || config.model
    };
    saveConfig(next);
    console.log("Updated LLM config:");
    console.log(JSON.stringify(maskLlmConfig(next.llm), null, 2));
    return;
  }
  if (sub === "test") {
    const prompt = readOption(argv, "--prompt") || "Hello, reply with one short sentence.";
    const text = await testLlm(config, prompt);
    console.log(text);
    return;
  }
  throw new Error("Usage: signalos llm config|set|test");
}

function cmdMedia(argv) {
  const sub = argv[0];
  const itemId = argv[1];
  if (!sub || !itemId) throw new Error("Usage: signalos media package|rights <itemId>");
  const items = loadItems();
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error(`Item not found: ${itemId}`);
  if (sub === "rights") {
    const status = argv[2];
    assertRightsStatus(status);
    item.rightsStatus = status;
    saveItems(items);
    console.log(`Updated ${itemId} rightsStatus=${status}`);
    return;
  }
  if (sub === "package") {
    const mediaPackage = createMediaPackage(item, { platform: readOption(argv, "--platform") || "bilibili" });
    fs.mkdirSync(".signalos/media-packages", { recursive: true });
    const file = `.signalos/media-packages/${item.id}-${mediaPackage.platform}.json`;
    fs.writeFileSync(file, `${JSON.stringify(mediaPackage, null, 2)}\n`);
    console.log(`Wrote ${file}; publish allowed=${mediaPackage.publishGate.allowed}`);
    return;
  }
  throw new Error("Usage: signalos media package|rights <itemId>");
}

async function cmdYoutube(argv) {
  const sub = argv[0];
  if (sub === "transcript") {
    const target = argv[1];
    if (!target) throw new Error("Usage: signalos youtube transcript <videoId|url>");
    const transcript = await fetchYouTubeTranscript(target);
    console.log(transcript || "No transcript found.");
    return;
  }
  if (sub === "feed-url") {
    const target = argv[1];
    if (!target) throw new Error("Usage: signalos youtube feed-url <channelId|channelUrl|feedUrl>");
    console.log(await resolveYouTubeFeedUrl(target));
    return;
  }
  throw new Error("Usage: signalos youtube transcript|feed-url");
}

function maskLlmConfig(llm) {
  return {
    ...llm,
    apiKeyEnv: llm?.apiKeyEnv || "OPENAI_API_KEY",
    apiKey: "<not stored>"
  };
}

async function processItems(items, config, options) {
  const quality = new Map(config.sources.map((source) => [source.name, source.quality || 5]));
  const selectedItems = options.limit > 0 ? items.slice(0, options.limit) : items;
  const processed = [];
  let index = 0;
  for (const item of selectedItems) {
    index += 1;
    const discardReason = getDiscardReason(item);
    if (discardReason) {
      options.logger?.(`skip ${index}/${selectedItems.length}: ${item.sourceName} - ${item.title} (${discardReason})`);
      processed.push({ ...item, score: 0, rank: "discarded", discardReason });
      continue;
    }
    options.logger?.(`summarize ${index}/${selectedItems.length}: ${item.sourceName} - ${item.title}`);
    const summary = !options.refresh && item.summary ? item.summary : await summarizeItem(item, config, options);
    const scoreInput = {
      ...item,
      summary,
      content: [
        summary.whatHappened,
        summary.whyItMatters,
        summary.devImpact,
        summary.builderNotes
      ].join(" ")
    };
    const score = scoreItem(scoreInput, quality.get(item.sourceName) || 5);
    const rank = rankScore(score, item);
    processed.push({ ...item, summary, score, rank });
  }
  options.logger?.(`brief candidates: ${processed.filter((item) => item.rank !== "discarded").length}/${processed.length}`);
  return processed.sort((a, b) => (b.score || 0) - (a.score || 0));
}

function mergeProcessed(allItems, processed) {
  const processedById = new Map(processed.map((item) => [item.id, item]));
  return allItems.map((item) => processedById.get(item.id) || item);
}

function loadContext(argv) {
  const config = loadConfig();
  const state = loadState();
  const window = getBriefWindow(config, state, {
    since: readOption(argv, "--since"),
    until: readOption(argv, "--until")
  });
  return { config, state, window };
}

function readOption(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function selectSources(sources, argv) {
  const sourceName = readOption(argv, "--source");
  if (!sourceName) return sources;
  const selected = sources.filter((source) => source.name === sourceName);
  if (selected.length === 0) {
    throw new Error(`Source not found: ${sourceName}`);
  }
  return selected;
}

function filterItemsBySource(items, argv) {
  const sourceName = readOption(argv, "--source");
  if (!sourceName) return items;
  return items.filter((item) => item.sourceName === sourceName);
}

function reportErrors(errors) {
  for (const error of errors) {
    console.error(`Warning: ${error.source}: ${error.error}`);
  }
}

function createLogger(argv) {
  if (argv.includes("--quiet")) return undefined;
  return (message) => console.error(`[signalos] ${message}`);
}

function printHelp() {
  console.log(`SignalOS

Usage:
  signalos init [--force]
  signalos sources list
  signalos sources add <name> <url> [--type rss|youtube|podcast] [--quality 1-10]
  signalos sources add-youtube <name> <channelId|channelUrl|feedUrl> [--quality 1-10]
  signalos ingest [--source name] [--since ISO] [--until ISO] [--dry-run] [--quiet]
  signalos brief [--source name] [--since ISO] [--until ISO] [--offline] [--refresh] [--limit n] [--quiet]
  signalos run [--source name] [--since ISO] [--until ISO] [--dry-run] [--offline] [--refresh] [--limit n] [--quiet]
  signalos llm config
  signalos llm set [--provider name] [--base-url url] [--api-style chat_completions|responses] [--model id] [--api-key-env name]
  signalos llm test [--prompt text]
  signalos youtube transcript <videoId|url>
  signalos youtube feed-url <channelId|channelUrl|feedUrl>
  signalos media package <itemId> [--platform bilibili|xiaohongshu|douyin|wechat]
  signalos media rights <itemId> <rightsStatus>
`);
}
