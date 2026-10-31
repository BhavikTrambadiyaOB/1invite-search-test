import { db } from '../db'

/**
 * Failed-query detection.
 *
 * Searches are judged per visit: one session searching one query, including the tag taps, filters and pages
 * that refine it. A visit succeeds when the app records a template-use action within 30 minutes.
 * Otherwise it fails if any of these happen:
 *   zero_results       nothing matched
 *   no_exact_match     results are shown, but none fit the occasion and every asked detail
 *                      ("dinosaur wedding": wedding cards, no dinosaur weddings). Nearby results hide this gap.
 *   few_exact_matches  fewer than FAILURE_RULES.fewExactMatches fit it all
 *   low_relevance      the best match is weak (mostly free-text queries)
 *   reading_removed    the user removed part of how the query was read (the × on a "Showing" tag)
 *   reformulated       the user searched something else in the same session within 60 seconds
 *   bounce             the user previewed results but closed them quickly every time
 *   no_click           the user saw results and clicked nothing
 *
 * Queries are ranked by visits × failure rate and labelled:
 *   content_gap  the query was understood, but templates are missing or not good enough
 *   search_gap   the query was not understood (unknown words, or the user removed part of the reading)
 */
export const FAILURE_RULES = {
  lowRelevance: 0.4,
  /** Fewer exact matches than this is a thin result for what was asked. */
  fewExactMatches: 3,
  reformulateWithinSeconds: 60,
  /** A visit with no click is only judged after this long, so the user had time to act. */
  settleMinutes: 2,
  /** Searches of the same query in one session this close together are one visit. */
  visitMinutes: 30,
}

export type FailedQuery = {
  normalizedQuery: string
  exampleQuery: string
  /** Visits: sessions that searched this query. */
  searches: number
  failures: number
  failureRate: number
  priority: number
  reasons: Record<string, number>
  gapType: 'content_gap' | 'search_gap'
  avgResults: number
  /** Average results fitting every asked detail; null for searches logged before this was recorded. */
  avgExact: number | null
  /** Average relevance score of the best result per visit, from 0 to 1. */
  avgRelevance: number | null
  /** Average counts per visit; null for searches logged before match breakdowns were added. */
  avgDirect: number | null
  avgPartial: number | null
  avgOccasionOnly: number | null
  unknownWords: string[]
  exampleIntent: Record<string, unknown> | null
  lastSearchedAt: string
}

export async function getFailedQueries({ from, to, limit = 100 }: { from: Date; to: Date; limit?: number }) {
  const { rows } = await db.query(
    `with logs as (
       select l.*,
              -- A new visit starts when this session last searched the same query more than visitMinutes ago.
              case when lag(l.created_at) over w is null
                     or l.created_at - lag(l.created_at) over w > make_interval(mins => $7) then 1 else 0 end as starts_visit
         from search_log l
        where l.created_at >= $1 and l.created_at < $2 and l.normalized_query <> ''
       window w as (partition by l.session_id, l.normalized_query order by l.created_at)
     ),
     numbered as (
       select *, sum(starts_visit) over (partition by session_id, normalized_query order by created_at) as visit_no from logs
     ),
     visits as (
       select session_id, normalized_query, visit_no,
              min(created_at) as started_at, max(created_at) as ended_at,
              array_agg(id) as log_ids,
              -- The first, typed search (before tag taps and filters) shows what the query alone gives.
              (array_agg(query order by created_at))[1] as query,
              (array_agg(intent order by created_at))[1] as intent,
              (array_agg(result_count order by created_at))[1] as result_count,
              (array_agg(exact_count order by created_at))[1] as exact_count,
              (array_agg(direct_count order by created_at))[1] as direct_count,
              (array_agg(partial_count order by created_at))[1] as partial_count,
              (array_agg(occasion_only_count order by created_at))[1] as occasion_only_count,
              (array_agg(top_score order by created_at))[1] as top_score,
              bool_or(cardinality(ignored) > 0) as removed_reading
         from numbered
        group by session_id, normalized_query, visit_no
     ),
     acted as (
       select v.*,
              exists (select 1 from search_event e where e.search_id = any(v.log_ids) and e.type = 'open') as opened,
              (select count(*) from search_event e where e.search_id = any(v.log_ids) and e.type = 'click') as clicks,
              (select count(*) from search_event e where e.search_id = any(v.log_ids) and e.type = 'bounce') as bounces,
              exists (
                select 1 from search_log n
                 where n.session_id = v.session_id and n.normalized_query <> v.normalized_query
                   and n.created_at > v.started_at and n.created_at <= v.ended_at + make_interval(secs => $3)
              ) as reformulated
         from visits v
     ),
     judged as (
       select *,
              array_remove(array[
                case when result_count = 0 then 'zero_results' end,
                case when result_count > 0 and exact_count = 0 then 'no_exact_match' end,
                case when exact_count > 0 and exact_count < $8 then 'few_exact_matches' end,
                case when result_count > 0 and coalesce(top_score, 0) < $4 then 'low_relevance' end,
                case when removed_reading then 'reading_removed' end,
                case when reformulated then 'reformulated' end,
                case when clicks > 0 and bounces >= clicks then 'bounce' end,
                case when clicks = 0 and result_count > 0 and ended_at < now() - make_interval(mins => $5) then 'no_click' end
              ], null) as reasons
         from acted
     ),
     per_query as (
       select normalized_query,
              (array_agg(query order by started_at desc))[1] as example_query,
              (array_agg(intent order by started_at desc))[1] as example_intent,
              count(*)::int as searches,
              count(*) filter (where not opened and cardinality(reasons) > 0)::int as failures,
              avg(result_count)::real as avg_results,
              avg(exact_count)::real as avg_exact,
              avg(direct_count)::real as avg_direct,
              avg(partial_count)::real as avg_partial,
              avg(occasion_only_count)::real as avg_occasion_only,
              avg(top_score)::real as avg_relevance,
              bool_or(removed_reading and not opened) as removed_reading,
              max(ended_at) as last_searched_at
         from judged
        group by normalized_query
     ),
     reason_counts as (
       select normalized_query, jsonb_object_agg(r, c) as reasons from (
         select normalized_query, r, count(*) c from judged, unnest(reasons) r where not opened group by normalized_query, r
       ) x group by normalized_query
     )
     select p.*, coalesce(rc.reasons, '{}') as reasons,
            p.failures::real / p.searches as failure_rate, p.searches * (p.failures::real / p.searches) as priority
       from per_query p left join reason_counts rc using (normalized_query)
      where p.failures > 0
      order by priority desc, searches desc, last_searched_at desc
      limit $6`,
    [
      from, to, FAILURE_RULES.reformulateWithinSeconds, FAILURE_RULES.lowRelevance, FAILURE_RULES.settleMinutes, limit,
      FAILURE_RULES.visitMinutes, FAILURE_RULES.fewExactMatches,
    ],
  )

  // Words that appear in no template at all (typos, or wording we do not support yet).
  const keywords = [...new Set(rows.flatMap((r) => ((r.example_intent?.keywords ?? []) as string[])))]
  const unknown = new Set<string>()
  if (keywords.length > 0) {
    const res = await db.query<{ w: string }>(
      `select w from unnest($1::text[]) w
        where not exists (select 1 from template_search where search_vector @@ plainto_tsquery('english', search_unaccent(w)))`,
      [keywords],
    )
    for (const r of res.rows) unknown.add(r.w)
  }

  return rows.map((r): FailedQuery => {
    const intent = (r.example_intent ?? null) as Record<string, unknown> | null
    const words = ((intent?.keywords ?? []) as string[]).filter((w) => unknown.has(w))
    const has = (key: string) => ((intent?.[key] as unknown[] | undefined)?.length ?? 0) > 0
    // Understood: any part of the query was mapped to the vocabulary (occasion, age, element, style…).
    const understood =
      !!intent &&
      (!!intent.occasion || !!intent.milestone || !!intent.format || !!intent.docType || !!intent.language ||
        !!intent.hasPhoto || !!intent.gender ||
        ['themes', 'assets', 'styles', 'colors', 'moods', 'alsoOccasions'].some(has))
    return {
      normalizedQuery: r.normalized_query,
      exampleQuery: r.example_query,
      searches: r.searches,
      failures: r.failures,
      failureRate: Number(r.failure_rate.toFixed(3)),
      priority: Number(r.priority.toFixed(3)),
      reasons: r.reasons,
      gapType: understood && words.length === 0 && !r.removed_reading ? 'content_gap' : 'search_gap',
      avgResults: Number(r.avg_results),
      avgExact: r.avg_exact === null ? null : Number(r.avg_exact),
      avgRelevance: r.avg_relevance === null ? null : Number(r.avg_relevance),
      avgDirect: r.avg_direct === null ? null : Number(r.avg_direct),
      avgPartial: r.avg_partial === null ? null : Number(r.avg_partial),
      avgOccasionOnly: r.avg_occasion_only === null ? null : Number(r.avg_occasion_only),
      unknownWords: words,
      exampleIntent: intent,
      lastSearchedAt: new Date(r.last_searched_at).toISOString(),
    }
  })
}

/** Saves one day's report into failed_query_report (replacing an earlier run for that day). */
export async function saveDailyReport(day: Date) {
  const from = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()))
  const to = new Date(from.getTime() + 86_400_000)
  const report = await getFailedQueries({ from, to, limit: 1000 })
  const dayStr = from.toISOString().slice(0, 10)

  const client = await db.connect()
  try {
    await client.query('begin')
    await client.query('delete from failed_query_report where day = $1', [dayStr])
    if (report.length > 0) {
      await client.query(
        `insert into failed_query_report
           (day, normalized_query, searches, failures, failure_rate, priority, reasons, gap_type, example_intent)
         select $1, r.normalized_query, r.searches, r.failures, r.failure_rate, r.priority, r.reasons, r.gap_type, r.example_intent
           from jsonb_to_recordset($2::jsonb) as r(normalized_query text, searches int, failures int, failure_rate real,
                priority real, reasons jsonb, gap_type text, example_intent jsonb)`,
        [
          dayStr,
          JSON.stringify(
            report.map((q) => ({
              normalized_query: q.normalizedQuery,
              searches: q.searches,
              failures: q.failures,
              failure_rate: q.failureRate,
              priority: q.priority,
              reasons: { ...q.reasons, unknown_words: q.unknownWords },
              gap_type: q.gapType,
              example_intent: q.exampleIntent,
            })),
          ),
        ],
      )
    }
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
  return { day: dayStr, queries: report.length }
}
