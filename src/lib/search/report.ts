import { db } from '../db'
import { normalizeQuery } from './parse-query'
import { searchTemplates } from './search-templates'
import type {
  ReportDetail,
  ReportFeedback,
  ReportItem,
  ReportResult,
  ReportRow,
  ReportSnapshot,
  ReportSuggestedTag,
} from './report-types'

/** The report always compares the first 40 results. */
export const REPORT_LIMIT = 40
/** The live API is asked for more than we show, so its own ordering still decides the first 40. */
const LIVE_REQUEST_COUNT = 60

const DEFAULT_LIVE_SEARCH_URL = 'https://mapi.1invites.com/api/public/api/searchCardsByMultipleSubCategoryId'
const DEFAULT_LIVE_SUGGESTIONS_URL = 'https://mapi.1invites.com/api/public/api/getSuggestedExtensionsFromUserInput'

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asString = (value: unknown) => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '')
const asNumber = (value: unknown) => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(n) ? n : null
}
const asBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1' || value === 'true') return true
  if (value === 0 || value === '0' || value === 'false') return false
  return null
}
const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.map(asString).map((v) => v.trim()).filter(Boolean) : []

function pick(record: JsonRecord, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function getPath(value: unknown, path: string[]): unknown {
  let current = value
  for (const key of path) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return current
}

function isItemArray(value: unknown): value is JsonRecord[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => isRecord(item)) &&
    value.some((item) => !!pick(item, ['sample_image', 'preview_url', 'previewUrl', 'image', 'thumbnail', 'template_name', 'name']))
  )
}

/** Finds the result array in the live response, which has changed shape between API versions. */
function findLiveItems(payload: unknown): JsonRecord[] {
  const known = [
    ['data', 'json_data', 'result'],
    ['data', 'json_data', 'results'],
    ['data', 'result'],
    ['data', 'results'],
    ['data', 'json_data', 'cards'],
    ['data', 'cards'],
    ['data', 'items'],
    ['result'],
    ['results'],
    ['cards'],
  ]
  for (const path of known) {
    const value = getPath(payload, path)
    if (isItemArray(value)) return value
  }

  // Last resort: the first array of template-like objects anywhere in the response.
  const queue: Array<{ value: unknown; depth: number }> = [{ value: payload, depth: 0 }]
  while (queue.length > 0) {
    const next = queue.shift()!
    if (next.depth > 4) continue
    if (isItemArray(next.value)) return next.value
    if (Array.isArray(next.value)) {
      for (const value of next.value) queue.push({ value, depth: next.depth + 1 })
    } else if (isRecord(next.value)) {
      for (const value of Object.values(next.value)) queue.push({ value, depth: next.depth + 1 })
    }
  }
  return []
}

function liveTotal(payload: unknown, shown: number): number | null {
  for (const path of [
    ['data', 'json_data', 'total_count'],
    ['data', 'json_data', 'total'],
    ['data', 'total_count'],
    ['data', 'total'],
    ['total_count'],
    ['total'],
  ]) {
    const total = asNumber(getPath(payload, path))
    if (total !== null) return total
  }
  return shown
}

function imageUrl(value: unknown): string {
  const url = asString(value).trim()
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('/')) return `https://1invites.com${url}`
  return url
}

function liveItem(item: JsonRecord, index: number): ReportItem | null {
  const previewUrl = imageUrl(
    pick(item, ['sample_image', 'preview_url', 'previewUrl', 'image', 'thumbnail', 'card_image', 'sample_image_url']),
  )
  const id = asString(pick(item, ['json_id', 'id', 'template_id', 'card_id', 'templateId'])) || String(index + 1)
  const name = asString(pick(item, ['template_name', 'name', 'card_name', 'title'])) || `Template ${id}`
  const width = asNumber(pick(item, ['width', 'image_width']))
  const height = asNumber(pick(item, ['height', 'image_height']))
  const portraitValue = pick(item, ['is_portrait', 'isPortrait', 'orientation'])
  const isPortrait =
    typeof portraitValue === 'string'
      ? portraitValue === 'portrait'
        ? true
        : portraitValue === 'landscape'
          ? false
          : null
      : asBoolean(portraitValue)
  if (!previewUrl) return null
  return {
    id,
    name,
    previewUrl,
    width: width && width > 0 ? width : null,
    height: height && height > 0 ? height : null,
    isFree: asBoolean(pick(item, ['is_free', 'isFree', 'free'])),
    isPortrait,
    hasPhoto: asBoolean(pick(item, ['has_photo', 'hasPhoto', 'photo'])),
    occasionLabel: asString(pick(item, ['occasion_name', 'occasion_label', 'occasion', 'category_name'])) || null,
    themes: asStringArray(pick(item, ['themes', 'theme', 'tags'])),
    milestone: asNumber(pick(item, ['milestone', 'age'])),
  }
}

function liveSuggestedTag(value: unknown): ReportSuggestedTag | null {
  if (typeof value === 'string') {
    const label = value.trim()
    return label ? { group: null, value: label, label, count: null } : null
  }
  if (!isRecord(value)) return null

  const label = asString(
    pick(value, ['label', 'name', 'title', 'extension', 'extension_name', 'suggestion', 'text', 'keyword', 'tag_name', 'tag', 'value']),
  ).trim()
  const id = asString(pick(value, ['value', 'id', 'key', 'slug'])).trim()
  const display = label || id
  if (!display) return null
  return {
    group: asString(pick(value, ['group', 'type', 'category', 'extension_type'])).trim() || null,
    value: id || display,
    label: display,
    count: asNumber(pick(value, ['count', 'total', 'result_count'])),
  }
}

function uniqueSuggestedTags(tags: ReportSuggestedTag[]): ReportSuggestedTag[] {
  const seen = new Set<string>()
  return tags.filter((tag) => {
    const normalized = `${tag.group ?? ''}:${tag.value}`.toLowerCase()
    if (seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

function responseShape(value: unknown, depth = 0): string {
  if (Array.isArray(value)) return `array(${value.length})`
  if (!isRecord(value)) return value === null ? 'null' : typeof value
  if (depth >= 2) return 'object'
  const fields = Object.entries(value)
    .slice(0, 8)
    .map(([key, child]) => `${key}: ${responseShape(child, depth + 1)}`)
  return `{${fields.join(', ')}}`
}

function findLiveSuggestedTags(payload: unknown): ReportSuggestedTag[] | null {
  const queue: Array<{ value: unknown; key: string; depth: number }> = [{ value: payload, key: '', depth: 0 }]
  while (queue.length) {
    const { value, key, depth } = queue.shift()!
    if (depth > 5) continue

    if (Array.isArray(value)) {
      const tags = value.map(liveSuggestedTag).filter((tag): tag is ReportSuggestedTag => tag !== null)
      const recognizedKey = /suggest|extension|tag/i.test(key)
      if ((recognizedKey || depth === 0) && value.length === 0) return []
      if (tags.length > 0 && (recognizedKey || tags.length === value.length)) return uniqueSuggestedTags(tags)
      for (const item of value) queue.push({ value: item, key: '', depth: depth + 1 })
      continue
    }

    if (!isRecord(value)) continue
    for (const [childKey, child] of Object.entries(value)) {
      if (/suggest|extension|tag/i.test(childKey)) {
        if (Array.isArray(child)) {
          const tags = child.map(liveSuggestedTag).filter((tag): tag is ReportSuggestedTag => tag !== null)
          if (child.length === 0) return []
          if (tags.length > 0) return uniqueSuggestedTags(tags)
        } else {
          const tag = liveSuggestedTag(child)
          if (tag) return [tag]
        }
      }
      queue.push({ value: child, key: childKey, depth: depth + 1 })
    }
  }
  return null
}

async function captureLiveSuggestedTags(query: string, authorization: string) {
  try {
    const response = await fetch(process.env.LIVE_SUGGESTED_EXTENSIONS_URL?.trim() || DEFAULT_LIVE_SUGGESTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authorization },
      body: JSON.stringify({
        is_cache_enable: 1,
        search: query,
        sub_category_id: process.env.LIVE_SEARCH_SUB_CATEGORY_ID?.trim() || '169',
      }),
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    })
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const message = isRecord(payload) ? asString(payload.message) : ''
      throw new Error(message || `Live suggested-tags API failed with HTTP ${response.status}`)
    }
    if (isRecord(payload) && payload.code !== undefined && ![200, 427].includes(Number(payload.code))) {
      throw new Error(asString(payload.message) || `Live suggested-tags API returned code ${String(payload.code)}`)
    }

    const suggestedTags = findLiveSuggestedTags(payload)
    if (suggestedTags === null) {
      throw new Error(`Live suggested-tags API returned an unrecognized response shape: ${responseShape(payload)}`)
    }
    return { suggestedTags, error: null }
  } catch (error) {
    return {
      suggestedTags: [] as ReportSuggestedTag[],
      error: error instanceof Error ? error.message : 'Live suggested-tags API failed',
    }
  }
}

function currentItem(item: Awaited<ReturnType<typeof searchTemplates>>['results'][number]): ReportItem {
  const portrait = item.isPortrait !== false
  return {
    id: String(item.id),
    name: item.name,
    previewUrl: item.previewUrl,
    width: portrait ? 5 : 4,
    height: portrait ? 7 : 3,
    isFree: item.isFree,
    isPortrait: item.isPortrait,
    hasPhoto: item.hasPhoto,
    occasionLabel: item.occasionLabel,
    themes: item.themes,
    milestone: item.milestone,
  }
}

export type ReportCapture = {
  snapshot: ReportSnapshot | null
  error: string | null
}

/** Calls the live production search API and captures its first 40 results. */
export async function captureLiveReport(query: string): Promise<ReportCapture> {
  const token = process.env.LIVE_SEARCH_TOKEN?.trim()
  if (!token) {
    return { snapshot: null, error: 'LIVE_SEARCH_TOKEN is not set in .env' }
  }

  const url = process.env.LIVE_SEARCH_URL?.trim() || DEFAULT_LIVE_SEARCH_URL
  const authorization = token.toLowerCase().startsWith('bearer ') ? token : `Bearer ${token}`
  const suggestedTagsPromise = captureLiveSuggestedTags(query, authorization)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authorization },
      body: JSON.stringify({
        page: 1,
        item_count: LIVE_REQUEST_COUNT,
        last_sync_time: '0',
        is_cache_enable: 1,
        sub_category_id: process.env.LIVE_SEARCH_SUB_CATEGORY_ID?.trim() || '169',
        platform: asNumber(process.env.LIVE_SEARCH_PLATFORM) ?? 2,
        country_code: process.env.LIVE_SEARCH_COUNTRY_CODE?.trim() || 'in',
        search_category: query,
      }),
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    })
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const message = isRecord(payload) ? asString(payload.message) : ''
      throw new Error(message || `Live search failed with HTTP ${response.status}`)
    }
    if (isRecord(payload) && payload.code !== undefined && ![200, 427].includes(Number(payload.code))) {
      throw new Error(asString(payload.message) || `Live search returned code ${String(payload.code)}`)
    }

    const { suggestedTags, error: suggestionsError } = await suggestedTagsPromise
    const allResults = findLiveItems(payload)
      .map(liveItem)
      .filter((item): item is ReportItem => item !== null)
    const results = allResults.slice(0, REPORT_LIMIT)

    return {
      snapshot: {
        source: 'live',
        capturedAt: new Date().toISOString(),
        total: liveTotal(payload, allResults.length),
        results,
        suggestedTags,
        suggestionsError,
      },
      error: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Live search failed'
    const suggestions = await suggestedTagsPromise
    if (suggestions.error) {
      return { snapshot: null, error: `${message}; ${suggestions.error}` }
    }
    return {
      snapshot: {
        source: 'live',
        capturedAt: new Date().toISOString(),
        total: null,
        results: [],
        suggestedTags: suggestions.suggestedTags,
      },
      error: message,
    }
  }
}

/** Runs the current search twice (24 results per page) and captures the first 40. */
export async function captureCurrentReport(query: string): Promise<ReportCapture> {
  try {
    const first = await searchTemplates({ query, page: 1 })
    let results = first.results
    if (results.length < REPORT_LIMIT && first.total > results.length) {
      const second = await searchTemplates({ query, page: 2 })
      results = [...results, ...second.results]
    }

    const seen = new Set<number>()
    const items = results
      .filter((item) => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
      })
      .slice(0, REPORT_LIMIT)
      .map(currentItem)

    return {
      snapshot: {
        source: 'current',
        capturedAt: new Date().toISOString(),
        total: first.total,
        results: items,
        suggestedTags: first.suggestedTags.map((tag) => ({
          group: tag.group,
          value: tag.value,
          label: tag.label,
          count: tag.count,
        })),
      },
      error: null,
    }
  } catch (error) {
    return { snapshot: null, error: error instanceof Error ? error.message : 'Current search failed' }
  }
}

/** Stores (or replaces) one query's live and current snapshots. */
export async function saveSearchReport(
  query: string,
  live: ReportCapture,
  current: ReportCapture,
  phase?: number,
) {
  const normalized = normalizeQuery(query) || query.trim().toLowerCase()
  const { rows } = await db.query<{ id: string }>(
    `insert into search_report
       (query, normalized_query, phase, live_snapshot, current_snapshot, live_error, current_error,
        live_total, current_total, live_count, current_count, updated_at)
     values ($1, $2, coalesce($3::integer, 1), $4, $5, $6, $7, $8, $9, $10, $11, now())
     on conflict (normalized_query, phase) do update set
       query = excluded.query,
       live_snapshot = excluded.live_snapshot,
       current_snapshot = excluded.current_snapshot,
       live_error = excluded.live_error,
       current_error = excluded.current_error,
       live_total = excluded.live_total,
       current_total = excluded.current_total,
       live_count = excluded.live_count,
       current_count = excluded.current_count,
       updated_at = now()
     returning id`,
    [
      query.trim(),
      normalized,
      phase ?? null,
      live.snapshot ? JSON.stringify(live.snapshot) : null,
      current.snapshot ? JSON.stringify(current.snapshot) : null,
      live.error,
      current.error,
      live.snapshot?.total ?? null,
      current.snapshot?.total ?? null,
      live.snapshot?.results.length ?? 0,
      current.snapshot?.results.length ?? 0,
    ],
  )
  return rows[0].id
}

function parseSnapshot(value: unknown, source: ReportSnapshot['source']): ReportSnapshot | null {
  if (!isRecord(value) || !Array.isArray(value.results)) return null
  const results = value.results
    .filter(isRecord)
    .map((item): ReportItem | null => {
      const id = asString(item.id)
      const previewUrl = asString(item.previewUrl)
      if (!id || !previewUrl) return null
      return {
        id,
        name: asString(item.name) || `Template ${id}`,
        previewUrl,
        width: asNumber(item.width),
        height: asNumber(item.height),
        isFree: typeof item.isFree === 'boolean' ? item.isFree : null,
        isPortrait: typeof item.isPortrait === 'boolean' ? item.isPortrait : null,
        hasPhoto: typeof item.hasPhoto === 'boolean' ? item.hasPhoto : null,
        occasionLabel: asString(item.occasionLabel) || null,
        themes: asStringArray(item.themes),
        milestone: asNumber(item.milestone),
      }
    })
    .filter((item): item is ReportItem => item !== null)
    .slice(0, REPORT_LIMIT)
  const suggestedTags = Array.isArray(value.suggestedTags)
    ? value.suggestedTags
        .filter(isRecord)
        .map((item): ReportSuggestedTag | null => {
          const label = asString(item.label).trim()
          if (!label) return null
          return {
            group: asString(item.group).trim() || null,
            value: asString(item.value).trim() || label,
            label,
            count: asNumber(item.count),
          }
        })
        .filter((tag): tag is ReportSuggestedTag => tag !== null)
    : undefined
  return {
    source,
    capturedAt: asString(value.capturedAt),
    total: asNumber(value.total),
    results,
    ...(suggestedTags ? { suggestedTags } : {}),
    suggestionsError: asString(value.suggestionsError) || null,
  }
}

function parseFeedback(row: JsonRecord): ReportFeedback | null {
  const result = (value: unknown): ReportResult | null =>
    isReportResultValue(value) ? value : null
  const hasFeedback =
    row.live_result !== null ||
    row.current_result !== null ||
    row.live_freshness_issue !== null ||
    row.current_freshness_issue !== null ||
    !!row.live_reason ||
    !!row.current_reason
  if (!hasFeedback) return null
  return {
    liveResult: result(row.live_result),
    liveFreshnessIssue: typeof row.live_freshness_issue === 'boolean' ? row.live_freshness_issue : null,
    liveReason: asString(row.live_reason),
    currentResult: result(row.current_result),
    currentFreshnessIssue: typeof row.current_freshness_issue === 'boolean' ? row.current_freshness_issue : null,
    currentReason: asString(row.current_reason),
    updatedAt: row.feedback_updated_at ? new Date(String(row.feedback_updated_at)).toISOString() : null,
  }
}

function isReportResultValue(value: unknown): value is ReportResult {
  return value === 'success' || value === 'partial' || value === 'failed'
}

function mapRow(row: JsonRecord): ReportRow {
  return {
    id: String(row.id),
    query: asString(row.query),
    phase: asNumber(row.phase) ?? 1,
    liveTotal: asNumber(row.live_total),
    currentTotal: asNumber(row.current_total),
    liveCount: asNumber(row.live_count) ?? 0,
    currentCount: asNumber(row.current_count) ?? 0,
    liveError: row.live_error ? asString(row.live_error) : null,
    currentError: row.current_error ? asString(row.current_error) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    feedback: parseFeedback(row),
  }
}

const ROW_COLUMNS = `r.id, r.query, r.phase, r.live_total, r.current_total, r.live_count, r.current_count,
  r.live_error, r.current_error, r.created_at, r.updated_at,
  f.live_result, f.live_freshness_issue, f.live_reason,
  f.current_result, f.current_freshness_issue, f.current_reason, f.updated_at as feedback_updated_at`

/** Reports per page in the report table. */
export const REPORT_PAGE_SIZE = 20

export type SearchReportPage = {
  reports: ReportRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type ReportFeedbackFilter = 'unreviewed' | 'incomplete' | 'complete'
export type ReportErrorFilter = 'any' | 'live' | 'current'

export type SearchReportFilters = {
  query?: string
  phase?: number
  occasion?: string
  feedback?: ReportFeedbackFilter
  error?: ReportErrorFilter
}

export type SearchReportFilterOptions = {
  phases: Array<{ phase: number; count: number }>
  occasions: string[]
}

export async function getSearchReportFilterOptions(): Promise<SearchReportFilterOptions> {
  const [phaseRows, occasionRows] = await Promise.all([
    db.query<{ phase: number; count: number }>(
      'select phase, count(*)::int as count from search_report group by phase order by phase',
    ),
    db.query<{ occasion: string }>(
      `select distinct occasion
         from search_report_import
        where occasion <> ''
        order by occasion`,
    ),
  ])
  return { phases: phaseRows.rows, occasions: occasionRows.rows.map((row) => row.occasion) }
}

function reportWhere(filters: SearchReportFilters) {
  const conditions: string[] = []
  const values: unknown[] = []
  const add = (condition: (parameter: string) => string, value: unknown) => {
    values.push(value)
    conditions.push(condition(`$${values.length}`))
  }

  if (filters.query) add((parameter) => `r.query ilike ${parameter}`, `%${filters.query}%`)
  if (filters.phase !== undefined) add((parameter) => `r.phase = ${parameter}`, filters.phase)
  if (filters.occasion) {
    add(
      (parameter) => `exists (
        select 1
          from search_report_import i
          where (
            i.normalized_query = r.normalized_query or
            lower(regexp_replace(trim(i.query), '[[:space:]]+', ' ', 'g')) =
              lower(regexp_replace(trim(r.query), '[[:space:]]+', ' ', 'g'))
          )
            and i.occasion = ${parameter}
      )`,
      filters.occasion,
    )
  }
  if (filters.feedback === 'unreviewed') {
    conditions.push('f.report_id is null')
  } else if (filters.feedback === 'incomplete') {
    conditions.push(
      `f.report_id is not null and (
        f.live_result is null or f.live_freshness_issue is null or
        f.current_result is null or f.current_freshness_issue is null
      )`,
    )
  } else if (filters.feedback === 'complete') {
    conditions.push(
      `f.live_result is not null and f.live_freshness_issue is not null and
       f.current_result is not null and f.current_freshness_issue is not null`,
    )
  }
  if (filters.error === 'any') {
    conditions.push('(r.live_error is not null or r.current_error is not null)')
  } else if (filters.error === 'live') {
    conditions.push('r.live_error is not null')
  } else if (filters.error === 'current') {
    conditions.push('r.current_error is not null')
  }

  return {
    sql: conditions.length > 0 ? `where ${conditions.join(' and ')}` : '',
    values,
  }
}

/**
 * One page of stored reports, newest feedback first. The requested page is clamped to the
 * last page so an out-of-range URL still shows rows instead of an empty table.
 */
export async function listSearchReports({
  page = 1,
  pageSize = REPORT_PAGE_SIZE,
  filters = {},
}: {
  page?: number
  pageSize?: number
  filters?: SearchReportFilters
} = {}): Promise<SearchReportPage> {
  const size = Math.min(Math.max(Math.trunc(pageSize) || REPORT_PAGE_SIZE, 1), 100)
  const where = reportWhere(filters)
  const { rows: countRows } = await db.query<{ count: number }>(
    `select count(*)::int as count
       from search_report r
       left join search_report_feedback f on f.report_id = r.id
       ${where.sql}`,
    where.values,
  )
  const total = countRows[0]?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / size))
  const current = Math.min(Math.max(Math.trunc(page) || 1, 1), totalPages)

  const { rows } = await db.query(
    `select ${ROW_COLUMNS}
       from search_report r
       left join search_report_feedback f on f.report_id = r.id
       ${where.sql}
      order by coalesce(f.updated_at, r.updated_at) desc, r.id desc
      limit $${where.values.length + 1} offset $${where.values.length + 2}`,
    [...where.values, size, (current - 1) * size],
  )
  return { reports: rows.map(mapRow), total, page: current, pageSize: size, totalPages }
}

export async function getSearchReport(id: string): Promise<ReportDetail | null> {
  if (!/^\d+$/.test(id)) return null
  const { rows } = await db.query(
    `select ${ROW_COLUMNS}, r.live_snapshot, r.current_snapshot
       from search_report r
       left join search_report_feedback f on f.report_id = r.id
      where r.id = $1::bigint`,
    [id],
  )
  const row = rows[0]
  if (!row) return null
  return {
    ...mapRow(row),
    liveSnapshot: parseSnapshot(row.live_snapshot, 'live'),
    currentSnapshot: parseSnapshot(row.current_snapshot, 'current'),
  }
}

export type ReportFeedbackInput = {
  reportId: string
  liveResult: ReportResult
  liveFreshnessIssue: boolean
  liveReason: string
  currentResult: ReportResult
  currentFreshnessIssue: boolean
  currentReason: string
}

/** Saves the six feedback answers, replacing the previous ones for this report. */
export async function saveReportFeedback(input: ReportFeedbackInput) {
  const result = await db.query(
    `insert into search_report_feedback
       (report_id, live_result, live_freshness_issue, live_reason,
        current_result, current_freshness_issue, current_reason, updated_at)
     select $1::bigint, $2, $3, $4, $5, $6, $7, now()
      where exists (select 1 from search_report where id = $1::bigint)
     on conflict (report_id) do update set
       live_result = excluded.live_result,
       live_freshness_issue = excluded.live_freshness_issue,
       live_reason = excluded.live_reason,
       current_result = excluded.current_result,
       current_freshness_issue = excluded.current_freshness_issue,
       current_reason = excluded.current_reason,
       updated_at = now()`,
    [
      input.reportId,
      input.liveResult,
      input.liveFreshnessIssue,
      input.liveReason,
      input.currentResult,
      input.currentFreshnessIssue,
      input.currentReason,
    ],
  )
  return (result.rowCount ?? 0) > 0
}

export function formatReportDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}
