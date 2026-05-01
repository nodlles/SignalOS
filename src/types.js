/**
 * @typedef {"rss" | "youtube" | "podcast" | "newsletter" | "github" | "hn"} SourceType
 * @typedef {"P0" | "P1" | "P2" | "discarded"} Rank
 * @typedef {"owned" | "licensed" | "permission_requested" | "permission_granted" | "commentary_fair_use_review" | "blocked"} RightsStatus
 *
 * @typedef {Object} SignalSource
 * @property {string} name
 * @property {SourceType} type
 * @property {string} url
 * @property {number} [quality]
 *
 * @typedef {Object} SignalSummary
 * @property {string} [chineseTitle]
 * @property {string} whatHappened
 * @property {string} whyItMatters
 * @property {string} devImpact
 * @property {string} builderNotes
 * @property {string} sourceLabel
 *
 * @typedef {Object} SignalItem
 * @property {string} id
 * @property {string} title
 * @property {string} url
 * @property {string} sourceName
 * @property {SourceType} sourceType
 * @property {string} publishedAt
 * @property {string} fetchedAt
 * @property {string} content
 * @property {string} [contentSource]
 * @property {string} [videoId]
 * @property {string} [transcript]
 * @property {string} [transcriptSource]
 * @property {SignalSummary} [summary]
 * @property {string} [contentHash]
 * @property {string} [summaryCacheKey]
 * @property {number} [summaryVersion]
 * @property {string} [summarizedAt]
 * @property {number} [score]
 * @property {Rank} [rank]
 * @property {RightsStatus} [rightsStatus]
 * @property {Array<Object>} [transformCandidates]
 */

export {};
