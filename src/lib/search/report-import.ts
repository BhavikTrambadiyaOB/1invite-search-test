import { db } from '../db'
import { normalizeQuery } from './parse-query'
import { testCaseQuery, type ReportImportRow } from './report-csv'

export type ImportedQuery = {
  id: string
  query: string
  occasion: string
  lastRunAt: string | null
}

export type ReportVersion = {
  version: number
  sourceFile: string
  columns: string[]
  createdAt: string
  /** Sheet rows (test cases) in this version. */
  testCases: number
  /** Different searches among them, after cleaning: each is captured once per phase. */
  queries: number
  phases: Array<{ phase: number; reports: number }>
}

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

/** Every report version, newest first, with its size and captured phases. */
export async function listReportVersions(): Promise<ReportVersion[]> {
  const { rows } = await db.query(
    `select v.version, v.source_file, v.columns, v.created_at,
            (select count(*)::int from search_report_import i where i.version = v.version) as test_cases,
            (select count(distinct i.normalized_query)::int from search_report_import i where i.version = v.version) as queries,
            coalesce((
              select json_agg(json_build_object('phase', p.phase, 'reports', p.reports) order by p.phase)
                from (select phase, count(*)::int as reports from search_report r
                       where r.version = v.version group by phase) p
            ), '[]') as phases
       from search_report_version v
      order by v.version desc`,
  )
  return rows.map((row) => ({
    version: Number(row.version),
    sourceFile: String(row.source_file),
    columns: (row.columns as string[]) ?? [],
    createdAt: new Date(String(row.created_at)).toISOString(),
    testCases: Number(row.test_cases),
    queries: Number(row.queries),
    phases: row.phases as ReportVersion['phases'],
  }))
}

/**
 * Saves sheet rows into a report version, creating the version on first import. One row per test case:
 * the same query under two case types, or typed two ways ("Birthday" / "BIRTHDAY"), stays two rows.
 * Re-importing the same file into the same version updates notes and extras instead of adding rows.
 */
export async function importSearchReportQueries(
  queries: ReportImportRow[],
  { sourceFile, version, columns = [] }: { sourceFile: string; version: number; columns?: string[] },
) {
  type Row = {
    query: string
    normalized_query: string
    occasion: string
    case_type: string
    what_it_tests: string
    expected_result: string
    extra: Record<string, string>
  }
  const unique = new Map<string, Row>()
  for (const row of queries) {
    const query = testCaseQuery(row.query)
    if (!query.trim()) continue
    const occasion = clean(row.occasion ?? '')
    const caseType = clean(row.caseType ?? '')
    unique.set(`${occasion}\u0000${caseType}\u0000${query}`, {
      query,
      normalized_query: normalizeQuery(query) || clean(query).toLowerCase(),
      occasion,
      case_type: caseType,
      what_it_tests: clean(row.whatItTests ?? ''),
      expected_result: clean(row.expectedResult ?? ''),
      extra: row.extra ?? {},
    })
  }

  const rows = [...unique.values()]
  if (rows.length === 0) return { rows: 0, saved: 0, created: false }

  const client = await db.connect()
  try {
    await client.query('begin')
    const created = await client.query(
      `insert into search_report_version (version, source_file, columns) values ($1, $2, $3)
       on conflict (version) do nothing`,
      [version, sourceFile, columns],
    )
    const result = await client.query(
      `insert into search_report_import
         (version, query, normalized_query, occasion, case_type, what_it_tests, expected_result, extra, source_file)
       select $3, r.query, r.normalized_query, r.occasion, r.case_type, r.what_it_tests, r.expected_result, r.extra, $2
         from jsonb_to_recordset($1::jsonb) as r(
           query text, normalized_query text, occasion text, case_type text, what_it_tests text,
           expected_result text, extra jsonb
         )
       on conflict (version, case_type, occasion, query) do update set
         what_it_tests = excluded.what_it_tests,
         expected_result = excluded.expected_result,
         extra = excluded.extra,
         source_file = excluded.source_file`,
      [JSON.stringify(rows), sourceFile, version],
    )
    await client.query('commit')
    return { rows: rows.length, saved: result.rowCount ?? 0, created: (created.rowCount ?? 0) > 0 }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

/** Searches in a version with no report in any phase yet. */
export async function countPendingImportedQueries(version?: number): Promise<number> {
  const { rows } = await db.query<{ count: number }>(
    `select count(distinct i.normalized_query)::int as count
       from search_report_import i
      where ($1::int is null or i.version = $1)
        and not exists (
          select 1 from search_report r where r.version = i.version and r.normalized_query = i.normalized_query
        )`,
    [version ?? null],
  )
  return rows[0]?.count ?? 0
}

/**
 * Sheet rows of a version whose search has no complete report in that phase yet, in sheet order.
 * Rows sharing a search come back together and are captured once.
 */
export async function pendingQueriesForPhase(version: number, phase: number): Promise<ImportedQuery[]> {
  const { rows } = await db.query(
    `select i.id, i.query, i.occasion, i.last_run_at
       from search_report_import i
      where i.version = $1
        and not exists (
          select 1
            from search_report captured
           where captured.version = $1
             and captured.phase = $2
             and captured.normalized_query = i.normalized_query
             and captured.live_snapshot is not null
             and captured.current_snapshot is not null
             and captured.live_error is null
             and captured.current_error is null
        )
      order by i.id`,
    [version, phase],
  )
  return rows.map((row) => ({
    id: String(row.id),
    query: row.query,
    occasion: row.occasion,
    lastRunAt: row.last_run_at ? new Date(row.last_run_at).toISOString() : null,
  }))
}

export async function markImportedQueryRun(id: string, reportId: string) {
  await db.query(
    `update search_report_import
        set last_run_at = now(), last_report_id = $2::bigint
      where id = $1::bigint`,
    [id, reportId],
  )
}
