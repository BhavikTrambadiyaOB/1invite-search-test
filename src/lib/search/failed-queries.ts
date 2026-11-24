import { db } from '../db'
import { tagMatchCounts } from './failed-query-checks'

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
 * The exact-match reasons use the larger of two counts: search's own exact count, and the templates fitting every
 * understood tag (failed-query-checks.ts). Search's count also asks typed words already covered by a tag
 * ("toddler" = toddlers audience, "holy cow" = cow element) to be printed on the card; when only that wording is
 * missing, the visit gets the note wording_only instead of "no exact match". Notes never make a visit fail.
 *
 * Queries are ranked by visits × failure rate and labelled:
 *   search_gap   the query was not understood (unknown words, or the user removed part of the reading)
 *   not_chosen   understood, enough exact matches and a strong best match, yet the user did not pick one
 *                (failed only by no click, bounce or searching again): taste or order, not missing templates
 *   content_gap  understood, but templates are missing or not good enough
 *   no_gap       the search worked: no visit failed (only listed with includePassed)
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

/** no_gap: the search worked (listed only with includePassed). */
export type GapType = 'content_gap' | 'search_gap' | 'not_chosen' | 'no_gap'

/** Reasons that only say what the user did; results themselves were fine. */
const BEHAVIOR_REASONS = new Set(['no_click', 'bounce', 'reformulated'])

export type FailedQuery = {
  normalizedQuery: string
  exampleQuery: string
  /** Visits: sessions that searched this query. */
  searches: number
  failures: number
  failureRate: number
  priority: number
  reasons: Record<string, number>
  gapType: GapType
  /** Templates fitting every understood tag (typed words left out); null when not recounted. */
  tagExact: number | null
  /** Some visit missed exact matches only because typed words are not printed on the fitting cards. */
  wordingOnly: boolean
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
  /** The latest report run that searched it (search_report), null for searches made on the search page only. */
  report: { id: number; version: number; phase: number } | null
  /** Test-sheet case types of the query in the report versions searched ("Theme-Based Search"); empty when none. */
  caseTypes: string[]
}

/**
 * Which searches to judge: every one, only those made on the search page, one report run (version / phase), or the
 * search of one report (reportId, for the report page).
 */
export type FailedQuerySource = { live?: boolean; version?: number | null; phase?: number | null; reportId?: number | null }

/** A logs filter on search_log `l` for the source; $v, $p, $live and $report are the placeholders of its four values. */
function sourceSql(v: string, p: string, live: string, report: string) {
  return `(not ${live} or l.report_id is null)
    and (${report}::bigint is null or l.report_id = ${report})
    and ((${v}::int is null and ${p}::int is null) or exists (
      select 1 from search_report r
       where r.id = l.report_id and (${v}::int is null or r.version = ${v}) and (${p}::int is null or r.phase = ${p})))`
}

export async function getFailedQueries({
  from = new Date(0),
  to = new Date(Date.now() + 60_000),
  limit = 100,
  source = {},
  includePassed = false,
}: {
  from?: Date
  to?: Date
  limit?: number | null
  source?: FailedQuerySource
  /** Also list searches that worked (no failed visit), with the gap type no_gap: to check a whole report run. */
  includePassed?: boolean
} = {}) {
  const sourceValues = [source.version ?? null, source.phase ?? null, source.live === true, source.reportId ?? null]
  // Recount by understood tags the queries whose search found too few exact matches.
  const { rows: thin } = await db.query<{ normalized_query: string; intent: Record<string, unknown> | null }>(
    `select distinct on (normalized_query) normalized_query, intent
       from search_log l
      where created_at >= $1 and created_at < $2 and normalized_query <> ''
        and result_count > 0 and exact_count < $3 and ${sourceSql('$4', '$5', '$6', '$7')}
      order by normalized_query, created_at desc`,
    [from, to, FAILURE_RULES.fewExactMatches, ...sourceValues],
  )
  // Case types from the imported test sheets, through the report each logged search belongs to.
  const { rows: caseRows } = await db.query<{ normalized_query: string; case_types: string[] }>(
    `select l.normalized_query, array_agg(distinct i.case_type order by i.case_type) as case_types
       from search_log l
       join search_report rp on rp.id = l.report_id
       join search_report_import i on i.version = rp.version and i.normalized_query = rp.normalized_query and i.case_type <> ''
      where l.created_at >= $1 and l.created_at < $2 and ${sourceSql('$3', '$4', '$5', '$6')}
      group by l.normalized_query`,
    [from, to, ...sourceValues],
  )
  const caseTypesByQuery = new Map(caseRows.map((r) => [r.normalized_query, r.case_types]))
  const tagCounts = await tagMatchCounts(new Map(thin.map((r) => [r.normalized_query, r.intent])))
  const tagExactByQuery = Object.fromEntries([...tagCounts].filter(([, c]) => c !== null))

  const { rows } = await db.query(
    `with logs as (
       select l.*,
              -- A new visit starts when this session last searched the same query more than visitMinutes ago.
              case when lag(l.created_at) over w is null
                     or l.created_at - lag(l.created_at) over w > make_interval(mins => $7) then 1 else 0 end as starts_visit
         from search_log l
        where l.created_at >= $1 and l.created_at < $2 and l.normalized_query <> '' and ${sourceSql('$10', '$11', '$12', '$14')}
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
              bool_or(cardinality(ignored) > 0) as removed_reading,
              ($9::jsonb ->> normalized_query)::int as tag_exact,
              -- A report capture: nobody saw the results, so what the user did (click, bounce…) is not judged.
              max(report_id) as report_id
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
     counted as (
       -- Exact matches: search's count, or the understood-tag recount when that is higher.
       select *, greatest(exact_count, coalesce(tag_exact, exact_count)) as best_exact from acted
     ),
     judged as (
       select *,
              (exact_count < $8 and tag_exact > exact_count and result_count > 0) as wording_only,
              array_remove(array[
                case when result_count = 0 then 'zero_results' end,
                case when result_count > 0 and best_exact = 0 then 'no_exact_match' end,
                case when best_exact > 0 and best_exact < $8 then 'few_exact_matches' end,
                case when result_count > 0 and coalesce(top_score, 0) < $4 then 'low_relevance' end,
                case when removed_reading then 'reading_removed' end,
                case when reformulated then 'reformulated' end,
                case when clicks > 0 and bounces >= clicks then 'bounce' end,
                case when clicks = 0 and result_count > 0 and report_id is null and ended_at < now() - make_interval(mins => $5) then 'no_click' end
              ], null) as reasons
         from counted
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
              bool_or(wording_only and not opened) as wording_only,
              max(tag_exact) as tag_exact,
              (array_agg(report_id order by started_at desc) filter (where report_id is not null))[1] as report_id,
              max(ended_at) as last_searched_at
         from judged
        group by normalized_query
     ),
     reason_counts as (
       select normalized_query, jsonb_object_agg(r, c) as reasons from (
         select normalized_query, r, count(*) c from judged, unnest(reasons) r where not opened group by normalized_query, r
       ) x group by normalized_query
     )
     select p.*, coalesce(rc.reasons, '{}') as reasons, sr.version as report_version, sr.phase as report_phase,
            p.failures::real / p.searches as failure_rate, p.searches * (p.failures::real / p.searches) as priority
       from per_query p left join reason_counts rc using (normalized_query)
       left join search_report sr on sr.id = p.report_id
      where (p.failures > 0 or $13)
      order by priority desc, searches desc, last_searched_at desc
      limit $6`,
    [
      from, to, FAILURE_RULES.reformulateWithinSeconds, FAILURE_RULES.lowRelevance, FAILURE_RULES.settleMinutes, limit,
      FAILURE_RULES.visitMinutes, FAILURE_RULES.fewExactMatches, JSON.stringify(tagExactByQuery), ...sourceValues.slice(0, 3), includePassed, sourceValues[3],
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
    const reasons = r.reasons as Record<string, number>
    const searchGap = !understood || words.length > 0 || r.removed_reading
    const onlyBehavior = Object.keys(reasons).every((k) => BEHAVIOR_REASONS.has(k))
    const strongBest = r.avg_relevance !== null && Number(r.avg_relevance) >= FAILURE_RULES.lowRelevance
    const gapType: GapType = r.failures === 0
      ? 'no_gap'
      : searchGap ? 'search_gap' : onlyBehavior && strongBest ? 'not_chosen' : 'content_gap'
    return {
      normalizedQuery: r.normalized_query,
      exampleQuery: r.example_query,
      searches: r.searches,
      failures: r.failures,
      failureRate: Number(r.failure_rate.toFixed(3)),
      priority: Number(r.priority.toFixed(3)),
      reasons,
      gapType,
      tagExact: r.tag_exact === null || r.tag_exact === undefined ? null : Number(r.tag_exact),
      wordingOnly: r.wording_only === true,
      avgResults: Number(r.avg_results),
      avgExact: r.avg_exact === null ? null : Number(r.avg_exact),
      avgRelevance: r.avg_relevance === null ? null : Number(r.avg_relevance),
      avgDirect: r.avg_direct === null ? null : Number(r.avg_direct),
      avgPartial: r.avg_partial === null ? null : Number(r.avg_partial),
      avgOccasionOnly: r.avg_occasion_only === null ? null : Number(r.avg_occasion_only),
      unknownWords: words,
      exampleIntent: intent,
      lastSearchedAt: new Date(r.last_searched_at).toISOString(),
      report: r.report_id ? { id: Number(r.report_id), version: r.report_version, phase: r.report_phase } : null,
      caseTypes: caseTypesByQuery.get(r.normalized_query) ?? [],
    }
  })
}

/** The failed-query check of one report's logged search (passed or failed); null when it is not logged yet. */
export async function getReportFailedQuery(reportId: number) {
  const [row] = await getFailedQueries({ limit: 1, source: { reportId }, includePassed: true })
  return row ?? null
}

/** Saves one day's report into failed_query_report (replacing an earlier run for that day). */
export async function saveDailyReport(day: Date) {
  const from = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()))
  const to = new Date(from.getTime() + 86_400_000)
  const report = await getFailedQueries({ from, to, limit: 1000, source: { live: true } })
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

/** Case types of the imported test sheets (of one version, when given), for the failed-queries filter. */
export async function getReportCaseTypes(version: number | null) {
  const { rows } = await db.query<{ case_type: string }>(
    `select distinct case_type from search_report_import
      where case_type <> '' and ($1::int is null or version = $1) order by case_type`,
    [version],
  )
  return rows.map((r) => r.case_type)
}

/** Report runs whose searches are logged: each version with its phases, for the failed-queries filters. */
export async function getLoggedReportRuns() {
  const { rows } = await db.query<{ version: number; phases: number[] }>(
    `select r.version, array_agg(distinct r.phase order by r.phase) phases
       from search_log l join search_report r on r.id = l.report_id
      group by r.version order by r.version`,
  )
  return rows
}
