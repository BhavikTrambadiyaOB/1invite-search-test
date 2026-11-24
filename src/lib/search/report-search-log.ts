import { db } from '../db'
import { normalizeQuery } from './parse-query'
import type { SearchResponse } from './types'

/**
 * Report searches in the search log. A report capture (search_report: version and phase) runs the current search;
 * its numbers are logged like a search made on the search page, linked by report_id, so the failed-queries page
 * can judge a whole report run. No person saw these results, so only result reasons apply there (no click,
 * bounce and searching again are left out).
 */

export type SearchLogValues = {
  intent: SearchResponse['intent']
  resultCount: number
  exactCount: number
  matchCounts: { direct: number; partial: number; occasionOnly: number }
  topScore: number | null
}

/** The numbers the search page logs for a response (a "not understood" fallback list counts as zero results). */
export function searchLogValues(response: SearchResponse): SearchLogValues {
  if (response.total === 0 || response.fallback === 'not_understood') {
    return {
      intent: response.intent,
      resultCount: 0,
      exactCount: 0,
      matchCounts: { direct: 0, partial: 0, occasionOnly: 0 },
      topScore: null,
    }
  }
  return {
    intent: response.intent,
    resultCount: response.total,
    exactCount: response.exactTotal,
    matchCounts: response.matchCounts,
    topScore: response.results[0]?.debug.relevance ?? null,
  }
}

/** Logs (or replaces) the search of one report. `at` is when it ran (defaults to now). */
export async function logReportSearch(reportId: number | string, query: string, values: SearchLogValues, at = new Date()) {
  const normalized = normalizeQuery(query) || query.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 200)
  await db.query('delete from search_log where report_id = $1', [reportId])
  await db.query(
    `insert into search_log
       (session_id, query, normalized_query, intent, filters, page, result_count, exact_count,
        direct_count, partial_count, occasion_only_count, top_score, ignored, report_id, created_at)
     values ($1, $2, $3, $4, '{}', 1, $5, $6, $7, $8, $9, $10, '{}', $11, $12)`,
    [
      `report-${reportId}`, query.slice(0, 2000), normalized, JSON.stringify(values.intent), values.resultCount, values.exactCount,
      values.matchCounts.direct, values.matchCounts.partial, values.matchCounts.occasionOnly, values.topScore, reportId, at,
    ],
  )
}
