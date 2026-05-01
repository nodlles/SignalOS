export function extractYouTubeVideoId(value) {
  const input = String(value || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  try {
    const url = new URL(input);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }
    if (url.hostname.includes("youtube.com")) {
      if (url.searchParams.get("v")) return url.searchParams.get("v");
      const shorts = url.pathname.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
      if (shorts) return shorts[1];
      const embed = url.pathname.match(/\/embed\/([A-Za-z0-9_-]{11})/);
      if (embed) return embed[1];
    }
  } catch {
    return "";
  }
  return "";
}

export function normalizeYouTubeFeedUrl(value) {
  const input = String(value || "").trim();
  if (!input) throw new Error("Missing YouTube channel id or feed URL.");
  if (input.includes("youtube.com/feeds/videos.xml")) return input;
  if (/^UC[A-Za-z0-9_-]+$/.test(input)) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${input}`;
  }
  try {
    const url = new URL(input);
    const channel = url.pathname.match(/\/channel\/(UC[A-Za-z0-9_-]+)/);
    if (channel) return `https://www.youtube.com/feeds/videos.xml?channel_id=${channel[1]}`;
    if (url.hostname.includes("youtube.com") && /^\/@[^/]+/.test(url.pathname)) {
      throw new Error("YouTube handle URLs need network resolution. Use resolveYouTubeFeedUrl instead.");
    }
  } catch {
    // Fall through to the explicit error below.
  }
  throw new Error("Use a YouTube channel id, /channel/ URL, or feeds/videos.xml URL. Handle URLs like /@name are not resolvable without a lookup step yet.");
}

export async function resolveYouTubeFeedUrl(value, { timeoutMs = 15000 } = {}) {
  try {
    return normalizeYouTubeFeedUrl(value);
  } catch (error) {
    const input = String(value || "").trim();
    let url;
    try {
      url = new URL(input);
    } catch {
      throw error;
    }
    if (!url.hostname.includes("youtube.com") || !/^\/@[^/]+/.test(url.pathname)) {
      throw error;
    }
    return normalizeYouTubeFeedUrl(await fetchHandleChannelId(url.toString(), { timeoutMs }));
  }
}

async function fetchHandleChannelId(url, { timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(url, {
    headers: {
      "user-agent": "SignalOS/0.1 (+https://localhost)"
    },
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`YouTube handle lookup failed: HTTP ${response.status}`);
  const html = await response.text();
  const patterns = [
    /externalId\\?":\\?"(UC[^"\\]+)/,
    /browseId\\?":\\?"(UC[^"\\]+)/,
    /https:\/\/www\.youtube\.com\/channel\/(UC[^"\\]+)/
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  throw new Error("Could not resolve YouTube handle to channel id.");
}

export async function enrichYouTubeTranscripts(items, { timeoutMs = 15000 } = {}) {
  const enriched = [];
  for (const item of items) {
    if (item.sourceType !== "youtube") {
      enriched.push(item);
      continue;
    }
    const videoId = item.videoId || extractYouTubeVideoId(item.url);
    if (!videoId) {
      enriched.push(item);
      continue;
    }
    try {
      const transcript = await fetchYouTubeTranscript(videoId, { timeoutMs });
      enriched.push({
        ...item,
        videoId,
        transcript,
        transcriptSource: transcript ? "youtube-captions" : undefined,
        content: transcript ? [item.content, transcript].filter(Boolean).join("\n\n") : item.content
      });
    } catch {
      enriched.push({ ...item, videoId });
    }
  }
  return enriched;
}

export async function fetchYouTubeTranscript(videoIdOrUrl, { preferredLanguages = ["zh-Hans", "zh-CN", "zh", "en"], timeoutMs = 15000 } = {}) {
  const videoId = extractYouTubeVideoId(videoIdOrUrl);
  if (!videoId) throw new Error("Invalid YouTube video id or URL.");

  const tracksXml = await fetchText(`https://video.google.com/timedtext?type=list&v=${encodeURIComponent(videoId)}`, { timeoutMs });
  const tracks = parseTranscriptTrackList(tracksXml);
  if (tracks.length === 0) return "";

  const track = chooseTranscriptTrack(tracks, preferredLanguages);
  const params = new URLSearchParams({
    v: videoId,
    lang: track.langCode
  });
  if (track.name) params.set("name", track.name);
  const transcriptXml = await fetchText(`https://video.google.com/timedtext?${params.toString()}`, { timeoutMs });
  return parseTranscriptXml(transcriptXml);
}

export function parseTranscriptTrackList(xml) {
  return [...String(xml || "").matchAll(/<track\b([^>]*)\/?>/gi)].map((match) => {
    const attrs = parseAttrs(match[1]);
    return {
      langCode: attrs.lang_code || "",
      langOriginal: attrs.lang_original || "",
      langTranslated: attrs.lang_translated || "",
      name: attrs.name || "",
      kind: attrs.kind || ""
    };
  }).filter((track) => track.langCode);
}

export function chooseTranscriptTrack(tracks, preferredLanguages = ["zh-Hans", "zh-CN", "zh", "en"]) {
  for (const language of preferredLanguages) {
    const exact = tracks.find((track) => track.langCode.toLowerCase() === language.toLowerCase());
    if (exact) return exact;
    const prefix = tracks.find((track) => track.langCode.toLowerCase().startsWith(`${language.toLowerCase()}-`));
    if (prefix) return prefix;
  }
  return tracks.find((track) => track.kind !== "asr") || tracks[0];
}

export function parseTranscriptXml(xml) {
  return [...String(xml || "").matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)]
    .map((match) => decodeXml(match[1]).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 24000);
}

async function fetchText(url, { timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(url, {
    headers: {
      "user-agent": "SignalOS/0.1 (+https://localhost)"
    },
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function parseAttrs(value) {
  const attrs = {};
  for (const match of String(value || "").matchAll(/([\w:-]+)=["']([^"']*)["']/g)) {
    attrs[match[1]] = decodeXml(match[2]);
  }
  return attrs;
}

function decodeXml(value) {
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
