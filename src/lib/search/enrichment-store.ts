import { db } from '../db'
import { occasionWords } from './rule-enrich'
import type { Enrichment } from './types'

export type EnrichmentRecord = Enrichment & {
  templateId: number
  sourceHash: string
  /** The words AI returned before clean-up (AI enrichment only). */
  rawTerms?: Record<string, unknown>
}

/** Saves enrichment results for many templates in one statement. */
export async function saveEnrichments(records: EnrichmentRecord[], source: 'rules' | 'ai') {
  if (records.length === 0) return 0
  const rows = records.map((r) => ({
    template_id: r.templateId,
    occasion: r.occasion,
    gender: r.gender,
    assets: r.assets,
    occasion_confidence: r.occasionConfidence,
    // Extra occasions are searchable words too ("kids birthday" finds a 4th birthday card).
    occasion_words: [occasionWords(r.occasion), ...r.extraOccasions.map(occasionWords)].filter(Boolean).join(' '),
    milestone: r.milestone,
    format: r.format,
    doc_type: r.docType,
    audience: r.audience,
    themes: r.themes,
    styles: r.styles,
    colors: r.colors,
    moods: r.moods,
    color_shades: r.colorShades,
    extra_occasions: r.extraOccasions.filter((o) => o !== r.occasion),
    languages: r.languages,
    has_photo: r.hasPhoto,
    quality_score: r.qualityScore,
    summary: r.summary,
    source_hash: r.sourceHash,
    raw_terms: r.rawTerms ?? null,
  }))
  const result = await db.query(
    `update template_search t set
        occasion = r.occasion, gender = r.gender, assets = r.assets, occasion_confidence = r.occasion_confidence, occasion_words = r.occasion_words,
        milestone = r.milestone, format = r.format, doc_type = r.doc_type, audience = r.audience,
        themes = r.themes, styles = r.styles, colors = r.colors, quality_score = r.quality_score,
        moods = r.moods, color_shades = r.color_shades, extra_occasions = r.extra_occasions, languages = r.languages,
        -- A photo slot in the template data always counts, whatever the tagger saw.
        has_photo = r.has_photo or t.photo_slot,
        summary = r.summary, raw_terms = coalesce(r.raw_terms, t.raw_terms), enrich_source = $2, enriched_hash = r.source_hash, enriched_at = now()
       from jsonb_to_recordset($1::jsonb) as r(
         template_id int, occasion text, gender text, assets text[], occasion_confidence real, occasion_words text, milestone int,
         format text, doc_type text, audience text, themes text[], styles text[], colors text[],
         moods text[], color_shades text[], extra_occasions text[], languages text[], has_photo boolean,
         quality_score real, summary text, source_hash text, raw_terms jsonb)
      where t.template_id = r.template_id`,
    [JSON.stringify(rows), source],
  )
  return result.rowCount ?? 0
}
