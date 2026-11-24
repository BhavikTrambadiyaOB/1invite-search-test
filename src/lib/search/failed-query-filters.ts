import type { FailedQuery, FailedQuerySource, GapType } from './failed-queries'

/**
 * Filters of the failed-queries page (/search/insights): the query text, the source (all searches, the search
 * page only, or a report version / phase), a sort and one number condition on a column ("Direct = 0",
 * "Templates >= 100").
 */

export const SORTS = {
  latest: 'Latest first',
  oldest: 'Oldest first',
  priority: 'Priority (visits × failure rate)',
  visits: 'Most visits',
  direct_asc: 'Fewest direct',
  templates_desc: 'Most templates',
  templates_asc: 'Fewest templates',
  relevance_asc: 'Lowest top relevance',
  query_asc: 'Query A–Z',
} as const
export type SortKey = keyof typeof SORTS

/** Gap filter: every search of the source, only failed ones, or one gap type. */
export const GAPS = {
  all: 'All (failed and no gap)',
  failed: 'Failed only',
  no_gap: 'No gap',
  content_gap: 'Content gap',
  search_gap: 'Search gap',
  not_chosen: 'Not chosen',
} as const
export type GapFilter = keyof typeof GAPS

export const COLUMNS = {
  visits: 'Visits',
  templates: 'Templates',
  direct: 'Direct',
  by_tags: 'Direct by tags',
  partial: 'Partial',
  occasion_only: 'Occasion only',
  relevance: 'Top relevance (%)',
} as const
export type ColumnKey = keyof typeof COLUMNS

export const OPERATORS = ['=', '>', '<', '>=', '<='] as const
export type Operator = (typeof OPERATORS)[number]

export type FailedQueryFilters = {
  query: string
  /** 'all' (every search), 'live' (search page only) or a report version number. */
  version: 'all' | 'live' | number
  phase: number | null
  /** Test-sheet case type ("Theme-Based Search"); null for all. */
  caseType: string | null
  gap: GapFilter
  sort: SortKey
  condition: { column: ColumnKey; operator: Operator; value: number } | null
  page: number
}

export function failedQueryFiltersFromParams(get: (key: string) => string | undefined): FailedQueryFilters {
  const version = get('v')
  const phase = Number(get('phase'))
  const sort = get('sort')
  const gap = get('gap')
  const column = get('col')
  const operator = get('op')
  const value = get('val')
  const page = Number(get('page'))
  const hasCondition = !!column && column in COLUMNS && OPERATORS.includes(operator as Operator) && value !== undefined &&
    value.trim() !== '' && Number.isFinite(Number(value))
  return {
    query: get('q')?.trim().slice(0, 200) ?? '',
    version: version === 'live' ? 'live' : Number(version) > 0 ? Number(version) : 'all',
    phase: Number.isInteger(phase) && phase > 0 ? phase : null,
    caseType: get('case')?.trim().slice(0, 200) || null,
    gap: gap && gap in GAPS ? (gap as GapFilter) : 'all',
    sort: sort && sort in SORTS ? (sort as SortKey) : 'latest',
    condition: hasCondition ? { column: column as ColumnKey, operator: operator as Operator, value: Number(value) } : null,
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  }
}

export function failedQueryHref(filters: FailedQueryFilters, page = filters.page) {
  const params = new URLSearchParams()
  if (filters.query) params.set('q', filters.query)
  if (filters.version !== 'all') params.set('v', String(filters.version))
  if (filters.phase) params.set('phase', String(filters.phase))
  if (filters.caseType) params.set('case', filters.caseType)
  if (filters.gap !== 'all') params.set('gap', filters.gap)
  if (filters.sort !== 'latest') params.set('sort', filters.sort)
  if (filters.condition) {
    params.set('col', filters.condition.column)
    params.set('op', filters.condition.operator)
    params.set('val', String(filters.condition.value))
  }
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return `/search/insights${query ? `?${query}` : ''}`
}

export function sourceOf(filters: FailedQueryFilters): FailedQuerySource {
  if (filters.version === 'live') return { live: true }
  return { version: filters.version === 'all' ? null : filters.version, phase: filters.phase }
}

/** The column's value for a row; relevance as a whole percent, as the table shows it. */
function columnValue(row: FailedQuery, column: ColumnKey): number | null {
  switch (column) {
    case 'visits': return row.searches
    case 'templates': return row.avgResults
    case 'direct': return row.avgDirect
    case 'by_tags': return row.tagExact ?? row.avgDirect
    case 'partial': return row.avgPartial
    case 'occasion_only': return row.avgOccasionOnly
    case 'relevance': return row.avgRelevance === null ? null : Math.round(row.avgRelevance * 100)
  }
}

function compare(a: number, operator: Operator, b: number) {
  switch (operator) {
    case '=': return a === b
    case '>': return a > b
    case '<': return a < b
    case '>=': return a >= b
    case '<=': return a <= b
  }
}

export function applyFailedQueryFilters(rows: FailedQuery[], filters: FailedQueryFilters) {
  const text = filters.query.toLocaleLowerCase()
  const { condition } = filters
  const kept = rows.filter((row) => {
    if (text && !row.exampleQuery.toLocaleLowerCase().includes(text)) return false
    if (filters.caseType && !row.caseTypes.includes(filters.caseType)) return false
    if (filters.gap === 'failed' && row.gapType === 'no_gap') return false
    if (filters.gap !== 'all' && filters.gap !== 'failed' && row.gapType !== (filters.gap as GapType)) return false
    if (!condition) return true
    const value = columnValue(row, condition.column)
    return value !== null && compare(value, condition.operator, condition.value)
  })
  const by = (value: (row: FailedQuery) => number | null) => (a: FailedQuery, b: FailedQuery) =>
    (value(a) ?? Number.POSITIVE_INFINITY) - (value(b) ?? Number.POSITIVE_INFINITY)
  const latest = (a: FailedQuery, b: FailedQuery) => b.lastSearchedAt.localeCompare(a.lastSearchedAt)
  const sorters: Record<SortKey, (a: FailedQuery, b: FailedQuery) => number> = {
    latest,
    oldest: (a, b) => -latest(a, b),
    priority: (a, b) => b.priority - a.priority || b.searches - a.searches || latest(a, b),
    visits: (a, b) => b.searches - a.searches || latest(a, b),
    direct_asc: (a, b) => by((r) => r.avgDirect)(a, b) || latest(a, b),
    templates_desc: (a, b) => b.avgResults - a.avgResults || latest(a, b),
    templates_asc: (a, b) => a.avgResults - b.avgResults || latest(a, b),
    relevance_asc: (a, b) => by((r) => r.avgRelevance)(a, b) || latest(a, b),
    query_asc: (a, b) => a.exampleQuery.localeCompare(b.exampleQuery),
  }
  return kept.sort(sorters[filters.sort])
}
