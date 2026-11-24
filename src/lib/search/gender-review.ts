import { db } from '../db'
import { GENDERS, type Gender, type GenderReviewRow, type TemplateMeta } from './gender-review-types'

/**
 * The gender review: AI gender answers for neutral birthday cards (scripts/check-gender.ts --review), checked one
 * card at a time by a person on /search/gender-review. ai_gender is what the AI said; final_gender is the person's
 * answer ("Skip" keeps the AI answer). template_search is not changed here.
 */

export {
  GENDER_LABELS,
  GENDERS,
  type Gender,
  type GenderReviewRow,
  type TemplateMeta,
} from './gender-review-types'

export type GenderReviewFilters = {
  /** pending (default), reviewed or all. */
  status: 'pending' | 'reviewed' | 'all'
  /** Only rows where the AI gave this answer. */
  ai?: Gender
  /** Only rows where the AI was at least this sure (0.85, 0.9). */
  minConfidence?: number
  /** 1-based place of the card in the filtered list (for stepping through reviewed cards). */
  position: number
}

export type GenderReviewSummary = {
  total: number
  reviewed: number
  /** Count per AI answer: all rows and how many of them are reviewed. */
  byAi: Record<Gender, { all: number; reviewed: number }>
  /** Reviewed rows where the person disagreed with the AI. */
  changed: number
}

const isGender = (value: unknown): value is Gender => GENDERS.includes(value as Gender)

/** Reads the filters from the page URL (status, ai, min, n). */
export function genderReviewFiltersFromParams(get: (key: string) => string | undefined): GenderReviewFilters {
  const status = get('status')
  const ai = get('ai')
  const min = Number(get('min'))
  const position = Number(get('n'))
  return {
    status: status === 'reviewed' || status === 'all' ? status : 'pending',
    ai: isGender(ai) ? ai : undefined,
    minConfidence: min > 0 && min <= 1 ? min : undefined,
    position: Number.isInteger(position) && position > 0 ? position : 1,
  }
}

/** The page URL for these filters; the first card and the default status are left out. */
export function genderReviewHref(filters: GenderReviewFilters, position = filters.position) {
  const params = new URLSearchParams()
  if (filters.status !== 'pending') params.set('status', filters.status)
  if (filters.ai) params.set('ai', filters.ai)
  if (filters.minConfidence) params.set('min', String(filters.minConfidence))
  if (position > 1) params.set('n', String(position))
  const query = params.toString()
  return `/search/gender-review${query ? `?${query}` : ''}`
}

export async function getGenderReviewSummary(): Promise<GenderReviewSummary> {
  const { rows } = await db.query<{ ai_gender: Gender; all: number; reviewed: number; changed: number }>(
    `select ai_gender, count(*)::int "all", count(*) filter (where status = 'reviewed')::int reviewed,
            count(*) filter (where status = 'reviewed' and final_gender <> ai_gender)::int changed
       from template_gender_review group by ai_gender`,
  )
  const byAi = Object.fromEntries(GENDERS.map((g) => [g, { all: 0, reviewed: 0 }])) as GenderReviewSummary['byAi']
  let total = 0
  let reviewed = 0
  let changed = 0
  for (const r of rows) {
    byAi[r.ai_gender] = { all: r.all, reviewed: r.reviewed }
    total += r.all
    reviewed += r.reviewed
    changed += r.changed
  }
  return { total, reviewed, byAi, changed }
}

const ROW_COLUMNS = `r.template_id, r.name, r.occasion, r.current_gender, r.ai_gender, r.confidence, r.reason, r.preview_url,
  r.status, r.final_gender, r.reviewed_at,
  t.occasion t_occasion, t.extra_occasions, t.milestone, t.gender t_gender, t.audience, t.doc_type, t.format,
  t.themes, t.assets, t.styles, t.colors, t.color_shades, t.moods, t.languages, t.has_photo, t.is_free`

type DbRow = Record<string, unknown>
const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : [])

function mapRow(r: DbRow): GenderReviewRow {
  const meta: TemplateMeta = {
    occasion: (r.t_occasion as string) ?? null,
    alsoOccasions: list(r.extra_occasions),
    milestone: r.milestone === null || r.milestone === undefined ? null : Number(r.milestone),
    gender: (r.t_gender as string) ?? null,
    audience: (r.audience as string) ?? null,
    docType: (r.doc_type as string) ?? null,
    format: (r.format as string) ?? null,
    themes: list(r.themes),
    assets: list(r.assets),
    styles: list(r.styles),
    colors: list(r.colors),
    colorShades: list(r.color_shades),
    moods: list(r.moods),
    languages: list(r.languages),
    hasPhoto: r.has_photo === true,
    isFree: r.is_free === true,
  }
  return {
    templateId: Number(r.template_id),
    name: String(r.name),
    occasion: (r.occasion as string) ?? null,
    currentGender: (r.current_gender as string) ?? null,
    aiGender: r.ai_gender as Gender,
    confidence: Number(r.confidence),
    reason: String(r.reason ?? ''),
    previewUrl: (r.preview_url as string) ?? null,
    status: r.status as GenderReviewRow['status'],
    finalGender: (r.final_gender as Gender) ?? null,
    reviewedAt: r.reviewed_at ? new Date(String(r.reviewed_at)).toISOString() : null,
    meta,
  }
}

/**
 * One card: the one at `position` among the cards matching the filters, the AI's surest girl/boy answers first
 * (the cards that would change). With "to review", saving a card drops it from the list, so position 1 is always
 * the next card to do.
 */
export async function getGenderReviewItem(filters: GenderReviewFilters) {
  const where: string[] = []
  const params: unknown[] = []
  const add = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }
  if (filters.status !== 'all') where.push(`r.status = ${add(filters.status)}`)
  if (filters.ai) where.push(`r.ai_gender = ${add(filters.ai)}`)
  if (filters.minConfidence) where.push(`r.confidence >= ${add(filters.minConfidence)}`)
  const whereSql = where.length ? `where ${where.join(' and ')}` : ''

  const { rows: countRows } = await db.query<{ c: number }>(`select count(*)::int c from template_gender_review r ${whereSql}`, params)
  const total = countRows[0]?.c ?? 0
  const position = Math.min(filters.position, Math.max(1, total))
  const { rows } = await db.query(
    `select ${ROW_COLUMNS}
       from template_gender_review r
       left join template_search t on t.template_id = r.template_id
      ${whereSql}
      order by (r.ai_gender = 'neutral'), r.confidence desc, r.template_id desc
      limit 1 offset ${position - 1}`,
    params,
  )
  return { item: rows[0] ? mapRow(rows[0]) : null, position, total }
}

/** The card reviewed last, so its answer can be undone from the next card. */
export async function getLastReviewed(): Promise<GenderReviewRow | null> {
  const { rows } = await db.query(
    `select ${ROW_COLUMNS}
       from template_gender_review r
       left join template_search t on t.template_id = r.template_id
      where r.status = 'reviewed'
      order by r.reviewed_at desc limit 1`,
  )
  return rows[0] ? mapRow(rows[0]) : null
}

/** Saves a person's answer for one card (or clears it with null, back to pending). Returns false for an unknown card. */
export async function saveGenderReview(templateId: number, finalGender: Gender | null) {
  const result = await db.query(
    `update template_gender_review
        set final_gender = $2::text,
            status = case when $2::text is null then 'pending' else 'reviewed' end,
            reviewed_at = case when $2::text is null then null else now() end
      where template_id = $1`,
    [templateId, finalGender],
  )
  return (result.rowCount ?? 0) > 0
}
