import { createHash } from 'node:crypto'
import { db } from '../db'
import { AI_MODELS } from './ai-config'
import { embeddingText } from './embedding-text'
import { embedTexts, toVector } from './embeddings'
import { getVocabulary } from './vocabulary'

/** Texts per embedding request; OpenAI accepts up to 2,048 inputs, smaller batches fail less at once. */
const BATCH = 100

export type EmbeddingJob = { templateId: number; text: string; hash: string }

type Row = {
  template_id: number; name: string; occasion: string | null; extra_occasions: string[]; milestone: number | null; doc_type: string | null
  gender: string | null; audience: string | null; themes: string[]; assets: string[]; styles: string[]; moods: string[]
  colors: string[]; color_shades: string[]; languages: string[]; has_photo: boolean; summary: string; card_text: string
  embedding_hash: string | null
}

/**
 * Templates whose embedding is missing or out of date (tags, summary or model changed).
 * `ids` limits it to those templates; `all` re-embeds even unchanged ones.
 */
export async function templatesToEmbed({ ids, all = false, limit }: { ids?: number[]; all?: boolean; limit?: number } = {}) {
  const vocab = await getVocabulary()
  const { rows } = await db.query<Row>(
    `select template_id, name, occasion, extra_occasions, milestone, doc_type, gender, audience, themes, assets, styles, moods,
            colors, color_shades, languages, has_photo, summary, card_text, embedding_hash
       from template_search
      ${ids ? 'where template_id = any($1::int[])' : ''}
      order by created_at desc`,
    ids ? [ids] : [],
  )
  const jobs: EmbeddingJob[] = []
  for (const r of rows) {
    const text = embeddingText(
      {
        name: r.name, occasion: r.occasion, extraOccasions: r.extra_occasions, milestone: r.milestone, docType: r.doc_type, gender: r.gender,
        audience: r.audience, themes: r.themes, assets: r.assets, styles: r.styles, moods: r.moods, colors: r.colors,
        colorShades: r.color_shades, languages: r.languages, hasPhoto: r.has_photo, summary: r.summary, cardText: r.card_text,
      },
      vocab,
    )
    // Blank templates (no name, no tags) have nothing to embed.
    if (!text.trim()) continue
    const hash = createHash('md5').update(`${AI_MODELS.embedding}\n${text}`).digest('hex')
    if (!all && r.embedding_hash === hash) continue
    jobs.push({ templateId: r.template_id, text, hash })
    if (limit && jobs.length >= limit) break
  }
  return jobs
}

/** Embeds the jobs in batches and saves each batch right away, so a stopped run keeps what it finished. */
export async function embedAndStore(jobs: EmbeddingJob[], onBatch?: (done: number) => void): Promise<number> {
  let done = 0
  for (let i = 0; i < jobs.length; i += BATCH) {
    const batch = jobs.slice(i, i + BATCH)
    const vectors = await embedTexts(batch.map((j) => j.text))
    await db.query(
      `update template_search t set embedding = r.embedding::vector, embedding_hash = r.hash
         from jsonb_to_recordset($1::jsonb) as r(template_id int, embedding text, hash text)
        where t.template_id = r.template_id`,
      [JSON.stringify(batch.map((j, k) => ({ template_id: j.templateId, embedding: toVector(vectors[k]), hash: j.hash })))],
    )
    done += batch.length
    onBatch?.(done)
  }
  return done
}
