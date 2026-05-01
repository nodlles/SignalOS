export async function enrichThinItems(items, { minLength = 500, timeoutMs = 15000 } = {}) {
  const enriched = [];
  for (const item of items) {
    if ((item.content || "").length >= minLength || !/^https?:\/\//.test(item.url)) {
      enriched.push(item);
      continue;
    }
    try {
      const pageText = await fetchPageText(item.url, { timeoutMs });
      enriched.push(pageText.length > item.content.length ? { ...item, content: pageText, contentSource: "page" } : item);
    } catch {
      enriched.push(item);
    }
  }
  return enriched;
}

async function fetchPageText(url, { timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(url, {
    headers: {
      "user-agent": "SignalOS/0.1 (+https://localhost)",
      "accept": "text/html,application/xhtml+xml"
    },
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const html = await response.text();
  return extractReadableText(html);
}

export function extractReadableText(html) {
  const source = String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ");

  const candidates = [
    ...readJsonLdArticles(source),
    readMeta(source, "description"),
    readMeta(source, "og:description"),
    readSection(source, "article"),
    readSectionByClass(source, "main"),
    readSectionByClass(source, "content"),
    readSectionByClass(source, "post"),
    readSection(source, "main"),
    source
  ].filter(Boolean).map(cleanHtml);

  return candidates
    .sort((a, b) => scoreText(b) - scoreText(a))[0]
    ?.slice(0, 16000) || "";
}

function readJsonLdArticles(html) {
  const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const values = [];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(decodeHtml(block[1]).trim());
      collectJsonText(parsed, values);
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  }
  return values;
}

function collectJsonText(value, values) {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonText(item, values);
    return;
  }
  if (!value || typeof value !== "object") return;
  const type = Array.isArray(value["@type"]) ? value["@type"].join(" ") : String(value["@type"] || "");
  if (/Article|NewsArticle|BlogPosting/i.test(type)) {
    values.push([value.headline, value.description, value.articleBody].filter(Boolean).join("\n\n"));
  }
  for (const item of Object.values(value)) collectJsonText(item, values);
}

function readMeta(html, name) {
  const pattern = new RegExp(`<meta\\b[^>]*(?:name|property)=["']${escapeRegExp(name)}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i");
  return html.match(pattern)?.[1] || "";
}

function readSection(html, tag) {
  return html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "";
}

function readSectionByClass(html, token) {
  return html.match(new RegExp(`<[^>]+class=["'][^"']*${escapeRegExp(token)}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i"))?.[1] || "";
}

function cleanHtml(value) {
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function scoreText(text) {
  const lengthScore = Math.min(text.length, 10000);
  const sentenceScore = (text.match(/[.!?。！？]/g) || []).length * 80;
  return lengthScore + sentenceScore;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
