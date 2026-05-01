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

const youtubeItems = parseFeed(`<?xml version="1.0"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
  <entry>
    <yt:videoId>dQw4w9WgXcQ</yt:videoId>
    <title>Agent Demo</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"/>
    <published>2026-04-30T09:00:00+00:00</published>
    <media:group>
      <media:description>Demo of a production agent workflow.</media:description>
    </media:group>
  </entry>
</feed>`, { ...source, type: "youtube" });

assert.equal(youtubeItems.length, 1);
assert.equal(youtubeItems[0].videoId, "dQw4w9WgXcQ");
assert.equal(youtubeItems[0].sourceType, "youtube");
assert.match(youtubeItems[0].content, /production agent workflow/);

console.log("rss parser tests passed");
