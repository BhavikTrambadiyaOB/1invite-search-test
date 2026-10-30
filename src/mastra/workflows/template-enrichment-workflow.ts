import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { db } from '../../lib/db'
import { ENRICH_CACHE_BREAKPOINT, ENRICH_IMAGE_OPTIONS, ENRICH_PROVIDER_OPTIONS } from '../../lib/search/ai-config'
import { ENRICH_LIMITS, templateEnrichmentSchema, type TemplateEnrichmentOutput } from '../../lib/search/ai-schemas'
import { hasEmbeddingColumn } from '../../lib/search/embeddings'
import { embedAndStore, templatesToEmbed } from '../../lib/search/template-embeddings'
import { saveEnrichments } from '../../lib/search/enrichment-store'
import { pickThemes } from '../../lib/search/assets'
import { ADULT_GUEST_OCCASIONS, MILESTONE_BIRTHDAYS } from '../../lib/search/taxonomy'
import { baseColorsForShade, normalizeShade } from '../../lib/search/shades'
import { getVocabulary, lookupTerm, refreshTermCounts, resolveTerm, vocabularyPromptParts } from '../../lib/search/vocabulary'

/** Templates tagged at the same time unless the run asks for another number (--parallel). */
const DEFAULT_PARALLEL = 5
const parallelSchema = z.number().int().min(1).max(20).default(DEFAULT_PARALLEL)

const templateSchema = z.object({
  templateId: z.number(),
  name: z.string(),
  tags: z.array(z.string()),
  cardText: z.string(),
  previewUrl: z.string(),
  sourceHash: z.string(),
})

/** Tags after clean-up: every occasion, theme, asset and style is a vocabulary id. */
const enrichedSchema = z.object({
  templateId: z.number(),
  sourceHash: z.string(),
  occasion: z.string().nullable(),
  occasionConfidence: z.number(),
  gender: z.string().nullable(),
  milestone: z.number().nullable(),
  format: z.string().nullable(),
  docType: z.string().nullable(),
  audience: z.string().nullable(),
  themes: z.array(z.string()),
  assets: z.array(z.string()),
  styles: z.array(z.string()),
  colors: z.array(z.string()),
  moods: z.array(z.string()),
  colorShades: z.array(z.string()),
  extraOccasions: z.array(z.string()),
  languages: z.array(z.string()),
  hasPhoto: z.boolean(),
  qualityScore: z.number(),
  summary: z.string(),
  rawTerms: z.record(z.string(), z.unknown()),
  newTerms: z.array(z.string()),
})
type Enriched = z.infer<typeof enrichedSchema>

/** Text the AI sometimes writes instead of leaving a value empty ("null" as a theme). */
const EMPTY_WORDS = new Set(['null', 'none', 'n/a', 'na', 'unknown', 'other', '-', ''])
const word = (value: string | null) => (value && !EMPTY_WORDS.has(value.trim().toLowerCase()) ? value : null)
const words = (values: string[]) => values.filter((v) => word(v) !== null)

/**
 * Cleans an answer before mapping: "null"-like text becomes empty, and each list is kept within
 * ENRICH_LIMITS (the answer format allows longer lists, so they are trimmed here).
 */
function trimAnswer(ai: TemplateEnrichmentOutput): TemplateEnrichmentOutput {
  const L = ENRICH_LIMITS
  return {
    ...ai,
    occasion: word(ai.occasion),
    occasionParent: word(ai.occasionParent),
    alsoFits: words(ai.alsoFits).slice(0, L.alsoFits),
    themes: words(ai.themes).slice(0, L.themes),
    assets: ai.assets
      .filter((a) => word(a.name) !== null)
      .map((a) => ({ ...a, theme: word(a.theme) }))
      .slice(0, L.assets),
    styles: words(ai.styles).slice(0, L.styles),
    colors: ai.colors.slice(0, L.colors),
    colorShades: ai.colorShades.slice(0, L.colorShades),
    moods: ai.moods.slice(0, L.moods),
    languages: ai.languages.slice(0, L.languages),
    summary: ai.summary.slice(0, L.summaryChars),
    milestone: ai.milestone && ai.milestone > 0 && ai.milestone <= L.maxMilestone ? ai.milestone : null,
  }
}

/** Maps the AI's words to vocabulary ids, creating terms that are new. */
// "Kids birthday" fits only cards for children: not a Sweet 16 or an adult party.
function isKidsCard(audience: string | null, milestone: number | null): boolean {
  return (audience == null || audience === 'kids') && (milestone == null || milestone <= 12)
}

async function canonicalize(ai: TemplateEnrichmentOutput): Promise<Omit<Enriched, 'templateId' | 'sourceHash'>> {
  const newTerms: string[] = []
  const note = (kind: string, r: { id: string; created: boolean } | null) => {
    if (r?.created) newTerms.push(`${kind}:${r.id}`)
    return r?.id ?? null
  }

  const parent = ai.occasionParent ? (await resolveTerm('occasion', ai.occasionParent))?.id ?? null : null
  const resolved = ai.occasion
    ? note('occasion', await resolveTerm('occasion', ai.occasion, { occasionGroup: ai.occasionGroup, parent }))
    : null
  // Numbers are stripped from occasion names, so "1st birthday" comes back as birthday + milestone 1.
  const occasion = resolved === 'birthday' && ai.milestone && MILESTONE_BIRTHDAYS[ai.milestone] ? MILESTONE_BIRTHDAYS[ai.milestone] : resolved

  // Elements first: a new word can only be one kind, and "paint splash" is an element, not a theme.
  const assets = new Set<string>()
  /** The theme the AI gave each element, so a theme shared by several elements can count. */
  const aiAssetTheme = new Map<string, string>()
  for (const asset of ai.assets) {
    const id = note('asset', await resolveTerm('asset', asset.name))
    if (!id) continue
    assets.add(id)
    const theme = asset.theme ? note('theme', await resolveTerm('theme', asset.theme)) : null
    if (theme) aiAssetTheme.set(id, theme)
  }

  const themes = new Set<string>()
  for (const t of ai.themes) {
    const id = note('theme', await resolveTerm('theme', t))
    if (id) themes.add(id)
  }
  // Elements suggest themes (basketball → sports), but only a theme shared by several elements is kept.
  const vocab = await getVocabulary()
  const pickedThemes = pickThemes({
    own: [...themes],
    // Seed elements use their checked themes. Elements learned from AI keep only the theme given in
    // this answer: the stored one is the first guess ever made (a ribbon once guessed as Garden & Nature).
    assetThemes: [...assets].map((id) => {
      const term = vocab.byKind.asset.get(id)
      const known = term && term.source !== 'ai' ? term.themes : []
      return [...known, ...(aiAssetTheme.has(id) ? [aiAssetTheme.get(id)!] : [])]
    }),
    occasionId: occasion,
    occasionGroup: occasion ? vocab.byKind.occasion.get(occasion)?.occasionGroup ?? ai.occasionGroup : null,
  })

  const styles = new Set<string>()
  for (const s of ai.styles) {
    const id = note('style', await resolveTerm('style', s))
    if (id) styles.add(id)
  }

  // Extra occasions must already be known: they widen matches, so they never create new terms.
  const extraOccasions = [
    ...new Set(ai.alsoFits.map((o) => lookupTerm(vocab, 'occasion', o)).filter((id): id is string => !!id && id !== occasion)),
  ].filter((id) => id !== 'kids_birthday' || isKidsCard(ai.audience, ai.milestone))
  const colorShades = [...new Set(ai.colorShades.map(normalizeShade).filter(Boolean))]
  // "lavender" also counts as purple, so the color filter finds it.
  const colors = [...new Set([...ai.colors, ...colorShades.flatMap(baseColorsForShade)])]

  return {
    occasion,
    occasionConfidence: ai.occasionConfidence,
    gender: ai.gender,
    milestone: ai.milestone,
    format: ai.format,
    docType: ai.docType,
    // Baby showers and gender reveals are for adult guests, whatever the design shows.
    audience: occasion && ADULT_GUEST_OCCASIONS.has(occasion) ? 'adults' : ai.audience,
    themes: pickedThemes,
    assets: [...assets],
    styles: [...styles],
    colors,
    moods: [...new Set(ai.moods)],
    colorShades,
    extraOccasions,
    languages: [...new Set(ai.languages)],
    hasPhoto: ai.hasPhoto,
    qualityScore: ai.qualityScore,
    summary: ai.summary,
    rawTerms: {
      occasion: ai.occasion,
      occasionGroup: ai.occasionGroup,
      occasionParent: ai.occasionParent,
      themes: ai.themes,
      assets: ai.assets,
      styles: ai.styles,
      alsoFits: ai.alsoFits,
      colorShades: ai.colorShades,
    },
    newTerms,
  }
}

const loadTemplates = createStep({
  id: 'load-templates',
  description: 'Reads the templates to enrich',
  inputSchema: z.object({ templateIds: z.array(z.number()), save: z.boolean(), parallel: parallelSchema }),
  outputSchema: z.object({ templates: z.array(templateSchema), save: z.boolean(), parallel: parallelSchema }),
  execute: async ({ inputData }) => {
    const { rows } = await db.query(
      `select template_id, name, tags, card_text, preview_url, source_hash
         from template_search where template_id = any($1) order by template_id`,
      [inputData.templateIds],
    )
    return {
      save: inputData.save,
      parallel: inputData.parallel,
      templates: rows.map((r) => ({
        templateId: r.template_id,
        name: r.name,
        tags: r.tags,
        cardText: r.card_text,
        previewUrl: r.preview_url,
        sourceHash: r.source_hash,
      })),
    }
  },
})

const enrichTemplates = createStep({
  id: 'enrich-templates',
  description: 'Asks the enricher agent to tag each template, maps its words to the vocabulary and saves it right away',
  inputSchema: z.object({ templates: z.array(templateSchema), save: z.boolean(), parallel: parallelSchema }),
  outputSchema: z.object({
    enriched: z.array(enrichedSchema),
    failed: z.array(z.object({ templateId: z.number(), error: z.string() })),
    save: z.boolean(),
    saved: z.number(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent('templateEnricherAgent')
    const enriched: Enriched[] = []
    const failed: { templateId: number; error: string }[] = []
    let saved = 0

    const queue = [...inputData.templates]
    async function worker() {
      for (let t = queue.shift(); t; t = queue.shift()) {
        try {
          const text = [
            `Template name: ${t.name || '(none)'}`,
            `Old tags: ${t.tags.join(', ') || '(none)'}`,
            `Printed text: ${t.cardText.slice(0, 1500) || '(none)'}`,
          ].join('\n')
          // The vocabulary grows while the batch runs, so each template sees the latest terms.
          const vocab = vocabularyPromptParts(await getVocabulary())
          const response = await agent.generate(
            [
              {
                role: 'user',
                content: [
                  { type: 'text', text },
                  ...(t.previewUrl
                    ? [{ type: 'image' as const, image: t.previewUrl, mimeType: 'image/jpeg', providerOptions: ENRICH_IMAGE_OPTIONS }]
                    : []),
                ],
              },
            ],
            {
              // Instructions + starting vocabulary are the same for every template, so the cache ends there.
              // Learned terms change as tagging goes on, so they come after the cache point.
              system: [
                { role: 'system', content: vocab.known, providerOptions: ENRICH_CACHE_BREAKPOINT },
                ...(vocab.learned ? [{ role: 'system' as const, content: vocab.learned }] : []),
              ],
              providerOptions: ENRICH_PROVIDER_OPTIONS,
              structuredOutput: { schema: templateEnrichmentSchema },
              tracingOptions: {
                rootSpanName: `tag template #${t.templateId}`,
                metadata: { feature: 'template-enrichment', templateId: t.templateId, templateName: t.name, previewUrl: t.previewUrl },
              },
            },
          )
          const result = await canonicalize(trimAnswer(templateEnrichmentSchema.parse(response.object)))
          const done: Enriched = { ...result, templateId: t.templateId, sourceHash: t.sourceHash }
          // Saved right away, so a stopped run loses only the templates still in flight.
          if (inputData.save) {
            // Await first, then add: `saved += await …` reads `saved` before waiting and loses parallel updates.
            const count = await saveEnrichments([done], 'ai')
            saved += count
          }
          enriched.push(done)
        } catch (error) {
          failed.push({ templateId: t.templateId, error: error instanceof Error ? error.message : String(error) })
        }
      }
    }
    await Promise.all(Array.from({ length: inputData.parallel }, worker))
    return { enriched, failed, save: inputData.save, saved }
  },
})

const embedAndSave = createStep({
  id: 'embed-and-save',
  description: 'Embeds each template (when pgvector is installed) and recounts term usage; tags were saved per template',
  inputSchema: enrichTemplates.outputSchema,
  outputSchema: z.object({
    saved: z.number(),
    embedded: z.number(),
    failed: z.array(z.object({ templateId: z.number(), error: z.string() })),
    enriched: z.array(enrichedSchema),
  }),
  execute: async ({ inputData }) => {
    const { enriched, failed, save, saved } = inputData
    if (!save || enriched.length === 0) return { saved, embedded: 0, failed, enriched }

    let embedded = 0
    if (await hasEmbeddingColumn()) {
      // Same text as the backfill (tags, summary and card wording), built from the saved tags.
      embedded = await embedAndStore(await templatesToEmbed({ ids: enriched.map((e) => e.templateId) }))
    }
    await refreshTermCounts()
    return { saved, embedded, failed, enriched }
  },
})

/** Tags a batch of templates with AI: load → enrich (text + image) and map to vocabulary → embed and save. */
export const templateEnrichmentWorkflow = createWorkflow({
  id: 'template-enrichment-workflow',
  inputSchema: z.object({ templateIds: z.array(z.number()), save: z.boolean(), parallel: parallelSchema }),
  outputSchema: embedAndSave.outputSchema,
})
  .then(loadTemplates)
  .then(enrichTemplates)
  .then(embedAndSave)
  .commit()
