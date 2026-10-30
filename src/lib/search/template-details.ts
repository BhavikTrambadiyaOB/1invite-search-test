import { db } from '../db'
import { parseTemplateJson } from './card-text'

export type TemplatePage = { pageId: string; imageUrl: string; webpUrl: string | null; width: number | null; height: number | null }

export type TemplateDetails = {
  id: number
  uuid: string | null
  universalId: string | null
  catalogId: number | null
  name: string
  previewUrl: string
  pages: TemplatePage[]
  isFree: boolean
  isFreeWeb: boolean
  isFreeIos: boolean
  isFeatured: boolean
  isPortrait: boolean | null
  isMultipage: boolean
  width: number | null
  height: number | null
  createdAt: string
  updatedAt: string | null
  // Search tags
  occasion: string | null
  occasionConfidence: number
  gender: string | null
  milestone: number | null
  format: string | null
  docType: string | null
  audience: string | null
  themes: string[]
  assets: string[]
  styles: string[]
  colors: string[]
  moods: string[]
  colorShades: string[]
  extraOccasions: string[]
  languages: string[]
  hasPhoto: boolean
  photoSlot: boolean
  qualityScore: number
  summary: string
  cardText: string
  tags: string[]
  oldTags: string
  enrichSource: string
  enrichedAt: string | null
  syncedAt: string
  rawTerms: Record<string, unknown> | null
  // Search activity
  activity: { clicks: number; opens: number; bounces: number; searches: { query: string; count: number }[] }
}

/** Everything known about one template: legacy fields, search tags and search activity. */
export async function getTemplateDetails(id: number): Promise<TemplateDetails | null> {
  const { rows } = await db.query(
    `select t.*, i.uuid, i.universal_id, i.catalog_id, i.multiple_images, i.json_pages_sequence, i.is_multipage,
            i.width, i.height, i.is_free as web_free, i.is_ios_free, i.search_category_old, i.updated_at
       from template_search t join images i on i.id = t.template_id
      where t.template_id = $1`,
    [id],
  )
  const r = rows[0]
  if (!r) return null

  const [events, searches] = await Promise.all([
    db.query<{ type: string; c: number }>(
      `select type, count(*)::int c from search_event where template_id = $1 group by type`,
      [id],
    ),
    db.query<{ query: string; count: number }>(
      `select l.normalized_query as query, count(*)::int as count
         from search_event e join search_log l on l.id = e.search_id
        where e.template_id = $1 group by 1 order by 2 desc limit 10`,
      [id],
    ),
  ])
  const eventCount = (type: string) => events.rows.find((e) => e.type === type)?.c ?? 0

  return {
    id: r.template_id,
    uuid: r.uuid,
    universalId: r.universal_id,
    catalogId: r.catalog_id,
    name: r.name,
    previewUrl: r.preview_url,
    pages: parsePages(r.multiple_images, r.json_pages_sequence, r.preview_url),
    isFree: r.is_free,
    isFreeWeb: r.web_free === 1,
    isFreeIos: r.is_ios_free === 1,
    isFeatured: r.is_featured,
    isPortrait: r.is_portrait,
    isMultipage: r.is_multipage === 1,
    width: r.width,
    height: r.height,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    occasion: r.occasion,
    occasionConfidence: r.occasion_confidence,
    gender: r.gender,
    milestone: r.milestone,
    format: r.format,
    docType: r.doc_type,
    audience: r.audience,
    themes: r.themes,
    assets: r.assets,
    styles: r.styles,
    colors: r.colors,
    moods: r.moods,
    colorShades: r.color_shades,
    extraOccasions: r.extra_occasions,
    languages: r.languages,
    hasPhoto: r.has_photo,
    photoSlot: r.photo_slot,
    qualityScore: r.quality_score,
    summary: r.summary,
    cardText: r.card_text,
    tags: r.tags,
    oldTags: r.search_category_old ?? '',
    enrichSource: r.enrich_source,
    enrichedAt: r.enriched_at ? new Date(r.enriched_at).toISOString() : null,
    syncedAt: new Date(r.synced_at).toISOString(),
    rawTerms: r.raw_terms,
    activity: { clicks: eventCount('click'), opens: eventCount('open'), bounces: eventCount('bounce'), searches: searches.rows },
  }
}

/** Page images from `multiple_images` (escaped JSON keyed by page id), in page order. */
function parsePages(raw: string | null, order: string | null, previewUrl: string): TemplatePage[] {
  const cdn = (process.env.CDN_URL ?? '').replace(/\/+$/, '')
  const pages = parseTemplateJson(raw) as unknown as Record<string, { name?: string; webp_name?: string; width?: number; height?: number }> | null
  if (!pages || !cdn) return previewUrl ? [{ pageId: 'cover', imageUrl: previewUrl, webpUrl: null, width: null, height: null }] : []
  const ids = (order ?? '').split(',').map((s) => s.trim()).filter((s) => s in pages)
  return (ids.length ? ids : Object.keys(pages))
    .map((pageId) => {
      const p = pages[pageId]
      return {
        pageId,
        imageUrl: p?.name ? `${cdn}/${p.name}` : '',
        webpUrl: p?.webp_name ? `${cdn}/${p.webp_name}` : null,
        width: p?.width ?? null,
        height: p?.height ?? null,
      }
    })
    .filter((p) => p.imageUrl)
}
