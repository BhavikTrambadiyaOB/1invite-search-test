/**
 * Rule-based template tagging (no AI). Reads the template name, card text and
 * tags, and picks values from the taxonomy. AI enrichment later overwrites this.
 */
import {
  AUDIENCES,
  COLORS,
  ADULT_GUEST_OCCASIONS,
  DOC_TYPES,
  FORMATS,
  MOODS,
  OCCASIONS,
  OCCASION_BY_ID,
  STYLES,
  THEMES,
  type OccasionDef,
  type SimpleDef,
  MILESTONE_BIRTHDAYS,
} from './taxonomy'
import { detectGender, findAssets, normalizeAssetsAndThemes } from './assets'
import { detectLanguages } from './language'
import { baseColorsForShade, findShades } from './shades'
import { compilePhrases, extractMilestone, findMatches, normalizeText, stripMilestones } from './text'
import type { Enrichment } from './types'

type CompiledOccasion = {
  def: OccasionDef
  strong: RegExp | null
  weak: RegExp | null
  blockers: RegExp | null
  requires: RegExp | null
}

const COMPILED_OCCASIONS: CompiledOccasion[] = OCCASIONS.filter((o) => !o.abstract).map((def) => ({
  def,
  strong: compilePhrases(def.phrases),
  weak: compilePhrases(def.weak ?? []),
  blockers: compilePhrases(def.blockers ?? []),
  requires: compilePhrases(def.requires ?? []),
}))

const compileDefs = (defs: SimpleDef[]) => defs.map((def) => ({ def, re: compilePhrases(def.phrases) }))
const COMPILED_FORMATS = compileDefs(FORMATS)
const COMPILED_DOC_TYPES = compileDefs(DOC_TYPES)
const COMPILED_THEMES = compileDefs(THEMES)
const COMPILED_STYLES = compileDefs(STYLES)
const COMPILED_COLORS = compileDefs(COLORS)
const COMPILED_AUDIENCES = compileDefs(AUDIENCES)
const COMPILED_MOODS = compileDefs(MOODS)
/** Birthdays up to this age also fit "kids birthday". */
const KIDS_BIRTHDAY_MAX_AGE = 12
const PHOTO_WORDS = /\b(photo|photos|photograph|picture|selfie)\b/

// How much a phrase match counts, by where it was found.
const WEIGHTS = {
  name: { strong: 6, weak: 2 },
  card: { strong: 4, weak: 1.5 },
  tags: { strong: 1, weak: 0.3 },
}
const GENERIC_FACTOR = 0.55
/** A score of 6 (a strong match in the name) counts as full confidence. */
const FULL_CONFIDENCE_SCORE = 6
/** Below this, the only evidence is tags or weak words, which are too noisy to trust. */
const MIN_OCCASION_SCORE = 2
/** Milestone birthdays that have their own occasion. */

export type TemplateText = {
  name: string
  cardText: string
  tags: string[]
  isFeatured: boolean
  /** The template has a photo frame (template_search.photo_slot). */
  photoSlot: boolean
}

type Fields = { name: string; card: string; tags: string }

// Wording that contains "company" but is about guests, not a business.
const GUEST_COMPANY = /\b(?:of|enjoy|for|with) your company\b|\byour company is requested\b/g

function fieldsFor(t: TemplateText): Fields {
  const name = normalizeText(t.name)
  const card = normalizeText(t.cardText).replace(GUEST_COMPANY, ' ')
  // Also read text with milestone numbers removed: "center 8th anniversary" → "center anniversary".
  return {
    name: `${name} ${stripMilestones(name)}`,
    card: `${card} ${stripMilestones(card)}`,
    tags: normalizeText(t.tags.join(' , ')),
  }
}

export function scoreOccasions(fields: Fields) {
  const scores = new Map<string, number>()
  const nameAndCard = `${fields.name} ${fields.card}`

  for (const c of COMPILED_OCCASIONS) {
    if (c.blockers && findMatches(c.blockers, nameAndCard).length > 0) continue
    if (c.requires && findMatches(c.requires, nameAndCard).length === 0) continue

    let score = 0
    for (const field of ['name', 'card', 'tags'] as const) {
      // Count each field once per strength, so repeated words do not inflate the score.
      if (findMatches(c.strong, fields[field]).length > 0) score += WEIGHTS[field].strong
      else if (findMatches(c.weak, fields[field]).length > 0) score += WEIGHTS[field].weak
    }
    if (score > 0) scores.set(c.def.id, c.def.generic ? score * GENERIC_FACTOR : score)
  }

  // A child named in the template name (First Birthday) beats its parent (Birthday).
  // Card-text matches do not count here: "reception to follow" is on most wedding cards.
  for (const [id, score] of scores) {
    const parent = OCCASION_BY_ID.get(id)?.parent
    if (parent && scores.has(parent) && score >= WEIGHTS.name.strong) {
      scores.set(id, score + scores.get(parent)!)
    }
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1])
}

function pickAll(compiled: { def: SimpleDef; re: RegExp | null }[], text: string) {
  return compiled.filter((c) => findMatches(c.re, text).length > 0).map((c) => c.def.id)
}

function pickFirst(compiled: { def: SimpleDef; re: RegExp | null }[], text: string) {
  return compiled.find((c) => findMatches(c.re, text).length > 0)?.def.id ?? null
}

export function ruleEnrich(t: TemplateText): Enrichment {
  const fields = fieldsFor(t)
  const ranked = scoreOccasions(fields)
  const [top, second] = ranked

  let occasion: string | null = null
  let confidence = 0
  if (top && top[1] >= MIN_OCCASION_SCORE) {
    occasion = top[0]
    const margin = top[1] / (top[1] + (second?.[1] ?? 0))
    confidence = Math.min(1, top[1] / FULL_CONFIDENCE_SCORE) * margin
  }
  const rawName = normalizeText(t.name)
  const rawCard = normalizeText(t.cardText)
  const milestone =
    extractMilestone(rawName) ?? extractMilestone(rawCard, true) ?? extractMilestone(fields.tags, true)

  if (occasion === 'birthday' && milestone && MILESTONE_BIRTHDAYS[milestone]) occasion = MILESTONE_BIRTHDAYS[milestone]
  const occ = occasion ? OCCASION_BY_ID.get(occasion) : undefined

  // Document type: the name says it best; otherwise infer from the wording.
  let docType = pickFirst(COMPILED_DOC_TYPES.filter((c) => c.def.id !== 'invitation'), rawName)
  if (!docType && /\binvit/.test(rawName)) docType = 'invitation'
  if (!docType) docType = occ?.group === 'Greetings' ? 'greeting' : pickFirst(COMPILED_DOC_TYPES, rawCard) ?? 'invitation'
  if (docType === 'greeting' && /\b(join us|rsvp|you are invited|youre invited)\b/.test(rawCard) && !/\bgreeting/.test(rawName)) {
    docType = 'invitation'
  }

  const format = pickFirst(COMPILED_FORMATS, rawName) ?? pickFirst(COMPILED_FORMATS, rawCard)

  // Assets: anything named in the template name; in card text, only words that are not used figuratively.
  // Concept themes come from the name only: card text says "with love" or "food and drinks" too often.
  const { assets, themes } = normalizeAssetsAndThemes(
    [...findAssets(rawName), ...findAssets(rawCard, { skipFigurative: true })],
    pickAll(COMPILED_THEMES, rawName),
  )
  const gender = detectGender(`${rawName} ${rawCard}`, occ)
  const styles = [...new Set([...pickAll(COMPILED_STYLES, rawName), ...pickAll(COMPILED_STYLES, fields.tags)])]
  const colorShades = [...new Set([...findShades(rawName), ...findShades(fields.tags)])]
  const colors = [
    ...new Set([...pickAll(COMPILED_COLORS, rawName), ...pickAll(COMPILED_COLORS, fields.tags), ...colorShades.flatMap(baseColorsForShade)]),
  ]
  // Moods from the name and tags only: card text says "fun" and "happy" on almost every card.
  const moods = [...new Set([...pickAll(COMPILED_MOODS, rawName), ...pickAll(COMPILED_MOODS, fields.tags)])]
  const languages = detectLanguages(t.name, t.cardText)
  const hasPhoto = t.photoSlot || PHOTO_WORDS.test(rawName)
  const extraOccasions =
    occasion && occasion !== 'kids_birthday' && OCCASION_BY_ID.get(occasion)?.group === 'Birthday' && milestone && milestone <= KIDS_BIRTHDAY_MAX_AGE
      ? ['kids_birthday']
      : []

  const audience = audienceFor(occ, `${rawName} ${rawCard}`) ?? (extraOccasions.length ? 'kids' : null)

  const quality = 0.5 + (t.isFeatured ? 0.3 : 0) + (t.name ? 0.1 : 0) + (t.cardText ? 0.1 : 0)

  const label = occ?.label ?? ''
  const summary = [
    t.name || [label, docType].filter(Boolean).join(' '),
    label && `Occasion: ${label}.`,
    milestone && `Milestone: ${milestone}.`,
    gender !== 'neutral' && `For a ${gender}.`,
    themes.length > 0 && `Themes: ${themes.join(', ')}.`,
    assets.length > 0 && `Elements: ${assets.join(', ').replace(/_/g, ' ')}.`,
    styles.length > 0 && `Style: ${styles.join(', ')}.`,
    colors.length > 0 && `Colors: ${[...colorShades, ...colors].join(', ')}.`,
    moods.length > 0 && `Mood: ${moods.join(', ')}.`,
    t.cardText && `Text: ${t.cardText.slice(0, 300)}`,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    occasion,
    gender,
    assets,
    occasionConfidence: Number(confidence.toFixed(3)),
    milestone,
    format,
    docType,
    audience,
    themes,
    styles,
    colors,
    moods,
    colorShades,
    extraOccasions,
    languages,
    hasPhoto,
    qualityScore: Number(Math.min(1, quality).toFixed(3)),
    summary,
  }
}

function audienceFor(occ: OccasionDef | undefined, text: string): string | null {
  if (occ) {
    if (ADULT_GUEST_OCCASIONS.has(occ.id)) return 'adults'
    if (['first_birthday', 'kids_birthday', 'school_event'].includes(occ.id) || occ.group === 'Baby & Kids') return 'kids'
    if (['sweet_16', 'quinceanera'].includes(occ.id)) return 'teens'
    if (['Wedding', 'Anniversary'].includes(occ.group) && occ.id !== 'company_anniversary') return 'couple'
    if (['company_anniversary', 'corporate_event', 'grand_opening'].includes(occ.id)) return 'corporate'
  }
  return pickFirst(COMPILED_AUDIENCES, text)
}

/** Words added to the full-text index so "anniversary" also finds Wedding Anniversary templates. */
export function occasionWords(occasionId: string | null): string {
  if (!occasionId) return ''
  const words: string[] = []
  let current = OCCASION_BY_ID.get(occasionId)
  while (current) {
    words.push(current.label)
    current = current.parent ? OCCASION_BY_ID.get(current.parent) : undefined
  }
  return words.join(' ')
}
