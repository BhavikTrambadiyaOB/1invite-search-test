/**
 * Zod schemas for AI output.
 * Occasions, themes, assets and styles are open text: AI may name new ones, and the vocabulary
 * clean-up (vocabulary.ts) maps each word to an existing term or creates a new one.
 * Formats, document types, audiences, genders, colors, moods and languages stay fixed lists.
 * Color shades are free text.
 */
import { z } from 'zod'
import { AUDIENCES, COLORS, DOC_TYPES, FORMATS, GENDERS, LANGUAGES, MOODS, OCCASION_GROUPS } from './taxonomy'

const ids = <T extends { id: string }>(defs: T[]) => defs.map((d) => d.id) as [string, ...string[]]

export const formatEnum = z.enum(ids(FORMATS))
export const docTypeEnum = z.enum(ids(DOC_TYPES))
export const audienceEnum = z.enum(ids(AUDIENCES))
export const colorEnum = z.enum(ids(COLORS))
export const genderEnum = z.enum(ids(GENDERS))
export const moodEnum = z.enum(ids(MOODS))
export const languageEnum = z.enum(ids(LANGUAGES))
export const occasionGroupEnum = z.enum(OCCASION_GROUPS as unknown as [string, ...string[]])

const term = z.string().min(1).max(60)

/**
 * How many values of each list a template keeps. The answer format does not enforce these:
 * one extra value would reject the whole (already paid) answer, so lists are trimmed afterwards.
 */
export const ENRICH_LIMITS = {
  alsoFits: 3,
  themes: 3,
  assets: 8,
  styles: 4,
  colors: 4,
  colorShades: 5,
  moods: 1,
  languages: 3,
  summaryChars: 400,
  /** Larger printed numbers are years or addresses, not an age or anniversary count. */
  maxMilestone: 200,
} as const
const L = ENRICH_LIMITS

export const templateEnrichmentSchema = z.object({
  occasion: term.nullable().describe('A known occasion id, or a short name for a new occasion. null only if truly unclear.'),
  occasionGroup: occasionGroupEnum.nullable().describe('Group for a new occasion; may be null for a known one.'),
  occasionParent: z.string().max(60).nullable().describe('Known occasion this one belongs under, e.g. birthday for a 50th birthday party. Usually null.'),
  occasionConfidence: z.number().min(0).max(1),
  alsoFits: z
    .array(term)
    .describe(`Up to ${L.alsoFits} other known occasion ids this exact design suits without changing its meaning, e.g. kids_birthday for a 4th birthday card. Usually empty.`),
  gender: genderEnum.describe('Who the event is for: girl, boy, or neutral when not clearly one (couples, groups, unclear).'),
  milestone: z.number().int().nullable().describe('Printed age or year count, e.g. 5 for "5th anniversary".'),
  format: formatEnum.nullable(),
  docType: docTypeEnum,
  audience: audienceEnum.nullable(),
  themes: z
    .array(term)
    .describe(`1 to ${L.themes} overall concepts of the whole design, most important first: known theme ids, or short new names.`),
  assets: z
    .array(z.object({ name: term, theme: z.string().max(60).nullable() }))
    .describe(
      `Up to ${L.assets} main visible objects (singular noun), most prominent first, each with the theme it clearly belongs to or null, e.g. {name: "basketball", theme: "sports"}.`,
    ),
  styles: z.array(term).describe(`Up to ${L.styles} design styles: known style ids, or short new names.`),
  colors: z.array(colorEnum).describe(`Up to ${L.colors} dominant colors, most prominent first.`),
  colorShades: z
    .array(z.string().max(40))
    .describe(`Up to ${L.colorShades} specific shade names you see, e.g. "lavender", "sage green", "blush pink", "metallic gold". Plain base colors go in colors.`),
  moods: z.array(moodEnum).describe('The one main feeling of the design, from the mood ids listed; empty when plain.'),
  languages: z.array(languageEnum).describe('Languages of the printed text, main one first.'),
  hasPhoto: z.boolean().describe('true when the design contains a photograph or a frame for the user\'s photo.'),
  qualityScore: z.number().min(0).max(1).describe('Design quality: 1 = polished and modern, 0 = dated or poor.'),
  summary: z.string().describe('One or two plain sentences describing the design for search.'),
})

export type TemplateEnrichmentOutput = z.infer<typeof templateEnrichmentSchema>

export const queryIntentSchema = z.object({
  occasion: z.string().max(60).nullable().describe('A known occasion id (or family id such as anniversary), or null.'),
  occasionConfidence: z.number().min(0).max(1),
  gender: z.enum(['girl', 'boy']).nullable(),
  milestone: z.number().int().min(1).max(120).nullable(),
  format: formatEnum.nullable(),
  docType: docTypeEnum.nullable(),
  themes: z.array(z.string().max(60)).max(4).describe('Known theme ids.'),
  assets: z.array(z.string().max(60)).max(4).describe('Objects the person wants in the design (butterfly, basketball).'),
  styles: z.array(z.string().max(60)).max(3).describe('Known style ids.'),
  colors: z.array(colorEnum).max(3),
  moods: z.array(moodEnum).max(2).describe('Mood words in the query ("fun", "calm").'),
  language: languageEnum.nullable().describe('Only when the query names a language ("spanish invitation").'),
  hasPhoto: z.boolean().nullable().describe('true when the query asks for a photo card.'),
  isFree: z.boolean().nullable(),
  keywords: z.array(z.string()).max(6).describe('Important words not covered by the fields above.'),
})

/** The fixed lists, for agent instructions. The growing vocabulary is added per call (vocabularyPrompt). */
export function fixedListsPrompt() {
  const list = (name: string, defs: { id: string; label: string }[]) =>
    `${name}: ${defs.map((d) => `${d.id} (${d.label})`).join(', ')}`
  return [
    list('Formats', FORMATS),
    list('Document types', DOC_TYPES),
    list('Audiences', AUDIENCES),
    list('Genders', GENDERS),
    list('Colors', COLORS),
    list('Moods', MOODS),
    list('Languages', LANGUAGES),
  ].join('\n\n')
}
