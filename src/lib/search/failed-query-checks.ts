import { db } from '../db'
import { catalogExclusion } from './catalog-exclusion'
import { keywordConcepts } from './keyword-concepts'
import { isPriceFilterEnabled } from './features'
import { hasExclusions, readNegations } from './negation'
import { RANKING } from './ranking'
import {
  COLOR_BY_ID, DOC_TYPE_BY_ID, FORMAT_BY_ID, LANGUAGE_BY_ID, MOOD_BY_ID, JOINT_CARD_TEXT, JOINT_WORDS, OCCASION_BY_ID, QUERY_AUDIENCES, STYLE_BY_ID,
} from './taxonomy'
import { ordinal, queryText } from './text'
import type { SearchExclusions } from './types'
import { getVocabulary, labelFor, learnedTerms, occasionFamilyFrom, phrasesFor, type Vocabulary } from './vocabulary'

/** What a logged search did not want: its saved reading, or the query read again (searches logged before). */
function exclusionsOf(intent: Intent, query: string, vocab: Vocabulary) {
  const read = readNegations(query, learnedTerms(vocab))
  const saved = intent.exclude as SearchExclusions | null | undefined
  return { rest: read.rest, exclude: hasExclusions(saved) ? saved : read.exclude }
}

/** Plain labels of the exclusions that hide cards ("No photo", "No Balloon"). */
function hiddenLabels(exclude: SearchExclusions | null, vocab: Vocabulary): string[] {
  if (!hasExclusions(exclude)) return []
  return [
    ...(exclude.photo ? ['No photo'] : []),
    ...(isPriceFilterEnabled() && exclude.pro ? ['Not PRO (free only)'] : []),
    ...(isPriceFilterEnabled() && exclude.free ? ['Not free (PRO only)'] : []),
    ...(exclude.rsvp ? ['No printed RSVP line'] : []),
    ...exclude.themes.map((t) => `No ${labelFor(vocab, 'theme', t)}`),
    ...exclude.assets.map((a) => `No ${labelFor(vocab, 'asset', a)}`),
    ...exclude.colors.map((c) => `No ${COLOR_BY_ID.get(c)?.label ?? c}`),
  ]
}

/** Exclusions that hide cards in search (photo, PRO / free, RSVP line, theme, element and color tags). */
function hiddenConditions(exclude: SearchExclusions | null, p: Params): string[] {
  if (!hasExclusions(exclude)) return []
  const out: string[] = []
  if (exclude.photo) out.push('not has_photo')
  if (isPriceFilterEnabled() && exclude.pro) out.push('is_free')
  if (isPriceFilterEnabled() && exclude.free) out.push('not is_free')
  if (exclude.rsvp) out.push('not prints_rsvp')
  if (exclude.themes.length) out.push(`not (themes && ${p.add(exclude.themes)}::text[])`)
  if (exclude.assets.length) out.push(`not (assets && ${p.add(exclude.assets)}::text[])`)
  if (exclude.colors.length) out.push(`not (colors && ${p.add(exclude.colors)}::text[])`)
  return out
}

/**
 * Report-only checks for the failed-queries page. They read template data and never change search results.
 *
 * - tagMatchCounts: templates that fit everything asked, where a typed word already covered by an understood tag
 *   counts through that tag only. Search's own exact count also asks such words ("toddler", "holy cow") to be
 *   printed on the card, though the toddlers audience and the cow element already cover them, so it can say 0
 *   while fitting cards exist. Typed words no tag covers ("hair stylist") still have to be in the card's text.
 * - missingTagHints: cards that name an asked theme or element in their text but are not tagged with it
 *   ("Cocomelon Wheels on the Bus" without the Cocomelon theme). Information for the data team only.
 */

type Intent = Record<string, unknown>

class Params {
  values: unknown[] = []
  add(value: unknown) {
    this.values.push(value)
    return `$${this.values.length}`
  }
}

const list = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])
const text = (value: unknown) => (typeof value === 'string' && value ? value : null)

function tsAny(p: Params, phrases: string[]) {
  const unique = [...new Set(phrases.map((x) => queryText(x)).filter(Boolean))].slice(0, 12)
  if (unique.length === 0) return `''::tsquery`
  return `(${unique.map((x) => `phraseto_tsquery('english', search_unaccent(${p.add(x)}))`).join(' || ')})`
}

/** The occasion and its kinds, from the live vocabulary like search (AI-learned kinds included). */
const inOccasions = (p: Params, vocab: Vocabulary, id: string) => {
  const ids = p.add(occasionFamilyFrom(vocab, id))
  return `(occasion = any(${ids}::text[]) or extra_occasions && ${ids}::text[])`
}

const words = (phrases: string[]) =>
  phrases.flatMap((x) => queryText(x).split(' ')).filter((w) => w.length > 1).flatMap((w) => [w, w.replace(/s$/, '')])

/** Every word of every spelling of the understood tags ("toddlers" audience: toddler, toddlers). */
function coveredWords(intent: Intent, vocab: Vocabulary) {
  const phrases: string[] = []
  const add = (id: string, more: string[] = []) => phrases.push(id.replace(/_/g, ' '), ...more)
  const occasion = text(intent.occasion)
  for (const o of [occasion, ...list(intent.alsoOccasions)].filter((x): x is string => !!x)) {
    add(o, [...(OCCASION_BY_ID.get(o)?.phrases ?? []), ...phrasesFor(vocab, 'occasion', o)])
  }
  for (const t of list(intent.themes)) add(t, phrasesFor(vocab, 'theme', t))
  for (const a of list(intent.assets)) add(a, phrasesFor(vocab, 'asset', a))
  for (const st of list(intent.styles)) add(st, [...(STYLE_BY_ID.get(st)?.phrases ?? []), ...phrasesFor(vocab, 'style', st)])
  for (const c of list(intent.colors)) add(c, COLOR_BY_ID.get(c)?.phrases ?? [])
  const audience = QUERY_AUDIENCES.find((a) => a.id === intent.audience)
  if (audience) add(audience.id, audience.phrases)
  // Gender is left out: its words are too broad ("mother" reads as girl, but a girl card is not a mother's card).
  const format = text(intent.format)
  if (format) add(format, FORMAT_BY_ID.get(format)?.phrases ?? [])
  return new Set(words(phrases))
}

type Part = { label: string; sql: string; typedWord: boolean; coveredBy: boolean }

/**
 * Every part of a logged reading search asks a card to have (besides the occasion), with a plain label: the same
 * tests search uses for its Direct count. Typed words count only next to an occasion or format, as in search.
 */
function askedParts(intent: Intent, typed: string, vocab: Vocabulary, p: Params, skipCovered = false): Part[] {
  const parts: Part[] = []
  // "1st birthday no photo": the words of what is not wanted are not asked for (search reads the rest only).
  const { rest: query, exclude } = exclusionsOf(intent, typed, vocab)
  const add = (label: string, sql: string) => parts.push({ label, sql, typedWord: false, coveredBy: false })
  for (const also of list(intent.alsoOccasions)) add(`${labelFor(vocab, 'occasion', also)} (second occasion)`, inOccasions(p, vocab, also))
  if (typeof intent.milestone === 'number') add(`${ordinal(intent.milestone)} (age)`, `milestone = ${p.add(intent.milestone)}`)
  for (const theme of list(intent.themes)) {
    add(`${labelFor(vocab, 'theme', theme)} (theme)`,
      `(themes @> array[${p.add(theme)}]::text[] or search_vector @@ ${tsAny(p, phrasesFor(vocab, 'theme', theme))})`)
  }
  for (const asset of list(intent.assets)) {
    add(`${labelFor(vocab, 'asset', asset)} (element)`,
      `(assets @> array[${p.add(asset)}]::text[] or search_vector @@ ${tsAny(p, phrasesFor(vocab, 'asset', asset))})`)
  }
  const gender = text(intent.gender)
  if (gender === 'girl' || gender === 'boy') add(gender === 'girl' ? 'Made for a girl' : 'Made for a boy', `gender = ${p.add(gender)}`)
  for (const color of list(intent.colors)) {
    const def = COLOR_BY_ID.get(color)
    const phrases = def ? [def.id.replace(/_/g, ' '), ...def.phrases] : [color]
    add(`${def?.label ?? color} (color)`, `(colors @> array[${p.add(color)}]::text[] or search_vector @@ ${tsAny(p, phrases)})`)
  }
  const audience = QUERY_AUDIENCES.find((a) => a.id === intent.audience)
  if (audience) {
    const [youngest, oldest] = audience.ages
    add(`${audience.label} (ages ${youngest}–${oldest})`,
      `coalesce(milestone between ${p.add(youngest)} and ${p.add(oldest)}, audience = ${p.add(audience.id)}, false)`)
  }
  const format = text(intent.format)
  if (format) {
    const def = FORMAT_BY_ID.get(format)
    const phrases = def ? [def.id.replace(/_/g, ' '), ...def.phrases] : [format]
    add(`${def?.label ?? format} (format)`, `(format = ${p.add(format)} or search_vector @@ ${tsAny(p, phrases)})`)
  }
  const docType = text(intent.docType)
  if (docType) add(`${DOC_TYPE_BY_ID.get(docType)?.label ?? docType} (card type)`, `doc_type = ${p.add(docType)}`)
  if (intent.hasPhoto === true) add('With a photo', 'has_photo')
  const language = text(intent.language)
  if (language) add(`${LANGUAGE_BY_ID.get(language)?.label ?? language} text`, `languages @> array[${p.add(language)}]::text[]`)
  for (const style of list(intent.styles)) add(`${labelFor(vocab, 'style', style)} (style)`, `styles @> array[${p.add(style)}]::text[]`)
  for (const mood of list(intent.moods)) add(`${MOOD_BY_ID.get(mood)?.label ?? mood} (mood)`, `moods @> array[${p.add(mood)}]::text[]`)
  // Search's word rule: "twins / joint" asks a card for two or more people.
  const queryWords = new Set(query.split(' '))
  const asksJoint = JOINT_WORDS.some((w) => queryWords.has(w))
  // Built only where used: an unused parameter fails the query.
  const jointSql = () => `(search_vector @@ ${tsAny(p, JOINT_WORDS)} or card_text ~* ${p.add(JOINT_CARD_TEXT)})`
  if (asksJoint) add('For two or more people (joint)', jointSql())
  // Exclusions that only rank lower are parts like any other ("not twins", "no year", "not so simple").
  if (exclude?.joint) add('Not for two or more people (not joint)', `not ${jointSql()}`)
  if (exclude?.printedAge) add('No printed age', 'milestone is null')
  for (const style of exclude?.styles ?? []) add(`Not ${labelFor(vocab, 'style', style)} (style)`, `not (styles @> array[${p.add(style)}]::text[])`)
  if (text(intent.occasion) || format) {
    const covered = coveredWords(intent, vocab)
    const keywords = list(intent.keywords).filter((k) => !/rsvp/.test(k))
    for (const forms of keywordConcepts(query, asksJoint ? keywords.filter((k) => !JOINT_WORDS.includes(k)) : keywords)) {
      const coveredBy = words(forms).some((w) => covered.has(w))
      if (coveredBy && skipCovered) continue
      parts.push({ label: `The word “${forms[0]}” on the card`, sql: `search_vector @@ ${tsAny(p, forms)}`, typedWord: true, coveredBy })
    }
  }
  return parts
}

/** The reading of a logged search as SQL conditions: the tests search uses, minus typed words a tag covers. */
function tagConditions(intent: Intent, query: string, vocab: Vocabulary, p: Params) {
  const occasion = text(intent.occasion)
  return [
    ...(occasion ? [inOccasions(p, vocab, occasion)] : []),
    ...hiddenConditions(exclusionsOf(intent, query, vocab).exclude, p),
    ...askedParts(intent, query, vocab, p, true).map((part) => part.sql),
  ]
}

export type CountExplanation = {
  /** The occasion search understood, and how many cards it has (all templates when none was understood). */
  occasion: string | null
  occasionCards: number
  parts: {
    label: string
    /** Cards of the occasion that have this part. */
    have: number
    /** Cards of the occasion that have every other part but not this one: what blocks them from Direct. */
    missingOnly: number
    typedWord: boolean
    /** A typed word an understood tag already covers ("toddler" next to the Toddlers audience). */
    coveredBy: boolean
  }[]
  /** Cards of the occasion with every part (search's Direct). */
  direct: number
  /** Cards of the occasion with none of the parts (search's Occasion only). */
  occasionOnly: number
  /** What the query left out, which search hides before counting ("No photo", "No printed RSVP line"). */
  excluded: string[]
}

/**
 * Why a search got its Direct / Partial / Occasion only numbers, part by part, recounted on today's template data
 * with the tests search uses. Report only: it reads template_search and never changes search.
 */
export async function explainCounts(intent: Intent | null, query: string): Promise<CountExplanation | null> {
  if (!intent) return null
  const vocab = await getVocabulary()
  const p = new Params()
  const occasion = text(intent.occasion)
  const where = [catalogExclusion('t')]
  if (occasion) where.push(inOccasions(p, vocab, occasion))
  const gender = text(intent.gender)
  // Search never shows cards made for the other gender.
  if (gender === 'girl' || gender === 'boy') where.push(`coalesce(gender, 'neutral') <> ${p.add(gender === 'girl' ? 'boy' : 'girl')}`)
  // Cards search hides for what the query does not want ("no photo", "non pro", "without rsvp") are not counted.
  const excluded = exclusionsOf(intent, query, vocab).exclude
  where.push(...hiddenConditions(excluded, p))
  const parts = askedParts(intent, query, vocab, p)
  const has = parts.map((part) => `coalesce(${part.sql}, false)`)
  const all = has.length ? has.join(' and ') : 'true'
  const none = has.length ? has.map((h) => `not ${h}`).join(' and ') : 'false'
  const select = [
    'count(*)::int as occasion_cards',
    `count(*) filter (where ${all})::int as direct`,
    `count(*) filter (where ${none})::int as occasion_only`,
    ...has.map((h, i) => `count(*) filter (where ${h})::int as have_${i}`),
    ...has.map((h, i) => `count(*) filter (where not ${h} ${has.filter((_, j) => j !== i).map((o) => `and ${o}`).join(' ')})::int as miss_${i}`),
  ]
  const { rows } = await db.query<Record<string, number>>(
    `select ${select.join(', ')} from template_search t where ${where.join(' and ')}`,
    p.values,
  )
  const r = rows[0]
  return {
    occasion: occasion ? labelFor(vocab, 'occasion', occasion) : null,
    occasionCards: r.occasion_cards,
    parts: parts.map((part, i) => ({
      label: part.label,
      have: r[`have_${i}`],
      missingOnly: r[`miss_${i}`],
      typedWord: part.typedWord,
      coveredBy: part.coveredBy,
    })),
    direct: r.direct,
    occasionOnly: occasion ? r.occasion_only : 0,
    excluded: hiddenLabels(excluded, vocab),
  }
}

/**
 * Templates fitting each reading (keyed by normalized query), typed words counted only when no tag covers them.
 */
export async function tagMatchCounts(readings: Map<string, Intent | null>): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>()
  if (readings.size === 0) return out
  const vocab = await getVocabulary()
  for (const [query, intent] of readings) {
    const p = new Params()
    const conditions = intent ? tagConditions(intent, query, vocab, p) : []
    // Only typed words, no understood tag: search's own count already says it all.
    if (conditions.length === 0 || conditions.every((c) => c.startsWith('search_vector'))) {
      out.set(query, null)
      continue
    }
    const { rows } = await db.query<{ c: number }>(
      `select count(*)::int c from template_search t where ${catalogExclusion('t')} and ${conditions.join(' and ')}`,
      p.values,
    )
    out.set(query, rows[0]?.c ?? 0)
  }
  return out
}

export type MissingTagHint = { kind: 'theme' | 'element'; id: string; label: string; count: number }

/**
 * Asked themes and elements that some cards carry in their name without the tag ("Cocomelon Wheels on the Bus"
 * not tagged Cocomelon), counted within the asked occasion (all templates when none was understood). Only the
 * name is read, and broad themes (Party & Celebration) are skipped: both would list hundreds of loose mentions.
 */
export async function missingTagHints(intent: Intent | null): Promise<MissingTagHint[]> {
  if (!intent) return []
  const asked = [
    ...list(intent.themes)
      .filter((id) => !(RANKING.broadThemes as readonly string[]).includes(id))
      .map((id) => ({ kind: 'theme' as const, column: 'themes', vocabKind: 'theme' as const, id })),
    ...list(intent.assets).map((id) => ({ kind: 'element' as const, column: 'assets', vocabKind: 'asset' as const, id })),
  ]
  if (asked.length === 0) return []
  const vocab = await getVocabulary()
  const hints: MissingTagHint[] = []
  for (const a of asked) {
    const p = new Params()
    const occasion = text(intent.occasion)
    const { rows } = await db.query<{ c: number }>(
      `select count(*)::int c from template_search t
        where ${catalogExclusion('t')}
          ${occasion ? `and ${inOccasions(p, vocab, occasion)}` : ''}
          and to_tsvector('english', search_unaccent(coalesce(name, ''))) @@ ${tsAny(p, [a.id.replace(/_/g, ' '), labelFor(vocab, a.vocabKind, a.id)])}
          and not (coalesce(${a.column}, '{}') @> array[${p.add(a.id)}]::text[])`,
      p.values,
    )
    const count = rows[0]?.c ?? 0
    if (count > 0) hints.push({ kind: a.kind, id: a.id, label: labelFor(vocab, a.vocabKind, a.id), count })
  }
  return hints
}
