import { db } from '../db'
import { normalizeQuery } from './parse-query'
import type { OccasionQuery } from './report-csv'

export type ImportedQuery = {
  id: string
  query: string
  occasion: string
  lastRunAt: string | null
}

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

/** Saves CSV rows, keeping one row per normalized query and occasion. Re-importing updates the source file. */
export async function importSearchReportQueries(queries: OccasionQuery[], sourceFile: string) {
  const unique = new Map<string, { query: string; normalized_query: string; occasion: string }>()
  for (const row of queries) {
    const query = clean(row.query)
    if (!query) continue
    const occasion = clean(row.occasion)
    const normalizedQuery = normalizeQuery(query) || query.toLowerCase()
    unique.set(`${occasion}\u0000${normalizedQuery}`, { query, normalized_query: normalizedQuery, occasion })
  }

  const rows = [...unique.values()]
  if (rows.length === 0) return { rows: 0, saved: 0 }

  const result = await db.query(
    `insert into search_report_import (query, normalized_query, occasion, source_file)
     select r.query, r.normalized_query, r.occasion, $2
       from jsonb_to_recordset($1::jsonb) as r(query text, normalized_query text, occasion text)
     on conflict (normalized_query, occasion) do update set
       query = excluded.query,
       source_file = excluded.source_file`,
    [JSON.stringify(rows), sourceFile],
  )

  return { rows: rows.length, saved: result.rowCount ?? 0 }
}

export async function countPendingImportedQueries(): Promise<number> {
  const { rows } = await db.query<{ count: number }>(
    'select count(*)::int as count from search_report_import where last_run_at is null',
  )
  return rows[0]?.count ?? 0
}

export async function listPendingImportedQueries(limit?: number): Promise<ImportedQuery[]> {
  const { rows } = await db.query(
    `select id, query, occasion, last_run_at
       from search_report_import
      where last_run_at is null
      order by id
      ${limit ? 'limit $1' : ''}`,
    limit ? [limit] : [],
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
