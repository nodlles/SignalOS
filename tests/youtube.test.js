import assert from "node:assert/strict";
import {
  chooseTranscriptTrack,
  extractYouTubeVideoId,
  normalizeYouTubeFeedUrl,
  parseTranscriptTrackList,
  parseTranscriptXml
} from "../src/ingest/youtube.js";

assert.equal(extractYouTubeVideoId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
assert.equal(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
assert.equal(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42"), "dQw4w9WgXcQ");
assert.equal(extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");

assert.equal(
  normalizeYouTubeFeedUrl("UC1234567890abcdefghi_j"),
  "https://www.youtube.com/feeds/videos.xml?channel_id=UC1234567890abcdefghi_j"
);
assert.equal(
  normalizeYouTubeFeedUrl("https://www.youtube.com/channel/UC1234567890abcdefghi_j"),
  "https://www.youtube.com/feeds/videos.xml?channel_id=UC1234567890abcdefghi_j"
);
assert.throws(
  () => normalizeYouTubeFeedUrl("https://www.youtube.com/@LennysPodcast"),
  /Handle URLs/
);

const tracks = parseTranscriptTrackList(`<transcript_list>
  <track id="0" name="" lang_code="en" lang_original="English" lang_translated="English" />
  <track id="1" name="中文" lang_code="zh-Hans" lang_original="中文" lang_translated="Chinese" />
</transcript_list>`);

assert.equal(tracks.length, 2);
assert.equal(chooseTranscriptTrack(tracks).langCode, "zh-Hans");
assert.equal(parseTranscriptXml(`<transcript><text start="0">Hello &amp; world</text><text start="1">Agent workflow</text></transcript>`), "Hello & world Agent workflow");

console.log("youtube tests passed");
