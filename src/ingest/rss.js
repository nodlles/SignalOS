import crypto from "node:crypto";

export async function ingestRssSource(source, { since, until }) {
  const response = await fetch(source.url, {
    headers: {
      "user-agent": "SignalOS/0.1 (+https://localhost)"
    }
  });
  if (!response.ok) {
    throw new Error(`${source.name}: HTTP ${response.status}`);
  }
  const xml = await response.text();
  return parseFeed(xml, source).filter((item) => {
    const publishedAt = new Date(item.publishedAt);
    return publishedAt >= since && publishedAt < until;
  });
}

export function parseFeed(xml, source) {
  const entries = matchBlocks(xml, "item");
  const atomEntries = entries.length > 0 ? entries : matchBlocks(xml, "entry");
  const blocks = atomEntries.length > 0 ? atomEntries : matchBlocks(xml, "url");
  return blocks.map((entry) => {
    const link = cleanXml(readLink(entry) || readTag(entry, "loc"));
    const videoId = cleanXml(readTag(entry, "yt:videoId"));
    const title = cleanXml(readTag(entry, "title") || titleFromUrl(link) || "Untitled");
    const published = cleanXml(
        readTag(entry, "pubDate") ||
        readTag(entry, "published") ||
        readTag(entry, "updated") ||
        readTag(entry, "lastmod") ||
        new Date().toISOString()
    );
    const content = cleanXml(
      readTag(entry, "content:encoded") ||
        readTag(entry, "summary") ||
        readTag(entry, "media:description") ||
        readTag(entry, "description") ||
        titleFromUrl(link) ||
        title
    );
    const id = stableId(source.name, link || title, published);
    return {
      id,
      title,
      url: link,
      sourceName: source.name,
      sourceType: source.type,
      publishedAt: normalizeDate(published),
      fetchedAt: new Date().toISOString(),
      content,
      videoId: videoId || undefined,
      rightsStatus: source.type === "youtube" || source.type === "podcast" ? "commentary_fair_use_review" : undefined,
      transformCandidates: source.type === "youtube" || source.type === "podcast" ? [] : undefined
    };
  }).filter((item) => item.url);
}

function titleFromUrl(url) {
  if (!url) return "";
  const slug = url.split("/").filter(Boolean).pop() || "";
  return slug.replace(/[-_]/g, " ");
}

function matchBlocks(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map((match) => match[1]);
}

function readTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] || "";
}

function readLink(block) {
  const explicit = readTag(block, "link");
  if (explicit && !explicit.includes("<")) return explicit;
  const href = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return href?.[1] || explicit;
}

function cleanXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function stableId(...parts) {
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}
