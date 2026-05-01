import assert from "node:assert/strict";
import { parseFeed } from "../src/ingest/rss.js";

const source = {
  name: "Example",
  type: "rss",
  url: "https://example.com/feed.xml",
  quality: 8
};

const rssItems = parseFeed(`<?xml version="1.0"?>
<rss><channel><item>
  <title><![CDATA[Agent API Update]]></title>
  <link>https://example.com/agent-api</link>
  <pubDate>Thu, 30 Apr 2026 12:00:00 GMT</pubDate>
  <description><![CDATA[New API for agent workflows.]]></description>
</item></channel></rss>`, source);

assert.equal(rssItems.length, 1);
assert.equal(rssItems[0].title, "Agent API Update");
assert.equal(rssItems[0].url, "https://example.com/agent-api");
assert.equal(rssItems[0].publishedAt, "2026-04-30T12:00:00.000Z");
assert.match(rssItems[0].content, /agent workflows/);

const sitemapItems = parseFeed(`<?xml version="1.0"?>
<urlset>
  <url>
    <loc>https://example.com/news/claude-code-update</loc>
    <lastmod>2026-04-30T10:00:00.000Z</lastmod>
  </url>
</urlset>`, source);

assert.equal(sitemapItems.length, 1);
assert.equal(sitemapItems[0].url, "https://example.com/news/claude-code-update");
assert.equal(sitemapItems[0].publishedAt, "2026-04-30T10:00:00.000Z");
assert.match(sitemapItems[0].content, /claude code update/);

console.log("rss parser tests passed");
