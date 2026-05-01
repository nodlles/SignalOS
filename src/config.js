import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = ".signalos";
export const CONFIG_PATH = path.join(DATA_DIR, "config.json");

export const DEFAULT_CONFIG = {
  dailyHour: 9,
  timezone: "Asia/Shanghai",
  language: "zh-CN",
  model: "glm-4.6",
  maxLookbackHours: 48,
  llm: {
    provider: "taishi",
    baseUrl: "https://relay.tuyoo.com/v1",
    apiStyle: "chat_completions",
    model: "glm-4.6",
    apiKeyEnv: "LLM_TOKEN",
    authScheme: "bearer",
    timeoutMs: 45000,
    maxTokens: 900
  },
  sources: [
    {
      name: "OpenAI Blog",
      type: "rss",
      url: "https://openai.com/news/rss.xml",
      quality: 10
    },
    {
      name: "Google DeepMind Blog",
      type: "rss",
      url: "https://deepmind.google/blog/rss.xml",
      quality: 9
    },
    {
      name: "Meta Newsroom",
      type: "rss",
      url: "https://about.fb.com/news/feed/",
      quality: 9
    },
    {
      name: "Latent Space",
      type: "rss",
      url: "https://www.latent.space/feed",
      quality: 9
    },
    {
      name: "Simon Willison",
      type: "rss",
      url: "https://simonwillison.net/atom/everything/",
      quality: 10
    },
    {
      name: "Hugging Face Blog",
      type: "rss",
      url: "https://huggingface.co/blog/feed.xml",
      quality: 10
    },
    {
      name: "One Useful Thing",
      type: "rss",
      url: "https://www.oneusefulthing.org/feed",
      quality: 9
    },
    {
      name: "Sebastian Raschka",
      type: "rss",
      url: "https://magazine.sebastianraschka.com/feed",
      quality: 9
    },
    {
      name: "Hacker News 200+",
      type: "rss",
      url: "https://hnrss.org/frontpage?points=200",
      quality: 9
    },
    {
      name: "vLLM Blog",
      type: "rss",
      url: "https://vllm.ai/blog/rss.xml",
      quality: 8
    },
    {
      name: "Together AI Blog",
      type: "rss",
      url: "https://www.together.ai/blog/rss.xml",
      quality: 8
    },
    {
      name: "GitHub Engineering",
      type: "rss",
      url: "https://github.blog/engineering.atom",
      quality: 8
    }
  ]
};

export function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function initConfig({ force = false } = {}) {
  ensureDataDir();
  if (fs.existsSync(CONFIG_PATH) && !force) {
    return { created: false, path: CONFIG_PATH };
  }
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
  return { created: true, path: CONFIG_PATH };
}

export function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    initConfig();
  }
  return normalizeConfig(JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")));
}

export function saveConfig(config) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
}

export function getBriefWindow(config, state, overrides = {}) {
  const until = overrides.until ? new Date(overrides.until) : getAnchoredUntil(config.dailyHour);
  let since = overrides.since
    ? new Date(overrides.since)
    : state.lastBriefAt
      ? new Date(state.lastBriefAt)
      : new Date(until.getTime() - 24 * 60 * 60 * 1000);

  if (!overrides.since && since >= until) {
    since = new Date(until.getTime() - 24 * 60 * 60 * 1000);
  }

  if (!overrides.since) {
    const maxLookbackMs = Math.max(1, Number(config.maxLookbackHours) || 48) * 60 * 60 * 1000;
    const earliest = new Date(until.getTime() - maxLookbackMs);
    if (since < earliest) {
      since = earliest;
    }
  }

  if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime())) {
    throw new Error("Invalid --since or --until timestamp.");
  }
  if (since >= until) {
    throw new Error("--since must be earlier than --until.");
  }
  return { since, until };
}

function getAnchoredUntil(hour) {
  const now = new Date();
  const anchor = new Date(now);
  anchor.setHours(hour, 0, 0, 0);
  if (now < anchor) {
    anchor.setDate(anchor.getDate() - 1);
  }
  return anchor;
}

function normalizeConfig(config) {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    llm: {
      ...DEFAULT_CONFIG.llm,
      ...(config.llm || {}),
      model: config.llm?.model || config.model || DEFAULT_CONFIG.llm.model
    },
    sources: config.sources || DEFAULT_CONFIG.sources
  };
}
