import { ingestRssSource } from "./rss.js";
import { enrichThinItems } from "./page.js";
import { enrichYouTubeTranscripts } from "./youtube.js";

export async function ingestSources(sources, window, { logger } = {}) {
  const results = [];
  const errors = [];
  for (const source of sources) {
    try {
      if (["rss", "youtube", "podcast"].includes(source.type)) {
        logger?.(`fetch source: ${source.name}`);
        const items = await ingestRssSource(source, window);
        logger?.(`source ${source.name}: ${items.length} item(s) in window`);
        logger?.(`transcripts: ${source.name}`);
        const withTranscripts = await enrichYouTubeTranscripts(items);
        const needsPageText = withTranscripts.filter((item) => item.sourceType !== "youtube" || !item.transcript);
        logger?.(`page enrichment: ${source.name} (${needsPageText.length} item(s))`);
        const enriched = await enrichThinItems(needsPageText);
        const enrichedById = new Map(enriched.map((item) => [item.id, item]));
        results.push(...withTranscripts.map((item) => enrichedById.get(item.id) || item));
      } else {
        errors.push({ source: source.name, error: `Unsupported source type: ${source.type}` });
      }
    } catch (error) {
      errors.push({ source: source.name, error: error.message });
    }
  }
  return { items: results, errors };
}
