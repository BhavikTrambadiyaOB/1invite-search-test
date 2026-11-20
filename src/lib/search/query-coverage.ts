import { db } from '../db'
import { catalogExclusion } from './catalog-exclusion'
import { QUERY_AUDIENCES } from './taxonomy'
import { parseQuery } from './parse-query'
import { queryTagsFromIntent, type QueryTag } from './query-tags'
import { getVocabulary, learnedTerms, occasionFamilyFrom, type Vocabulary } from './vocabulary'

/**
 * Tag coverage of user search queries, using only the rule parser (no AI, no embeddings): which words
 * become tags, which only match template text, which match nothing, and how many local templates
 * carry every tag of the query.
 */

export const COVERAGE_STATUSES = ['full', 'partial', 'text_only', 'none'] as const
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number]

export const COVERAGE_STATUS_LABELS: Record<CoverageStatus, string> = {
  full: 'Fully tagged',
  partial: 'Partly tagged',
  text_only: 'Text match only',
  none: 'Not covered',
}

export const COVERAGE_STATUS_HELP: Record<CoverageStatus, string> = {
  full: 'Every meaningful word became a tag.',
  partial: 'Some words became tags; the rest are not tags.',
  text_only: 'No tags, but the words appear in some template text.',
  none: 'No tags and no word appears in any template.',
}

/** Tag group names as the search page shows them. */
const GROUP_LABELS: Record<string, string> = {
  occasions: 'Occasion',
  milestones: 'Milestone',
  format: 'Format',
  genders: 'Gender',
  themes: 'Theme',
  assets: 'Element',
  colors: 'Color',
  styles: 'Style',
  moods: 'Mood',
  languages: 'Language',
  audiences: 'Audience',
  photo: 'Photo',
  docTypes: 'Card type',
  price: 'Price',
}

export type CoverageTag = { group: string; label: string }

export type CoverageRow = {
  rowNo: number
  query: string
  status: CoverageStatus
  tags: CoverageTag[]
  textWords: string[]
  missingWords: string[]
  templatesAllTags: number | null
  emptyTags: string[]
}

export const tagText = (tag: CoverageTag) => `${tag.label} (${tag.group})`

/** SQL condition for one tag on template_search, the same columns search filters on. */
function tagCondition(tag: QueryTag, vocab: Vocabulary, params: unknown[]): string | null {
  const add = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }
  switch (tag.group) {
    case 'occasions': {
      const family = add(occasionFamilyFrom(vocab, tag.value))
      return `(occasion = any(${family}::text[]) or extra_occasions && ${family}::text[])`
    }
    case 'milestones':
      return `milestone = ${add(Number(tag.value))}`
    case 'format':
      return `format = ${add(tag.value)}`
    // Search keeps gender-neutral cards for "boy" and "girl", so they count here too.
    case 'genders':
      return `coalesce(gender, 'neutral') <> ${add(tag.value === 'girl' ? 'boy' : 'girl')}`
    case 'themes':
    case 'assets':
    case 'colors':
    case 'styles':
    case 'moods':
    case 'languages':
      return `${tag.group} @> array[${add(tag.value)}]::text[]`
    case 'audiences': {
      const def = QUERY_AUDIENCES.find((a) => a.id === tag.value)
      if (!def) return null
      return `coalesce(milestone between ${add(def.ages[0])} and ${add(def.ages[1])}, audience = ${add(def.id)}, false)`
    }
    case 'photo':
      return 'has_photo'
    case 'docTypes':
      return `doc_type = ${add(tag.value)}`
    case 'price':
      return `is_free = ${add(tag.value === 'free')}`
    default:
      return null
  }
}

async function countTemplates(tags: QueryTag[], vocab: Vocabulary): Promise<number> {
  const params: unknown[] = []
  const conditions = tags.map((tag) => tagCondition(tag, vocab, params)).filter(Boolean)
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from template_search t where ${[catalogExclusion('t'), ...conditions].join(' and ')}`,
    params,
  )
  return rows[0].n
}

/** Runs `work` over items with a few at a time. */
async function mapLimit<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++
        out[index] = await work(items[index])
      }
    }),
  )
  return out
}

/** Analyses queries with the rule parser and counts matching local templates. */
export async function analyzeQueryCoverage(
  queries: string[],
  onProgress?: (message: string) => void,
): Promise<CoverageRow[]> {
  const vocab = await getVocabulary()
  const learned = learnedTerms(vocab)
  const parsed = queries.map((query) => {
    const intent = parseQuery(query, learned)
    return { query, tags: queryTagsFromIntent(intent, vocab), words: intent.keywords }
  })
  onProgress?.(`Read ${parsed.length} queries with the rules.`)

  // Which leftover words appear in any template's text.
  const words = [...new Set(parsed.flatMap((p) => p.words))]
  const inTemplates = new Set<string>()
  if (words.length) {
    const { rows } = await db.query<{ w: string }>(
      `select w from unnest($1::text[]) w
        where exists (
          select 1 from template_search t
           where t.search_vector @@ plainto_tsquery('english', search_unaccent(w)) and ${catalogExclusion('t')}
        )`,
      [words],
    )
    for (const row of rows) inTemplates.add(row.w)
  }
  onProgress?.(`Checked ${words.length} non-tag words against template text.`)

  // Templates per single tag, and per tag combination (many queries share one).
  const tagByKey = new Map(parsed.flatMap((p) => p.tags.map((t) => [t.key, t] as const)))
  const singleCounts = new Map<string, number>()
  const singles = [...tagByKey.values()]
  const singleResults = await mapLimit(singles, 4, (tag) => countTemplates([tag], vocab))
  singles.forEach((tag, i) => singleCounts.set(tag.key, singleResults[i]))

  const comboKey = (tags: QueryTag[]) => tags.map((t) => t.key).sort().join('|')
  const combos = new Map<string, QueryTag[]>()
  for (const p of parsed) if (p.tags.length > 1) combos.set(comboKey(p.tags), p.tags)
  onProgress?.(`Counting templates for ${singles.length} tags and ${combos.size} tag combinations…`)
  const comboList = [...combos.entries()]
  const comboResults = await mapLimit(comboList, 4, ([, tags]) => countTemplates(tags, vocab))
  const comboCounts = new Map(comboList.map(([key], i) => [key, comboResults[i]]))

  return parsed.map((p, index): CoverageRow => {
    const textWords = p.words.filter((w) => inTemplates.has(w))
    const missingWords = p.words.filter((w) => !inTemplates.has(w))
    const status: CoverageStatus = p.tags.length
      ? p.words.length
        ? 'partial'
        : 'full'
      : textWords.length
        ? 'text_only'
        : 'none'
    const templatesAllTags = !p.tags.length
      ? null
      : p.tags.length === 1
        ? (singleCounts.get(p.tags[0].key) ?? 0)
        : (comboCounts.get(comboKey(p.tags)) ?? 0)
    const tags = p.tags.map((t) => ({ group: GROUP_LABELS[t.group] ?? t.group, label: t.label }))
    return {
      rowNo: index + 1,
      query: p.query,
      status,
      tags,
      textWords,
      missingWords,
      templatesAllTags,
      emptyTags: tags.filter((_, i) => singleCounts.get(p.tags[i].key) === 0).map(tagText),
    }
  })
}

/** Saves a list's rows, replacing any earlier run of the same file. */
export async function saveQueryCoverage(sourceFile: string, rows: CoverageRow[]) {
  const client = await db.connect()
  try {
    await client.query('begin')
    const { rows: list } = await client.query<{ id: number }>(
      `insert into query_coverage_list (source_file, query_count) values ($1, $2)
       on conflict (source_file) do update set query_count = excluded.query_count, updated_at = now()
       returning id`,
      [sourceFile, rows.length],
    )
    const listId = list[0].id
    await client.query('delete from query_coverage where list_id = $1', [listId])
    for (let start = 0; start < rows.length; start += 1000) {
      const chunk = rows.slice(start, start + 1000).map((r) => ({
        row_no: r.rowNo,
        query: r.query,
        status: r.status,
        tags: r.tags,
        text_words: r.textWords,
        missing_words: r.missingWords,
        templates_all_tags: r.templatesAllTags,
        empty_tags: r.emptyTags,
      }))
      await client.query(
        `insert into query_coverage
           (list_id, row_no, query, status, tags, text_words, missing_words, templates_all_tags, empty_tags)
         select $1, row_no, query, status, tags, text_words, missing_words, templates_all_tags, empty_tags
           from jsonb_to_recordset($2::jsonb) as x(
             row_no int, query text, status text, tags jsonb, text_words text[], missing_words text[],
             templates_all_tags int, empty_tags text[])`,
        [listId, JSON.stringify(chunk)],
      )
    }
    await client.query('commit')
    return listId
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

// ---- Reading ---------------------------------------------------------------

export type CoverageList = { id: number; sourceFile: string; queryCount: number; updatedAt: string }

export async function listCoverageLists(): Promise<CoverageList[]> {
  const { rows } = await db.query<{ id: number; source_file: string; query_count: number; updated_at: Date }>(
    'select id, source_file, query_count, updated_at from query_coverage_list order by updated_at desc',
  )
  return rows.map((r) => ({
    id: r.id,
    sourceFile: r.source_file,
    queryCount: r.query_count,
    updatedAt: new Date(r.updated_at).toISOString(),
  }))
}

export type CoverageFilters = {
  list?: number
  status?: CoverageStatus
  query?: string
  /** A word from the "in templates" or "not found" lists. */
  word?: string
  /** A tag as shown, e.g. "Birthday (Occasion)". */
  tag?: string
  /** Only queries whose tags no template carries together. */
  zero?: boolean
}

export function coverageFiltersFromParams(get: (key: string) => string | null | undefined): CoverageFilters {
  const list = Number(get('list'))
  const status = get('status')
  const text = (key: string) => get(key)?.trim().slice(0, 200) || undefined
  return {
    list: Number.isSafeInteger(list) && list > 0 ? list : undefined,
    status: COVERAGE_STATUSES.includes(status as CoverageStatus) ? (status as CoverageStatus) : undefined,
    query: text('q'),
    word: text('word')?.toLowerCase(),
    tag: text('tag'),
    zero: get('zero') === '1' || undefined,
  }
}

export function coverageFilterParams(filters: CoverageFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.list !== undefined) params.set('list', String(filters.list))
  if (filters.status) params.set('status', filters.status)
  if (filters.query) params.set('q', filters.query)
  if (filters.word) params.set('word', filters.word)
  if (filters.tag) params.set('tag', filters.tag)
  if (filters.zero) params.set('zero', '1')
  return params
}

function coverageWhere(listId: number, filters: CoverageFilters) {
  const params: unknown[] = [listId]
  const where = ['c.list_id = $1']
  const add = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }
  if (filters.status) where.push(`c.status = ${add(filters.status)}`)
  if (filters.query) where.push(`c.query ilike ${add(`%${filters.query.replace(/[\\%_]/g, '\\$&')}%`)}`)
  if (filters.word) {
    const word = add(filters.word)
    where.push(`(${word} = any(c.text_words) or ${word} = any(c.missing_words))`)
  }
  if (filters.tag) {
    where.push(
      `exists (select 1 from jsonb_array_elements(c.tags) t where (t->>'label') || ' (' || (t->>'group') || ')' = ${add(filters.tag)})`,
    )
  }
  if (filters.zero) where.push('c.templates_all_tags = 0')
  return { where: where.join(' and '), params }
}

const ROW_SELECT = `c.row_no, c.query, c.status, c.tags, c.text_words, c.missing_words, c.templates_all_tags, c.empty_tags`

type DbRow = {
  row_no: number
  query: string
  status: CoverageStatus
  tags: CoverageTag[]
  text_words: string[]
  missing_words: string[]
  templates_all_tags: number | null
  empty_tags: string[]
}

const toRow = (r: DbRow): CoverageRow => ({
  rowNo: r.row_no,
  query: r.query,
  status: r.status,
  tags: r.tags,
  textWords: r.text_words,
  missingWords: r.missing_words,
  templatesAllTags: r.templates_all_tags,
  emptyTags: r.empty_tags,
})

export const COVERAGE_PAGE_SIZE = 50

export async function listQueryCoverage(listId: number, filters: CoverageFilters, page: number) {
  const { where, params } = coverageWhere(listId, filters)
  const { rows: count } = await db.query<{ n: number }>(`select count(*)::int as n from query_coverage c where ${where}`, params)
  const total = count[0].n
  const totalPages = Math.max(1, Math.ceil(total / COVERAGE_PAGE_SIZE))
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages)
  const { rows } = await db.query<DbRow>(
    `select ${ROW_SELECT} from query_coverage c where ${where} order by c.row_no
      limit ${COVERAGE_PAGE_SIZE} offset ${(current - 1) * COVERAGE_PAGE_SIZE}`,
    params,
  )
  return { rows: rows.map(toRow), total, page: current, totalPages }
}

export async function listQueryCoverageForExport(listId: number, filters: CoverageFilters) {
  const { where, params } = coverageWhere(listId, filters)
  const { rows } = await db.query<DbRow>(`select ${ROW_SELECT} from query_coverage c where ${where} order by c.row_no`, params)
  return rows.map(toRow)
}

export type CoverageSummary = {
  total: number
  byStatus: Record<CoverageStatus, number>
  zeroTemplates: number
}

export async function getCoverageSummary(listId: number): Promise<CoverageSummary> {
  const { rows } = await db.query<{ status: CoverageStatus; n: number; zero: number }>(
    `select status, count(*)::int as n, count(*) filter (where templates_all_tags = 0)::int as zero
       from query_coverage where list_id = $1 group by status`,
    [listId],
  )
  const byStatus = { full: 0, partial: 0, text_only: 0, none: 0 }
  for (const r of rows) byStatus[r.status] = r.n
  return {
    total: rows.reduce((sum, r) => sum + r.n, 0),
    byStatus,
    zeroTemplates: rows.reduce((sum, r) => sum + r.zero, 0),
  }
}

export type CoverageWord = { word: string; kind: 'text' | 'missing'; queries: number }

/** Non-tag words by how many queries use them: the gaps worth adding as tags first. */
export async function listCoverageWords(listId: number, limit?: number): Promise<CoverageWord[]> {
  const { rows } = await db.query<{ word: string; kind: 'text' | 'missing'; queries: number }>(
    `select word, kind, count(*)::int as queries from (
       select unnest(text_words) as word, 'text' as kind from query_coverage where list_id = $1
       union all
       select unnest(missing_words), 'missing' from query_coverage where list_id = $1
     ) w group by word, kind order by queries desc, word
     ${limit ? `limit ${Math.floor(limit)}` : ''}`,
    [listId],
  )
  return rows
}

export type CoverageTagCount = { tag: string; queries: number }

/** Tags read from the queries, by how many queries have them. */
export async function listCoverageTags(listId: number, limit: number): Promise<CoverageTagCount[]> {
  const { rows } = await db.query<CoverageTagCount>(
    `select (t->>'label') || ' (' || (t->>'group') || ')' as tag, count(*)::int as queries
       from query_coverage c, jsonb_array_elements(c.tags) t
      where c.list_id = $1 group by 1 order by queries desc, tag limit ${Math.floor(limit)}`,
    [listId],
  )
  return rows
}
