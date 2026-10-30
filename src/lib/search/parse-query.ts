/**
 * Rule-based query understanding: turns "5th wedding anniversary" into
 * { occasion: 'wedding_anniversary', milestone: 5 }. Free and instant.
 */
import {
  ASSETS,
  COLORS,
  DESIGN_GENDER_WORDS,
  DOC_TYPES,
  FORMATS,
  GENDERS,
  LANGUAGES,
  MOODS,
  OCCASIONS,
  STYLES,
  THEMES,
  type OccasionDef,
  type SimpleDef,
  MILESTONE_BIRTHDAYS,
  CHAT_PREFIX,
  DATE_WORDS,
} from './taxonomy'
import { compilePhrases, extractMilestone, normalizeText, queryText, stripMilestones } from './text'
import type { SearchIntent } from './types'
import type { LearnedTerm, LearnedVocabulary } from './vocabulary'

/** Words that carry no meaning for search. */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'of', 'to', 'in', 'on', 'with', 'my', 'our', 'your', 'me', 'us',
  'template', 'templates', 'design', 'designs', 'idea', 'ideas', 'card', 'cards', 'invitation', 'invitations',
  'invite', 'invites', 'invitacion', 'plantilla', 'de', 'online', 'printable', 'digital', 'evite', 'ecard',
  'free', 'premium', 'paid', 'best', 'new', 'latest', 'cute', 'beautiful', 'nice', 'simple', 'party', 'celebration',
  'event', 'year', 'years', 'old', 'th', 'st', 'nd', 'rd', 'child', 'children', 'kid', 'kids', 'toddler', 'baby',
])


type Phrase = { re: RegExp; words: number }

function phraseList(phrases: string[]): Phrase[] {
  return phrases
    .map((p) => normalizeText(p))
    .filter(Boolean)
    .map((p) => ({ re: compilePhrases([p])!, words: p.split(' ').length }))
}

const OCCASION_PHRASES = OCCASIONS.map((o) => ({
  def: o,
  strong: phraseList(o.phrases),
  weak: phraseList(o.weak ?? []),
  blockers: o.blockers ? compilePhrases(o.blockers) : null,
}))

function compileDefs(defs: SimpleDef[]) {
  return defs.map((def) => ({ def, phrases: phraseList(def.phrases) }))
}
const C_FORMATS = compileDefs(FORMATS)
const C_DOC_TYPES = compileDefs(DOC_TYPES)
const C_THEMES = compileDefs(THEMES)
const C_STYLES = compileDefs(STYLES)
const C_ASSETS = compileDefs(ASSETS.map((a) => ({ ...a, phrases: [a.id.replace(/_/g, ' '), ...a.phrases] })))
const C_GENDERS = compileDefs(GENDERS.filter((g) => g.id !== 'neutral'))
const C_COLORS = compileDefs(COLORS)
const C_MOODS = compileDefs(MOODS)
const C_LANGUAGES = compileDefs(LANGUAGES.filter((l) => l.phrases.length > 0))
/** "photo invitation", "with picture": the person wants a card with their photo. */
const PHOTO_QUERY = /\b(?:with (?:a |my |your )?)?(?:photo|photos|picture|pictures|pic|pics|photograph)\b/g

/** Removes every match of `re` from `text`, returning what matched. */
function take(re: RegExp, text: { value: string }): string[] {
  re.lastIndex = 0
  const found = text.value.match(re) ?? []
  if (found.length > 0) text.value = text.value.replace(re, ' ').replace(/\s+/g, ' ').trim()
  return found
}

function matchDefs(
  compiled: ReturnType<typeof compileDefs>,
  text: { value: string },
  terms?: Record<string, string>,
) {
  const ids: string[] = []
  // Longest phrases first, so "rose gold" wins over "rose" and "gold".
  const all = compiled
    .flatMap((c) => c.phrases.map((p) => ({ id: c.def.id, ...p })))
    .sort((a, b) => b.words - a.words)
  for (const p of all) {
    const found = take(p.re, text)
    if (found.length > 0 && !ids.includes(p.id)) {
      ids.push(p.id)
      if (terms) terms[p.id] = found[0].trim()
    }
  }
  return ids
}

/** The best occasion in a text: strong over weak, longer phrases, then specific over generic. */
function matchOccasion(
  value: string,
  occasions: CompiledOccasion[] = OCCASION_PHRASES,
): { occasion: string | null; occasionConfidence: number } {
  let occasion: string | null = null
  let occasionConfidence = 0
  let best = { words: 0, strong: false, generic: true }
  for (const o of occasions) {
    if (o.blockers) {
      o.blockers.lastIndex = 0
      if (o.blockers.test(value)) continue
    }
    for (const [list, strong] of [[o.strong, true], [o.weak, false]] as const) {
      for (const p of list) {
        p.re.lastIndex = 0
        if (!p.re.test(value)) continue
        const generic = !!o.def.generic
        const better =
          (strong && !best.strong) ||
          (strong === best.strong && p.words > best.words) ||
          (strong === best.strong && p.words === best.words && best.generic && !generic)
        if (better) {
          occasion = o.def.id
          best = { words: p.words, strong, generic }
          occasionConfidence = (strong ? 1 : 0.6) * (generic ? 0.5 : 1)
        }
      }
    }
  }
  return { occasion, occasionConfidence }
}

/** Removes gender words that do not describe the design ("boy", "her"), keeping "princess" and similar. */
function stripGenderWords(value: string): string {
  const text = { value }
  for (const g of C_GENDERS) {
    for (const p of g.phrases) {
      p.re.lastIndex = 0
      const word = (text.value.match(p.re) ?? [])[0]?.trim()
      if (word && !DESIGN_GENDER_WORDS.has(word)) take(p.re, text)
    }
  }
  return text.value
}

/** Removes pasted chat prefixes ("[27/05, 1:14 pm] name: ") so only what the person asked for is read. */
export function stripQueryNoise(query: string): string {
  return query.replace(CHAT_PREFIX, ' ').replace(/\s+/g, ' ').trim()
}

/** A date part ("juin", "june", "7th" next to a month) that a template does not need to match. */
export function isDateWord(word: string): boolean {
  return DATE_WORDS.has(word)
}

export function normalizeQuery(query: string): string {
  // Words in other scripts are kept ("عيد مبارك"); Latin-only text is the same as normalizeText.
  return queryText(stripQueryNoise(query)).slice(0, 200)
}

type CompiledOccasion = (typeof OCCASION_PHRASES)[number]
type CompiledLearned = {
  occasions: CompiledOccasion[]
  assets: ReturnType<typeof compileDefs>
  themes: ReturnType<typeof compileDefs>
  styles: ReturnType<typeof compileDefs>
}
const learnedCache = new WeakMap<LearnedVocabulary, CompiledLearned>()

/** Compiles terms learned from AI so queries can match them, cached per vocabulary snapshot. */
function compileLearned(learned?: LearnedVocabulary): CompiledLearned {
  if (!learned) return { occasions: [], assets: [], themes: [], styles: [] }
  const hit = learnedCache.get(learned)
  if (hit) return hit
  const asDefs = (terms: LearnedTerm[]) => compileDefs(terms.map((t) => ({ id: t.id, label: t.id, phrases: t.phrases })))
  const compiled: CompiledLearned = {
    occasions: learned.occasion.map((t) => ({
      def: { id: t.id, label: t.id, group: 'Parties', phrases: t.phrases } as OccasionDef,
      strong: phraseList(t.phrases),
      weak: [],
      blockers: null,
    })),
    assets: asDefs(learned.asset),
    themes: asDefs(learned.theme),
    styles: asDefs(learned.style),
  }
  learnedCache.set(learned, compiled)
  return compiled
}

/**
 * Parses a query. `learned` adds terms the AI tagging has learned since taxonomy.ts was written,
 * so new occasions, themes, assets and styles are understood too.
 */
/** Single occasion words long enough that a swapped pair of letters is surely a typo ("brithday"). */
const OCCASION_WORDS = new Set(
  OCCASIONS.flatMap((o) => [...o.phrases, ...(o.weak ?? [])])
    .map((p) => normalizeText(p))
    .filter((p) => p.length >= 6 && !p.includes(' ')),
)

/** Fixes two swapped letters in an occasion word: "brithday" → "birthday", "weddnig" → "wedding". */
function fixSwappedLetters(normalized: string): string {
  return normalized
    .split(' ')
    .map((word) => {
      if (word.length < 6 || OCCASION_WORDS.has(word)) return word
      for (let i = 0; i < word.length - 1; i++) {
        const swapped = word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2)
        if (OCCASION_WORDS.has(swapped)) return swapped
      }
      return word
    })
    .join(' ')
}

export function parseQuery(query: string, learned?: LearnedVocabulary): SearchIntent {
  const extra = compileLearned(learned)
  const occasionList = extra.occasions.length ? [...OCCASION_PHRASES, ...extra.occasions] : OCCASION_PHRASES
  const normalized = fixSwappedLetters(normalizeQuery(query))
  // "30th birthday", "5 year old", and a bare number next to the event ("1 birthday party").
  const milestone = extractMilestone(normalized) ?? extractMilestone(normalized, true)
  // Occasions are matched before milestone numbers are removed, so "first birthday" still reads as one phrase.
  const text = { value: ` ${normalized} ` }

  // Free / premium.
  let isFree: boolean | null = null
  if (/\bfree\b/.test(text.value)) isFree = true
  else if (/\b(premium|paid|pro)\b/.test(text.value)) isFree = false

  // Occasion: the longest matching phrase wins ("wedding anniversary" over "anniversary").
  let { occasion, occasionConfidence } = matchOccasion(text.value, occasionList)
  if (!occasion) {
    // "baby boy shower": gender words can split an occasion phrase, so try again without them.
    const withoutGender = ` ${stripGenderWords(text.value)} `
    const retry = matchOccasion(withoutGender, occasionList)
    if (retry.occasion) {
      ;({ occasion, occasionConfidence } = retry)
      text.value = withoutGender
    }
  }
  if (occasion) {
    // Remove the matched occasion words so they are not read again as themes or keywords.
    const def = occasionList.find((o) => o.def.id === occasion)!
    for (const p of [...def.strong, ...def.weak].sort((a, b) => b.words - a.words)) take(p.re, text)
  }
  // A second occasion ("halloween wedding", "graduation thank you") ranks cards that fit both higher.
  const alsoOccasions: string[] = []
  const alsoConfidence = new Map<string, number>()
  while (occasion && alsoOccasions.length < 2) {
    const found = matchOccasion(text.value, occasionList)
    const next = found.occasion
    if (!next || next === occasion || alsoOccasions.includes(next)) break
    alsoOccasions.push(next)
    alsoConfidence.set(next, found.occasionConfidence)
    const def = occasionList.find((o) => o.def.id === next)!
    for (const p of [...def.strong, ...def.weak].sort((a, b) => b.words - a.words)) take(p.re, text)
  }
  // The specific event leads: "graduation thank you" is a graduation card that says thank you.
  const isGeneric = (id: string) => !!occasionList.find((o) => o.def.id === id)?.def.generic
  const specific = alsoOccasions.find((id) => !isGeneric(id))
  if (occasion && specific && isGeneric(occasion)) {
    alsoOccasions.splice(alsoOccasions.indexOf(specific), 1, occasion)
    occasion = specific
    occasionConfidence = alsoConfidence.get(specific) ?? occasionConfidence
  }
  if (occasion === 'birthday' && milestone && MILESTONE_BIRTHDAYS[milestone]) occasion = MILESTONE_BIRTHDAYS[milestone]
  text.value = ` ${stripMilestones(text.value)} `

  const hasPhoto = take(PHOTO_QUERY, text).length > 0 ? true : null
  const languages = matchDefs(C_LANGUAGES, text)
  const docTypes = matchDefs(C_DOC_TYPES, text)
  const formats = matchDefs(C_FORMATS, text)
  const colors = matchDefs(C_COLORS, text)
  // Elements and themes compete together, longest phrase first, so "star wars" (a theme) beats "star"
  // (an element). On equal length, objects win ("butterfly") over broad concepts ("sports", "safari").
  const tag = (list: ReturnType<typeof compileDefs>, kind: string) =>
    list.map((c) => ({ ...c, def: { ...c.def, id: `${kind}:${c.def.id}` } }))
  const elementsAndThemes = matchDefs([...tag([...C_ASSETS, ...extra.assets], 'asset'), ...tag([...C_THEMES, ...extra.themes], 'theme')], text)
  const pick = (kind: string) => elementsAndThemes.filter((id) => id.startsWith(`${kind}:`)).map((id) => id.slice(kind.length + 1))
  const assets = pick('asset')
  const themes = pick('theme')
  // Moods before styles: "fun" and "soft" are moods.
  const moods = matchDefs(C_MOODS, text)
  const styles = matchDefs([...C_STYLES, ...extra.styles], text)

  // Gender: who the event is for. Read from the whole query; both genders ("boy or girl") means none.
  const genderHits = C_GENDERS.filter((g) => g.phrases.some((p) => ((p.re.lastIndex = 0), p.re.test(` ${normalized} `))))
  const gender = genderHits.length === 1 ? genderHits[0].def.id : null
  text.value = stripGenderWords(text.value)

  const keywords = text.value
    .split(' ')
    .filter((w) => w.length > 1 && !STOPWORDS.has(w) && !DATE_WORDS.has(w) && !/^\d+(st|nd|rd|th)?$/.test(w))

  return {
    occasion,
    occasionConfidence,
    alsoOccasions,
    milestone,
    // "Invitation" is the default; only a specific type (save the date, greeting…) narrows the search.
    docType: docTypes.find((d) => d !== 'invitation') ?? null,
    format: formats.find((f) => f !== 'party') ?? null,
    gender,
    themes,
    assets,
    styles,
    colors,
    moods,
    language: languages[0] ?? null,
    hasPhoto,
    isFree,
    keywords: [...new Set(keywords)],
    unknownWords: [],
    source: 'rules',
  }
}

/** True when the rules understood the query well enough that AI would not add much. */
export function isConfidentParse(intent: SearchIntent): boolean {
  const understood =
    !!intent.occasion || !!intent.format || intent.themes.length > 0 || intent.assets.length > 0 ||
    intent.colors.length > 0 || !!intent.docType || !!intent.gender || intent.moods.length > 0 ||
    !!intent.language || !!intent.hasPhoto
  return understood && intent.keywords.length === 0
}
