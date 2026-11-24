import { db } from '../db'
import { catalogExclusion } from './catalog-exclusion'
import { isPriceFilterEnabled, withPriceFilterSetting } from './features'
import { RANKING } from './ranking'
import { isAiEnabled } from './ai-config'
import { hasEmbeddingColumn, queryEmbedding } from './embeddings'
import { isDateWord, normalizeQuery, stripQueryNoise, understoodAnything } from './parse-query'
import { resolveIntent } from './resolve-intent'
import { getVocabulary, labelFor, occasionAncestorsFrom, occasionFamilyFrom, phrasesFor, type VocabKind } from './vocabulary'
import {
  COLOR_BY_ID,
  GENDER_BY_ID,
  DOC_TYPE_BY_ID,
  FORMAT_BY_ID,
  LANGUAGE_BY_ID,
  MOOD_BY_ID,
  OCCASION_BY_ID,
  OCCASION_GROUP_BY_ID,
  CARD_MEANS_GREETING_GROUPS,
  COLOR_SHADES,
  DESIGN_GENDER_WORDS,
  JOINT_CARD_TEXT,
  JOINT_WORDS,
  NICHE_DESIGNS,
  NO_RSVP_QUERY,
  RSVP_CARD_TEXT,
  OCCASION_AGES,
  QUERY_AUDIENCES,
  RESERVED_OCCASION_WORDS,
  occasionGroupId,
  type OccasionDef,
  type SimpleDef,
} from './taxonomy'
import { keywordConcepts } from './keyword-concepts'
import { activeFilterCount } from './url'

/** Gendered words that name the event, not the look ("quinceanera", "bride"): their gender stays a tie-break. */
const OCCASION_GENDER_WORDS = new Set(['quinceanera', 'quince', 'bride', 'groom'])
import { suggestTags } from './suggest-tags'
import { compilePhrases, findMatches, normalizeText, ordinal, queryText, withoutDatesAndTimes } from './text'
import type { ActiveTag, FacetValue, QuickTag, SuggestedTag, SearchFilters, SearchIntent, SearchResponse, SearchResultItem } from './types'

const FILTER_GROUPS = [
  'occasionGroup', 'occasion', 'milestone', 'themes', 'assets', 'styles', 'moods', 'colors', 'docType', 'gender', 'language', 'photo', 'price', 'orientation',
] as const
type FilterGroup = (typeof FILTER_GROUPS)[number]


/** Collects SQL parameters and returns their $n placeholders. */
class Params {
  values: unknown[] = []
  add(value: unknown) {
    this.values.push(value)
    return `$${this.values.length}`
  }
}

/** Full-text condition matching any of the phrases, e.g. a theme and its synonyms. */
function tsAny(p: Params, phrases: string[]) {
  const unique = [...new Set(phrases.map((x) => queryText(x)).filter(Boolean))].slice(0, 12)
  if (unique.length === 0) return `''::tsquery`
  return `(${unique.map((x) => `phraseto_tsquery('english', search_unaccent(${p.add(x)}))`).join(' || ')})`
}

function defsPhrases(def: SimpleDef | undefined) {
  return def ? [def.id.replace(/_/g, ' '), ...def.phrases] : []
}

/** OR-query over all meaningful words, used for text relevance. */
function orTsQuery(words: string[]) {
  const safe = [...new Set(words.map((w) => w.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '')).filter((w) => w.length > 1))]
  return safe.join(' | ')
}

export type SearchInput = {
  query: string
  filters?: SearchFilters
  page?: number
  /**
   * Parts of the parsed query the user removed: occasion, milestone, format, docType, free, gender, language, photo,
   * theme:<id>, asset:<id>, color:<id>, style:<id>, mood:<id>.
   */
  ignore?: string[]
}

/** Drops the parts of the parsed query that the user removed from the "Showing" tags. */
function withoutIgnored(intent: SearchIntent, ignore: string[]): SearchIntent {
  if (ignore.length === 0) return intent
  const has = (key: string) => ignore.includes(key)
  return {
    ...intent,
    occasion: has('occasion') ? null : intent.occasion,
    occasionConfidence: has('occasion') ? 0 : intent.occasionConfidence,
    alsoOccasions: intent.alsoOccasions.filter((o) => !has(`also:${o}`)),
    milestone: has('milestone') ? null : intent.milestone,
    format: has('format') ? null : intent.format,
    docType: has('docType') ? null : intent.docType,
    isFree: has('free') ? null : intent.isFree,
    gender: has('gender') ? null : intent.gender,
    themes: intent.themes.filter((t) => !has(`theme:${t}`)),
    assets: intent.assets.filter((a) => !has(`asset:${a}`)),
    colors: intent.colors.filter((c) => !has(`color:${c}`)),
    styles: intent.styles.filter((s) => !has(`style:${s}`)),
    moods: intent.moods.filter((m) => !has(`mood:${m}`)),
    language: has('language') ? null : intent.language,
    audience: has('audience') ? null : intent.audience,
    hasPhoto: has('photo') ? null : intent.hasPhoto,
  }
}

/**
 * Chip label of an occasion group. A group named like one of its occasions reads "Wedding Events", so tapping
 * it and then seeing the "Wedding" occasion chip does not look like the same tag twice.
 */
function groupLabel(vocab: Awaited<ReturnType<typeof getVocabulary>>, id: string): string {
  const group = OCCASION_GROUP_BY_ID.get(id) ?? id
  const sameName = vocab.terms.some((t) => t.kind === 'occasion' && t.label.toLowerCase() === group.toLowerCase())
  return sameName ? `${group} Events` : group
}

/** The applied filters as labelled chips (Birthday, 30th, Dinosaurs, With photo…). */
function activeTags(filters: SearchFilters, vocab: Awaited<ReturnType<typeof getVocabulary>>): ActiveTag[] {
  const of = (group: ActiveTag['group'], values: string[] | undefined, toLabel: (v: string) => string) =>
    (values ?? []).map((value) => ({ group, value, label: toLabel(value) }))
  return [
    ...of('groups', filters.groups, (v) => groupLabel(vocab, v)),
    ...of('occasions', filters.occasions, (v) => labelFor(vocab, 'occasion', v)),
    ...of('milestones', filters.milestones?.map(String), (v) => ordinal(Number(v))),
    ...of('genders', filters.genders, (v) => GENDER_BY_ID.get(v)?.label ?? v),
    ...of('themes', filters.themes, (v) => labelFor(vocab, 'theme', v)),
    ...of('assets', filters.assets, (v) => labelFor(vocab, 'asset', v)),
    ...of('styles', filters.styles, (v) => labelFor(vocab, 'style', v)),
    ...of('colors', filters.colors, (v) => COLOR_BY_ID.get(v)?.label ?? v),
    ...of('moods', filters.moods, (v) => MOOD_BY_ID.get(v)?.label ?? v),
    ...of('languages', filters.languages, (v) => LANGUAGE_BY_ID.get(v)?.label ?? v),
    ...of('docTypes', filters.docTypes, (v) => DOC_TYPE_BY_ID.get(v)?.label ?? v),
    ...(filters.photo ? [{ group: 'photo' as const, value: filters.photo, label: filters.photo === 'with' ? 'With photo' : 'Without photo' }] : []),
    ...(filters.price ? [{ group: 'price' as const, value: filters.price, label: filters.price === 'free' ? 'Free' : 'PRO' }] : []),
    ...(filters.orientation ? [{ group: 'orientation' as const, value: filters.orientation, label: filters.orientation === 'portrait' ? 'Portrait' : 'Landscape' }] : []),
  ]
}

/** Similarity of the closest template to the query (uses the vector index), or null without embeddings. */
async function bestSimilarity(qvec: string): Promise<number | null> {
  const { rows } = await db.query<{ best: number }>(
    `select 1 - (t.embedding <=> $1::vector) as best from template_search t
      where t.embedding is not null and ${catalogExclusion('t')}
      order by t.embedding <=> $1::vector limit 1`,
    [qvec],
  )
  return rows[0] ? Number(rows[0].best) : null
}

/**
 * Search, with one safety net: a query that finds nothing, understood nothing ("asdfghjkl", "null", "OR 1=1 --")
 * and has no filter picked shows the browse list (every template, newest and best first) instead of an empty page,
 * so the user sees the search ran and can pick or rephrase. A query that was understood ("pizza kitty party") or a
 * filtered search that finds nothing stays empty: that is a real answer.
 */
/** The sorting ladder (see .ai/rules): results, and the near results tag suggestions fall back to. */
const RANK_ORDER = `selection_hits desc, tier desc, separate_kind asc, subject_hits desc, subject_tags desc, subject_lead desc,
  design_hits desc, color_strength desc, price_match desc, milestone_state desc, milestone_distance asc, age_tie asc,
  other_hits desc, niche asc, banded_score desc, score desc, created_at desc, template_id`

export async function searchTemplates(input: SearchInput): Promise<SearchResponse> {
  const response = await runSearch(input)
  const typed = normalizeQuery(stripQueryNoise(input.query)) !== ''
  const filtered = activeFilterCount(withPriceFilterSetting(input.filters ?? {})) > 0
  if (response.total > 0 || !typed || filtered || understoodAnything(response.intent)) return response

  const browse = await runSearch({ query: '', filters: input.filters, page: input.page, ignore: [] })
  return {
    ...browse,
    query: response.query,
    intent: response.intent,
    exactTotal: 0,
    matchCounts: { direct: 0, partial: 0, occasionOnly: 0 },
    fallback: 'not_understood',
  }
}

async function runSearch({ query: rawQuery, filters: rawFilters = {}, page = 1, ignore = [] }: SearchInput): Promise<SearchResponse> {
  // With Free / PRO filtering off, neither the sidebar choice nor "free" in the query narrows the results.
  const priceFilter = isPriceFilterEnabled()
  const filters = withPriceFilterSetting(rawFilters)
  // A pasted chat prefix ("[27/05, 1:14 pm] name: ") is not part of what the person wants.
  const query = stripQueryNoise(rawQuery)
  const read = withoutIgnored(await resolveIntent(query), ignore)
  // Date parts ("10 juin", "june 7") never have to appear on a design.
  const intent = { ...read, isFree: priceFilter ? read.isFree : null, keywords: read.keywords.filter((k) => !k.split(' ').every((w) => isDateWord(w) || /^\d+(st|nd|rd|th)?$/.test(w))) }
  const p = new Params()

  // Meaning-based matching, only when AI is on and template embeddings exist.
  let qvec: string | null = null
  // Never embed empty text ("!!!"): it only fails.
  if (normalizeQuery(query) && isAiEnabled() && (await hasEmbeddingColumn())) {
    qvec = await queryEmbedding(normalizeQuery(query)).catch((error) => {
      console.error('Query embedding failed; using text matching only', error)
      return null
    })
  }
  // Similarity scales differ per query ("boho" peaks at 0.47, "dinosaur birthday" at 0.73), so a template
  // is scored against the best match for this query, not a fixed number.
  const sem = RANKING.semantic
  let meaning: { similarity: string; score: string; isMatch: string; vector: string } | null = null
  if (qvec) {
    const best = await bestSimilarity(qvec)
    if (best !== null && best >= sem.minBest) {
      const vector = `${p.add(qvec)}::vector`
      const similarity = `(1 - (embedding <=> ${vector}))`
      const floor = Math.max(sem.floor, best - sem.window)
      meaning = {
        similarity,
        score: `least(1, greatest(0, (coalesce(${similarity}, 0) - ${floor}) / ${best - floor}))`,
        isMatch: `coalesce(${similarity}, 0) >= ${Math.max(sem.minMatch, best - sem.matchWithin)}`,
        vector,
      }
    }
  }
  const where: string[] = [catalogExclusion('t')]

  // ---- What the query asks for -------------------------------------------
  const vocab = await getVocabulary()
  const occasionFamily = (id: string) => occasionFamilyFrom(vocab, id)
  // Occasions learned by AI are not in taxonomy.ts; build their definition from the vocabulary.
  const occDef: OccasionDef | undefined = intent.occasion
    ? OCCASION_BY_ID.get(intent.occasion) ??
      (vocab.byKind.occasion.has(intent.occasion)
        ? {
            id: intent.occasion,
            label: labelFor(vocab, 'occasion', intent.occasion),
            group: vocab.byKind.occasion.get(intent.occasion)?.occasionGroup ?? 'Parties',
            phrases: phrasesFor(vocab, 'occasion', intent.occasion),
            // Learned occasions match by occasion or wording, not as a strict filter: a rare one
            // ("summer party", 1 template) must not hide every other matching design.
            generic: true,
          }
        : undefined)
    : undefined
  const strictOccasion =
    occDef && !occDef.generic && intent.occasionConfidence >= RANKING.strictOccasionConfidence ? occDef : undefined
  // The user typed this event's name ("kitty party"), not just a broad word ("party") the reading guessed from.
  // Tags then stay inside the event instead of offering the other events the page was filled with.
  const namedEvent =
    !!occDef && !occDef.abstract &&
    findMatches(
      compilePhrases(
        [...occDef.phrases, ...phrasesFor(vocab, 'occasion', occDef.id), occDef.label].filter((x) => !RESERVED_OCCASION_WORDS.has(normalizeText(x))),
      ),
      normalizeText(query),
    ).length > 0
  // Every occasion with its group ("kitty_party" → "parties"), for the group filter and group chips.
  const groupedOccasions = vocab.terms.filter((t) => t.kind === 'occasion' && t.occasionGroup)
  const groupIdOf = (t: (typeof groupedOccasions)[number]) => occasionGroupId(t.occasionGroup ?? '')
  const chosenGroups = (filters.groups ?? []).filter((g) => OCCASION_GROUP_BY_ID.has(g))
  // A template matches its own occasion and the extra occasions it also fits (a 4th birthday card fits Kids Birthday).
  const inOccasions = (ids: string) => `(occasion = any(${ids}::text[]) or extra_occasions && ${ids}::text[])`
  // The occasion above the asked one is a fallback ("Anniversary" cards for "5th Wedding Anniversary"),
  // ranked after every exact match by the tiers below. Its other kinds (Company Anniversary) stay out.
  const ancestors = occDef ? occasionAncestorsFrom(vocab, occDef.id) : []
  // A guessed or broad occasion next to a named theme or element ("baby boss, party" read as Themed Party at 0.6)
  // must not decide which designs belong: the theme leads, and cards of that occasion rank first among them.
  // Weak: a guess (confidence under 0.9) or a broad built-in occasion (Pool Party, Themed Party). Occasions
  // learned by AI are matched loosely but are specific ("Dedication"), so a sure reading of one still anchors.
  const broadOccasion = !!occDef && !!OCCASION_BY_ID.get(occDef.id)?.generic
  const weakOccasion =
    !!occDef && (intent.occasionConfidence < RANKING.strictOccasionConfidence || broadOccasion) &&
    (intent.themes.length > 0 || intent.assets.length > 0)
  // The cards that belong to the asked occasion. When it has fewer than a page of designs ("umembeso": 2),
  // the page is filled with its parent occasion and designs close in meaning, ranked after every real match.
  let occasionWhere: string | null = null
  if (strictOccasion) {
    const exact = inOccasions(p.add(occasionFamily(strictOccasion.id)))
    occasionWhere = ancestors.length ? `(${exact} or occasion = any(${p.add(ancestors)}::text[]))` : exact
  } else if (occDef && !weakOccasion) {
    // Broad occasions (pool party, brunch…) match by label or wording, not as a strict category.
    occasionWhere = `(${inOccasions(p.add(occasionFamily(occDef.id)))} or search_vector @@ ${tsAny(p, occDef.phrases)})`
  }
  const fill = occasionWhere && meaning
    ? [ancestors.length ? `occasion = any(${p.add(ancestors)}::text[])` : null, meaning.isMatch].filter(Boolean).join(' or ')
    : null
  if (occasionWhere) where.push(fill ? `(${occasionWhere} or ${fill})` : occasionWhere)

  // Details (age, theme, element, color, format) rank instead of filter when an occasion anchors the search:
  // "5th Wedding Anniversary" shows every wedding anniversary, 5th ones first, so a user who likes a nearby
  // design still finds it. Without an occasion they filter, or "dinosaur" would list every template.
  // Without an occasion, a gathering format ("lunch", "dinner", "brunch") anchors instead: "lunch menu" shows
  // lunches, those with a menu first, rather than only lunch cards that also show a menu.
  // "party" alone is too broad to anchor.
  const formatAnchor = !occDef && !!intent.format && intent.format !== 'party'
  // With a weak occasion, the named themes and elements anchor: a card needs one of them (below) and the
  // rest, the occasion included, rank.
  const anchored = !!occDef || formatAnchor
  const details: string[] = []
  // Design details (theme, element, color, style, photo) rank before the age: a printed age is text the user
  // can change, the design is not. "red 9th birthday": red 9th cards, then red cards (nearest age first),
  // then other 9th cards.
  const designDetails: string[] = []
  const requestedChecks: string[] = []
  const detail = (condition: string, design = false) => {
    requestedChecks.push(condition)
    if (anchored) {
      details.push(condition)
      if (design) designDetails.push(condition)
    } else where.push(condition)
  }
  if (occDef && weakOccasion) details.push(`(${inOccasions(p.add(occasionFamily(occDef.id)))} or search_vector @@ ${tsAny(p, occDef.phrases)})`)

  // Without an occasion, a different printed milestone is wrong ("50th" card for "5th").
  let milestoneDetail: string | null = null
  if (intent.milestone) {
    const milestoneMatch = `(milestone = ${p.add(intent.milestone)})`
    requestedChecks.push(milestoneMatch)
    if (anchored) {
      details.push(milestoneMatch)
      milestoneDetail = milestoneMatch
    }
    else where.push(`(milestone is null or milestone = ${p.add(intent.milestone)})`)
  }

  const themeOrAsset: string[] = []
  const assetChecks: string[] = []
  // The same themes and elements, matched by the card's own tags only: a card labelled Dinosaurs is about
  // dinosaurs; Toy Story mentions one (Rex) in its words. Tagged cards come first among equal matches.
  const subjectTags: { column: 'themes' | 'assets'; id: string }[] = []
  const broadThemeChecks: string[] = []
  for (const theme of intent.themes) {
    const condition = `(themes @> array[${p.add(theme)}]::text[] or search_vector @@ ${tsAny(p, phrasesFor(vocab, 'theme', theme))})`
    themeOrAsset.push(condition)
    if ((RANKING.broadThemes as readonly string[]).includes(theme)) broadThemeChecks.push(condition)
    else subjectTags.push({ column: 'themes', id: theme })
  }
  // A specific object ("basketball", "sushi"): in the design or named in the template.
  for (const asset of intent.assets) {
    const condition = `(assets @> array[${p.add(asset)}]::text[] or search_vector @@ ${tsAny(p, phrasesFor(vocab, 'asset', asset))})`
    themeOrAsset.push(condition)
    assetChecks.push(condition)
    subjectTags.push({ column: 'assets', id: asset })
  }
  for (const condition of themeOrAsset) detail(condition, true)
  if (weakOccasion) where.push(`(${themeOrAsset.join(' or ')})`)
  // Gender: drop templates made for the other gender; keep gender-neutral ones (they can be edited).
  if (intent.gender === 'girl' || intent.gender === 'boy') {
    where.push(`coalesce(gender, 'neutral') <> ${p.add(intent.gender === 'girl' ? 'boy' : 'girl')}`)
    const genderMatch = `coalesce(gender = ${p.add(intent.gender)}, false)`
    requestedChecks.push(genderMatch)
    // Among cards equally close in age, ones made for the asked gender come first ("girl birthday": girl before
    // neutral). When a design word says the gender ("cowgirl", "princess", "ballerina"), the gender is part of the
    // look: cowgirl cards come before a neutral cowboy card, even one closer in age.
    const queryWords = ` ${normalizeQuery(query)} `
    const fromDesignWord = (GENDER_BY_ID.get(intent.gender)?.phrases ?? []).some(
      (w) => DESIGN_GENDER_WORDS.has(w) && !OCCASION_GENDER_WORDS.has(w) && queryWords.includes(` ${w} `),
    )
    if (anchored) {
      details.push(genderMatch)
      if (fromDesignWord) designDetails.push(genderMatch)
    }
  }
  for (const color of intent.colors) {
    detail(`(colors @> array[${p.add(color)}]::text[] or search_vector @@ ${tsAny(p, defsPhrases(COLOR_BY_ID.get(color)))})`, true)
  }
  // How strongly a card shows the asked colors: points per asked color among its first color tags (the most
  // visible ones, the first counting most), one per asked shade ("fuchsia", "sky blue") in its shades. Only orders cards; never filters.
  const paddedWords = ` ${normalizeQuery(query)} `
  const askedColors = [...new Set([...intent.colors, ...(filters.colors ?? [])])].filter((c) => c !== 'multicolor')
  const askedShades = COLOR_SHADES.filter((s) => s.words.some((w) => paddedWords.includes(` ${w} `)))
  const colorStrength = [
    // First tag 2 points, second 1: an all-black card before a red card with some black.
    ...askedColors.map((c) => `greatest(${RANKING.mainColorTags} + 1 - coalesce(array_position(colors, ${p.add(c)}), 2147483647), 0)`),
    // The asked shade ("mauve", "sky blue") is more specific than its color, so it counts as much as a first tag.
    ...askedShades.map((s) => `(coalesce(array_to_string(color_shades, '|') ~* ${p.add(s.shades)}, false)::int * ${RANKING.mainColorTags})`),
  ].join(' + ') || '0'
  // "adult birthday" (18–64), "teenager birthday" (13–19): a printed age decides when the card has one, so a
  // 90th is not adult; otherwise the card's audience tag does.
  const audienceDef = QUERY_AUDIENCES.find((a) => a.id === intent.audience)
  if (audienceDef) {
    const [youngest, oldest] = audienceDef.ages
    detail(
      `coalesce(milestone between ${p.add(youngest)} and ${p.add(oldest)}, audience = ${p.add(audienceDef.id)}, false)`,
      true,
    )
  }
  // "joint kids party": cards for two or more people, by their words ("triple", "twins") or names joined by "&".
  const queryWordSet = new Set(normalizeQuery(query).split(' '))
  const asksJoint = JOINT_WORDS.some((w) => queryWordSet.has(w))
  if (asksJoint) detail(`(search_vector @@ ${tsAny(p, JOINT_WORDS)} or card_text ~* ${p.add(JOINT_CARD_TEXT)})`, true)
  // "birthday without rsvp": cards whose printed text has no reply line first. The words "without" and "rsvp" are
  // then not matched as text, or cards that print RSVP would rank first.
  const asksNoRsvp = NO_RSVP_QUERY.test(normalizeQuery(query))
  const isRsvpWord = (w: string) => asksNoRsvp && (/rsvp/.test(w) || ['without', 'no', 'non', 'skip'].includes(w))
  if (asksNoRsvp) detail(`(coalesce(card_text, '') <> '' and card_text !~* ${p.add(RSVP_CARD_TEXT)})`)
  if (intent.format) {
    const condition = `(format = ${p.add(intent.format)} or search_vector @@ ${tsAny(p, defsPhrases(FORMAT_BY_ID.get(intent.format)))})`
    if (formatAnchor) {
      requestedChecks.push(condition)
      where.push(condition)
    }
    else detail(condition)
  }
  // Card type, photo and language are details too: "eid wishes" shows Eid greetings first, then other Eid
  // cards (an invitation is easy to reword), instead of only the few tagged as greetings.
  // "photo invitation": a card with a photo. "spanish invitation": text in that language.
  if (intent.docType) detail(`(doc_type = ${p.add(intent.docType)})`)
  if (intent.hasPhoto) detail('has_photo', true)
  if (intent.language) detail(`(languages @> array[${p.add(intent.language)}]::text[])`)
  // Styles never filter (a style word is often loose: "elegant"). Clear visual styles rank with the design
  // details; broad ones (on most templates) rank after the age.
  for (const style of intent.styles) {
    const condition = `(styles @> array[${p.add(style)}]::text[])`
    requestedChecks.push(condition)
    if (anchored) {
      details.push(condition)
      if (!(RANKING.broadStyles as readonly string[]).includes(style)) designDetails.push(condition)
    }
  }
  for (const mood of intent.moods) requestedChecks.push(`(moods @> array[${p.add(mood)}]::text[])`)
  // "free" (or "pro") typed in the query is a preference, not a filter: matching cards rank first, then the
  // others ("aqiqa invitation free": the free aqiqa cards, then the PRO ones). Only the sidebar Free / PRO option
  // hides the other kind.
  const priceMatch = intent.isFree !== null && !filters.price ? `(is_free = ${p.add(intent.isFree)})::int` : '0'

  const structured =
    !!occDef || intent.themes.length > 0 || intent.assets.length > 0 || intent.colors.length > 0 || intent.styles.length > 0 ||
    !!intent.format || !!intent.docType || !!intent.gender || intent.moods.length > 0 ||
    !!intent.language || !!intent.hasPhoto
  // Words in other scripts count as typed words too, so "عيد مبارك" is never read as browsing everything.
  // Dates and times ("november 21", "5:00") are left out: their numbers would match 21st birthdays and printed times.
  const allWords = queryText(withoutDatesAndTimes(query)).split(' ')
  const queryWords = allWords.filter((w) => w && !['invitation', 'invitations', 'template', 'card', 'invite'].includes(w) && !isDateWord(w) && !isRsvpWord(w))
  const textQuery = orTsQuery(queryWords)
  // When nothing in the query was understood (AI may return an empty reading for "zxqv blorf"),
  // the typed words themselves must match, so search never falls back to every template.
  const keywords = (structured || intent.keywords.length > 0 ? intent.keywords : queryWords).filter((k) => !k.split(' ').some(isRsvpWord))
  const tsq = textQuery ? `to_tsquery('english', search_unaccent(${p.add(textQuery)}))` : null

  // Wording the vocabulary has no term for ("timeline", "barn") still says what is wanted, with synonyms
  // (timeline = program = itinerary…). With an occasion, cards that have it rank first, like any detail.
  const concepts = keywordConcepts(normalizeQuery(query), asksJoint ? keywords.filter((k) => !JOINT_WORDS.includes(k)) : keywords)
  if (anchored) {
    for (const forms of concepts) {
      const condition = `search_vector @@ ${tsAny(p, forms)}`
      details.push(condition)
      requestedChecks.push(condition)
    }
  }

  // Free-text query the rules could not map: require a text or fuzzy name match.
  const keywordOnly = !structured && keywords.length > 0
  if (keywordOnly) {
    const kw = p.add(keywords.join(' '))
    // Or close in meaning to this query's best match ("farewell for a colleague" → office farewell luncheon).
    const semanticMatch = meaning ? ` or ${meaning.isMatch}` : ''
    const synonyms = concepts.filter((c) => c.length > 1).map((forms) => ` or search_vector @@ ${tsAny(p, forms)}`).join('')
    where.push(`(search_vector @@ to_tsquery('english', search_unaccent(${p.add(orTsQuery(keywords))})) or word_similarity(${kw}, lower(name)) > 0.5${synonyms}${semanticMatch})`)
  }

  // ---- User-selected filters ---------------------------------------------
  // Each group becomes a yes/no column. Results need every group; a group's own counts
  // ignore that group, so its other options stay visible. Values within a group are OR-ed.
  const selectedOccasions = (filters.occasions ?? []).flatMap((o) => occasionFamily(o))
  const groupOccasions = groupedOccasions.filter((t) => chosenGroups.includes(groupIdOf(t))).map((t) => t.id)
  const filterFlags: Record<FilterGroup, string> = {
    occasionGroup: groupOccasions.length ? `coalesce(${inOccasions(p.add(groupOccasions))}, false)` : 'true',
    occasion: selectedOccasions.length ? `coalesce(${inOccasions(p.add(selectedOccasions))}, false)` : 'true',
    themes: filters.themes?.length ? `themes && ${p.add(filters.themes)}::text[]` : 'true',
    styles: filters.styles?.length ? `styles && ${p.add(filters.styles)}::text[]` : 'true',
    colors: filters.colors?.length ? `colors && ${p.add(filters.colors)}::text[]` : 'true',
    docType: filters.docTypes?.length ? `coalesce(doc_type = any(${p.add(filters.docTypes)}::text[]), false)` : 'true',
    gender: filters.genders?.length ? `coalesce(gender, 'neutral') = any(${p.add(filters.genders)}::text[])` : 'true',
    assets: filters.assets?.length ? `assets && ${p.add(filters.assets)}::text[]` : 'true',
    moods: filters.moods?.length ? `moods && ${p.add(filters.moods)}::text[]` : 'true',
    language: filters.languages?.length ? `languages && ${p.add(filters.languages)}::text[]` : 'true',
    photo: filters.photo ? `has_photo = ${p.add(filters.photo === 'with')}` : 'true',
    milestone: filters.milestones?.length ? `coalesce(milestone = any(${p.add(filters.milestones)}::int[]), false)` : 'true',
    price: filters.price ? `is_free = ${p.add(filters.price === 'free')}` : 'true',
    orientation:
      filters.orientation === 'landscape' ? 'is_portrait = false' : filters.orientation === 'portrait' ? 'is_portrait is not false' : 'true',
  }
  const passes = (except?: FilterGroup) =>
    FILTER_GROUPS.filter((g) => g !== except).map((g) => `f_${g}`).join(' and ')

  // How many of the selected themes, styles and colors a template has: templates with
  // more of them ("common") come before those with just one ("individual").
  const overlap = (column: string, values?: string[]) =>
    values?.length ? `cardinality(array(select unnest(${column}) intersect select unnest(${p.add(values)}::text[])))` : '0'
  const selectionHits = [
    overlap('themes', filters.themes),
    overlap('assets', filters.assets),
    overlap('styles', filters.styles),
    overlap('moods', filters.moods),
    overlap('colors', filters.colors),
  ].join(' + ')

  // ---- Relevance ---------------------------------------------------------
  const keywordRank = tsq ? `least(1, ts_rank_cd(search_vector, ${tsq}, 32) * ${RANKING.textRankScale})` : '0'
  const textRank = keywordRank
  const meaningRank = meaning ? meaning.score : '0'
  const attributeChecks: string[] = [
    ...intent.themes.map((t) => `(themes @> array[${p.add(t)}]::text[])::int`),
    ...intent.assets.map((a) => `(assets @> array[${p.add(a)}]::text[])::int`),
    ...(intent.gender ? [`coalesce(gender = ${p.add(intent.gender)}, false)::int`] : []),
    ...intent.colors.map((c) => `(colors @> array[${p.add(c)}]::text[])::int`),
    ...intent.styles.map((s) => `(styles @> array[${p.add(s)}]::text[])::int`),
    ...intent.moods.map((m) => `(moods @> array[${p.add(m)}]::text[])::int`),
    // 41% of templates have no format: a missing value is "no match", not unknown (NULL would drop the card).
    ...(intent.format ? [`coalesce(format = ${p.add(intent.format)}, false)::int`] : []),
  ]
  const attributes = attributeChecks.length ? `((${attributeChecks.join(' + ')})::real / ${attributeChecks.length})` : '1'
  const occasionScore = occDef
    ? `(case when occasion = ${p.add(occDef.id)} then 1 when occasion = any(${p.add(occasionFamily(occDef.id))}) then 0.9
             when extra_occasions && ${p.add(occasionFamily(occDef.id))}::text[] then ${RANKING.extraOccasionScore} else 0.4 end)
         * (0.6 + 0.4 * occasion_confidence)`
    : '0'

  let relevance: string
  if (!textQuery && !structured) {
    // Browsing, or nothing left to score ("no rsvp" once the RSVP words are set aside). The query vector is still a
    // parameter, so it is referenced once (a constant check) to give it a type.
    relevance = meaning ? `(case when ${meaning.vector} is null then 0 else 1 end)` : '1'
  } else if (keywordOnly) {
    const kw = p.add(keywords.join(' '))
    const w = meaning ? RANKING.keywordOnlyWithMeaning : { ...RANKING.keywordOnly, meaning: 0 }
    relevance = `(${w.text} * ${textRank} + ${w.nameSimilarity} * word_similarity(${kw}, lower(name)) + ${w.meaning} * ${meaningRank})`
  } else {
    const w = meaning ? RANKING.structuredWithMeaning : { ...RANKING.structured, meaning: 0 }
    const occWeight = occDef ? w.occasion : 0
    const total = occWeight + w.attributes + w.text + w.meaning
    relevance = `((${occWeight} * ${occasionScore} + ${w.attributes} * ${attributes} + ${w.text} * ${textRank} + ${w.meaning} * ${meaningRank}) / ${total})`
  }

  // Relevance tiers, ranked before the score: for "5th Wedding Anniversary", first 5th wedding anniversary
  // cards, then other wedding anniversary cards, then general anniversary cards (5th ones first).
  // Within a tier, the score (meaning, freshness, quality…) decides.
  // 1. how close the occasion is (asked one, then its parent), 2. how many asked design details the card has
  // (dinosaur, pink, floral, "halloween" in "halloween wedding"), 3. for an asked age: exact, then other printed
  // ages nearest first, then no age, 4. other asked details (card type, language, other words).
  // An occasion with its own age ("debut" is an 18th, "quinceañera" a 15th) and no age asked: see milestoneState.
  const impliedAge = !intent.milestone && occDef ? OCCASION_AGES[occDef.id] : undefined
  // Built only when used: an unused parameter has no type and fails the query (weak occasions have no tier).
  const inParent = () => (ancestors.length ? `occasion = any(${p.add(ancestors)}::text[])` : 'false')
  // With an implied age, a card of the occasion printed with another age (a 21st debut) is a weaker match than a
  // parent-occasion card with that age (an 18th birthday): debut cards (18th or no age) → 18th birthdays →
  // 21st debut → other birthdays.
  const tier = occDef && !weakOccasion
    ? impliedAge
      ? `(case when ${inOccasions(p.add(occasionFamily(occDef.id)))} then
                 (case when milestone is null or milestone = ${p.add(impliedAge)} then 2 else 1 end)
               when ${inParent()} then (case when milestone = ${p.add(impliedAge)} then 1 else 0 end) else -1 end)`
      : `(case when ${inOccasions(p.add(occasionFamily(occDef.id)))} then 2 when ${inParent()} then 1 else 0 end)`
    : '0'
  // "birthday": Quinceañera and Debut cards after the other birthday cards (see RANKING.separateKinds), unless
  // the asked age is theirs ("15th birthday").
  const separateKinds = occDef && !weakOccasion
    ? RANKING.separateKinds.filter((k) =>
        k !== occDef.id && occasionFamily(occDef.id).includes(k) && OCCASION_AGES[k] !== intent.milestone)
    : []
  const separateKind = separateKinds.length ? `(occasion = any(${p.add(separateKinds)}::text[]))::int` : '0'
  const detailChecks = [...details]
  const designChecks = [...designDetails]
  for (const occasion of intent.alsoOccasions) {
    // "halloween" in "halloween 30th birthday" is part of the design, like a theme.
    const condition = inOccasions(p.add(occasionFamily(occasion)))
    detailChecks.push(condition)
    designChecks.push(condition)
    requestedChecks.push(condition)
  }
  // Everything else asked (card type, language, format, other words): ranks after the age.
  const otherChecks = detailChecks.filter((c) => c !== milestoneDetail && !designChecks.includes(c))
  const hits = (checks: string[]) => (checks.length ? checks.map((c) => `coalesce(${c}, false)::int`).join(' + ') : '0')
  const detailHits = hits(detailChecks)
  const assetHits = hits(assetChecks.filter((c) => designChecks.includes(c)))
  // What the card is about (asked themes and elements) ranks before the rest of the design, so a weaker detail
  // ("colorful", on thousands of cards) can never stand in for the asked subject: for "colorful dinosaur 3rd
  // birthday", every dinosaur card (any age) comes before a colorful 3rd birthday without a dinosaur.
  // Elements count extra: the object itself ("dinosaur") matters most.
  const subjectChecks = themeOrAsset.filter((c) => designChecks.includes(c) && !broadThemeChecks.includes(c))
  const subjectHits = `(${hits(subjectChecks)} + (${assetHits}) * ${RANKING.assetPriorityWeight})`
  // Parameters are added only when used: an unused one has no type and fails the query.
  const subjectTagHits = subjectChecks.length
    ? hits(subjectTags.map((t) => `(${t.column} @> array[${p.add(t.id)}]::text[])`))
    : '0'
  // Among cards with the asked element, the ones listing it first ("sheep" card before a farm card with a sheep).
  const askedElements = subjectChecks.length ? intent.assets : []
  const subjectLead = askedElements.length
    ? askedElements.map((a) => `coalesce(array_position(assets, ${p.add(a)}) <= ${RANKING.mainElementTags}, false)::int`).join(' + ')
    : '0'
  const designHits = hits(designChecks.filter((c) => !subjectChecks.includes(c)))
  const otherHits = hits(otherChecks)
  const requestedHits = requestedChecks.length
    ? requestedChecks.map((c) => `coalesce(${c}, false)::int`).join(' + ')
    : '0'
  const sameOccasion = occDef ? `coalesce(${inOccasions(p.add(occasionFamily(occDef.id)))}, false)` : 'false'
  const directOccasionCheck = occDef ? 'same_occasion' : 'true'
  // Asked age first, then other printed ages closest to it (55th before 20th for "50th"), then cards with no age.
  // An implied age works the same ("free debutante": 18th, then 17th/19th/21st… birthdays, then no age); the
  // occasion's own cards with no age already come first by the tier.
  const age = intent.milestone ?? impliedAge
  const milestoneState = age
    ? `(case when milestone = ${p.add(age)} then 2 when milestone is not null then 1 else 0 end)`
    : '0'
  const milestoneDistance = age
    ? `(case when milestone is null then 2147483647 else abs(milestone - ${p.add(age)}) end)`
    : '0'
  // Ages equally far keep together, younger first: 80th cards, then 100th cards for a "90th".
  const ageTie = age ? 'coalesce(milestone, 2147483647)' : '0'

  const freshness = `exp(-ln(2) * extract(epoch from (now() - created_at)) / 86400 / ${RANKING.freshnessHalfLifeDays})`
  const milestoneBonus = intent.milestone ? `(case when milestone = ${p.add(intent.milestone)} then ${RANKING.milestoneBonus} else 0 end)` : '0'
  // Cards that also fit the query's other occasions ("halloween" in "halloween wedding") come first.
  const alsoBonus = intent.alsoOccasions.length
    ? intent.alsoOccasions.map((o) => `(case when ${inOccasions(p.add(occasionFamily(o)))} then ${RANKING.alsoOccasionBonus} else 0 end)`).join(' + ')
    : '0'
  // "thanksgiving card": for holidays and greetings, a card is usually a greeting, so greetings come first.
  // Only a preference: invitations still follow, and an asked color or theme still ranks higher.
  const queryNormal = normalizeText(query).split(' ')
  const saysCard = queryNormal.some((w) => w === 'card' || w === 'cards')
  // "birthday invitation card" asks for an invitation.
  const saysInvitation = queryNormal.some((w) => ['invitation', 'invitations', 'invite', 'invites', 'invitacion', 'invitaciones'].includes(w))
  const greetingBonus =
    saysCard && !saysInvitation && !intent.docType && occDef && (CARD_MEANS_GREETING_GROUPS as readonly string[]).includes(occDef.group)
      ? `(case when doc_type = 'greeting' then ${RANKING.cardGreetingBonus} else 0 end)`
      : '0'
  // Zodiac cards fit any birthday by meaning and are new; unless the query or a sidebar pick asks for them, they
  // come after the other cards that match equally well.
  const paddedQuery = ` ${normalizeQuery(query)} `
  const picked = [...(filters.themes ?? []), ...(filters.assets ?? [])]
  const unaskedNiche = NICHE_DESIGNS.filter(
    (n) => !n.words.some((w) => paddedQuery.includes(` ${w} `)) && !n.tags.some((t) => picked.includes(t)) &&
      !intent.themes.some((t) => n.tags.includes(t)) && !intent.assets.some((a) => n.tags.includes(a)),
  )
  const niche = unaskedNiche.length
    ? `(${unaskedNiche.map((n) => `(themes && ${p.add(n.tags)}::text[] or assets && ${p.add(n.tags)}::text[] or name ~* ${p.add(n.namePattern)})`).join(' or ')})::int`
    : '0'
  const { weights } = RANKING

  const pageSize = RANKING.pageSize
  const offset = (Math.max(1, page) - 1) * pageSize

  const sql = `
    with matched as (
      select template_id, name, preview_url, is_free, is_portrait, created_at, occasion, milestone,
             gender, themes, assets, styles, colors, doc_type, format, moods, extra_occasions, languages, has_photo,
             ${relevance} as relevance, ${freshness} as freshness, quality_score as quality,
             ${milestoneBonus} + ${alsoBonus} + ${greetingBonus} as milestone_bonus, ${textRank} as text_rank, ${tier} as tier,
             ${detailHits} as detail_hits,
             ${separateKind} as separate_kind, ${subjectHits} as subject_hits, ${subjectTagHits} as subject_tags, ${subjectLead} as subject_lead,
             ${designHits} as design_hits, ${colorStrength} as color_strength, ${priceMatch} as price_match, ${otherHits} as other_hits, ${niche} as niche,
             ${requestedHits} as requested_hits, ${sameOccasion} as same_occasion,
             ${milestoneState} as milestone_state, ${milestoneDistance} as milestone_distance, ${ageTie} as age_tie,
             ${selectionHits} as selection_hits, ${occasionWhere ? `coalesce(${occasionWhere}, false)` : 'true'} as on_occasion,
             ${FILTER_GROUPS.map((g) => `${filterFlags[g]} as f_${g}`).join(', ')}
        from template_search t
       ${where.length ? `where ${where.join('\n         and ')}` : ''}
    ),
    scored as (
      select *, ${weights.relevance} * relevance + ${weights.freshness} * freshness + ${weights.quality} * quality + milestone_bonus as score
        from matched where relevance >= ${RANKING.minRelevance}
         and (on_occasion or (select count(*) from matched where on_occasion and relevance >= ${RANKING.minRelevance}) < ${RANKING.thinOccasionResults})
    ),
    -- Inside a tier, cards whose match (relevance + bonuses) is within one band of the tier's best count as
    -- equally relevant, so newer and better designs lead among them. Weaker matches keep the normal score.
    final as (
      select *, least(${weights.relevance} * relevance + milestone_bonus,
                      max(${weights.relevance} * relevance + milestone_bonus)
                        over (partition by selection_hits, tier, separate_kind, subject_hits, subject_tags, subject_lead, design_hits, color_strength, price_match, milestone_state, other_hits) - ${RANKING.relevanceBand})
                + ${weights.freshness} * freshness + ${weights.quality} * quality as banded_score
        from scored where ${passes()}
    ),
    -- The best-matching results (asked occasion and every asked detail) for tag suggestions, so "dinosaur
    -- birthday" suggests within dinosaur birthdays. Too few of them (four 5th anniversaries) → the asked occasion.
    -- With an asked occasion, only its cards count: cards added to fill a thin page ("pizza kitty party" has 3
    -- kitty party cards, filled with kids birthdays) never decide the tags.
    -- Quinceañera and Debut cards never decide the tags of a plain "birthday" (they rank after the others too).
    base as (select * from final where ${occDef ? 'same_occasion' : 'true'} and separate_kind = 0),
    best as (select max(tier) mt, max(detail_hits) mh from base),
    top_rows as (select f.* from base f, best b where f.tier = b.mt and f.detail_hits = b.mh),
    -- The cards that match everything asked, when there are enough. Otherwise (three 65th cards, or no card has
    -- the asked "47th" or "effect") the first results, never the whole occasion.
    whole as (select (select count(*) from top_rows) >= ${RANKING.suggestions.minResults} and (select mh from best) >= ${detailChecks.length} as ok),
    focus as (
      select * from top_rows where (select ok from whole)
      union all
      select * from (
        select f.* from base f, best b where f.tier = b.mt and not (select ok from whole)
         order by ${RANK_ORDER} limit ${RANKING.suggestions.focusFallback}) near
    )
    select
      (select count(*) from final)::int as total,
      (select count(*) from focus)::int as focus_total,
      (select count(*) from final where tier = ${occDef && !weakOccasion ? 2 : 0} and detail_hits = ${detailChecks.length})::int as exact_total,
      (select count(*) from final where ${directOccasionCheck} and requested_hits = ${requestedChecks.length})::int as direct_count,
      (select count(*) from final where same_occasion and ${requestedChecks.length > 0 ? 'requested_hits = 0' : 'false'})::int as occasion_only_count,
      (select coalesce(json_agg(json_build_object('g', g, 'id', v, 'count', c, 'fit', fit)), '[]') from (
         select 'occasion' g, o v, count(*)::int c, avg(relevance)::real fit
           from focus, unnest(array_remove(array[occasion] || extra_occasions, null)) o group by o
         union all select 'themes', v, count(*)::int, null from focus, unnest(themes) v group by v
         union all select 'assets', v, count(*)::int, null from focus, unnest(assets) v group by v
         union all select 'styles', v, count(*)::int, null from focus, unnest(styles) v group by v
         union all select 'colors', v, count(*)::int, null from focus, unnest(colors) v group by v
         union all select 'moods', v, count(*)::int, null from focus, unnest(moods) v group by v
         union all select 'languages', v, count(*)::int, null from focus, unnest(languages) v group by v
         union all select 'gender', coalesce(gender, 'neutral'), count(*)::int, null from focus group by 2
         union all select 'milestones', milestone::text, count(*)::int, null from focus where milestone is not null group by 2
         union all select 'photo', 'with', count(*)::int, null from focus where has_photo
       ) x) as focus_facets,
      (select coalesce(json_agg(json_build_object('id', grp, 'count', c, 'fit', fit)), '[]') from (
         select grp, count(*)::int c, avg(relevance)::real fit from (
           select distinct f.template_id, f.relevance, m.grp
             from final f, unnest(array_remove(array[f.occasion] || f.extra_occasions, null)) o,
                  unnest(${p.add(groupedOccasions.map((t) => t.id))}::text[], ${p.add(groupedOccasions.map(groupIdOf))}::text[]) m(occ, grp)
            where m.occ = o) g
          group by grp order by c desc) x) as groups,
      (select coalesce(json_agg(r), '[]') from (
         select * from final
           order by ${RANK_ORDER}
          limit ${pageSize} offset ${offset}) r) as results,
      (select coalesce(json_agg(json_build_object('id', occasion, 'count', c, 'format', f, 'fit', fit)), '[]') from (
         select o as occasion, count(*)::int c, mode() within group (order by format) f, avg(relevance)::real fit
           from scored, unnest(array_remove(array[occasion] || extra_occasions, null)) o
          where ${passes('occasion')} group by o order by c desc) x) as occasions,
      (select coalesce(json_agg(json_build_object('id', v, 'count', c)), '[]') from (
         select unnest(themes) v, count(*)::int c from scored where ${passes('themes')} group by v order by c desc limit 30) x) as themes,
      (select coalesce(json_agg(json_build_object('id', v, 'count', c)), '[]') from (
         select unnest(assets) v, count(*)::int c from scored where ${passes('assets')} group by v order by c desc limit 30) x) as assets,
      (select coalesce(json_agg(json_build_object('id', v, 'count', c)), '[]') from (
         select coalesce(gender, 'neutral') v, count(*)::int c from scored where ${passes('gender')} group by v order by c desc) x) as genders,
      (select coalesce(json_agg(json_build_object('id', v, 'count', c)), '[]') from (
         select unnest(styles) v, count(*)::int c from scored where ${passes('styles')} group by v order by c desc) x) as styles,
      (select coalesce(json_agg(json_build_object('id', v, 'count', c)), '[]') from (
         select unnest(colors) v, count(*)::int c from scored where ${passes('colors')} group by v order by c desc) x) as colors,
      (select coalesce(json_agg(json_build_object('id', v, 'count', c)), '[]') from (
         select unnest(moods) v, count(*)::int c from scored where ${passes('moods')} group by v order by c desc) x) as moods,
      (select coalesce(json_agg(json_build_object('id', v, 'count', c)), '[]') from (
         select unnest(languages) v, count(*)::int c from scored where ${passes('language')} group by v order by c desc) x) as languages,
      (select json_build_object('with', count(*) filter (where has_photo), 'without', count(*) filter (where not has_photo))
         from scored where ${passes('photo')}) as photo_counts,
      (select coalesce(json_agg(json_build_object('id', v::text, 'count', c)), '[]') from (
         select milestone v, count(*)::int c from scored where milestone is not null and ${passes('milestone')}
          group by v order by c desc limit 15) x) as milestones,
      (select coalesce(json_agg(json_build_object('id', v, 'count', c)), '[]') from (
         select doc_type v, count(*)::int c from scored where doc_type is not null and ${passes('docType')} group by v order by c desc) x) as doc_types,
      (select json_build_object('free', count(*) filter (where is_free), 'premium', count(*) filter (where not is_free))
         from scored where ${passes('price')}) as price_counts,
      (select json_build_object('portrait', count(*) filter (where is_portrait is not false),
                                'landscape', count(*) filter (where is_portrait = false))
         from scored where ${passes('orientation')}) as orientation_counts`

  const { rows } = await db.query(sql, p.values)
  const row = rows[0]

  type RawResult = {
    template_id: number; name: string; preview_url: string; is_free: boolean; is_portrait: boolean | null
    created_at: string; occasion: string | null; milestone: number | null; themes: string[]; doc_type: string | null
    gender: string | null; assets: string[]; moods: string[]; extra_occasions: string[]; languages: string[]; has_photo: boolean
    score: number; relevance: number; freshness: number; quality: number; milestone_bonus: number; text_rank: number
  }
  const round = (n: number) => Math.round(n * 1000) / 1000
  const results: SearchResultItem[] = (row.results as RawResult[]).map((r) => ({
    id: r.template_id,
    name: r.name || (r.occasion ? labelFor(vocab, 'occasion', r.occasion) : '') || 'Untitled template',
    previewUrl: r.preview_url,
    isFree: r.is_free,
    isPortrait: r.is_portrait,
    createdAt: r.created_at,
    occasion: r.occasion,
    occasionLabel: r.occasion ? labelFor(vocab, 'occasion', r.occasion) : null,
    milestone: r.milestone,
    gender: r.gender,
    themes: r.themes,
    assets: r.assets,
    moods: r.moods,
    extraOccasions: r.extra_occasions,
    languages: r.languages,
    hasPhoto: r.has_photo,
    docType: r.doc_type,
    score: round(r.score),
    debug: {
      relevance: round(r.relevance),
      freshness: round(r.freshness),
      quality: round(r.quality),
      milestoneBonus: round(r.milestone_bonus),
      textRank: round(r.text_rank),
    },
  }))

  const label = (map: Map<string, { label: string }>) => (f: { id: string; count: number }): FacetValue => ({
    id: f.id,
    label: map.get(f.id)?.label ?? f.id,
    count: f.count,
  })
  const vocabLabel = (kind: VocabKind) => (f: { id: string; count: number }): FacetValue => ({
    id: f.id,
    label: labelFor(vocab, kind, f.id),
    count: f.count,
  })
  // Events whose cards fit the search words better come first among events of similar size.
  const fitScore = (x: { count: number; fit?: number | null }) => Math.sqrt(x.count) * (x.fit ?? 0)
  const occasionCounts = row.occasions as { id: string; count: number; format: string | null; fit: number | null }[]

  // Quick tags: when the query does not name a clear occasion, offer the occasions that have results.
  // A typed event ("kitty party") is clear even when matched loosely; a broad family ("anniversary") is not.
  let quickTags: QuickTag[] = []
  const ambiguous = !namedEvent && (!strictOccasion || !!strictOccasion.abstract)
  if (ambiguous && !filters.occasions?.length && occasionCounts.length > 1 && (query.trim() || chosenGroups.length)) {
    const formatLabel = intent.format ? FORMAT_BY_ID.get(intent.format)?.label : undefined
    // Inside a chosen group ("Parties"), only its own events: not the other occasions its cards also fit.
    const inGroup = new Set(groupOccasions)
    const options = (chosenGroups.length ? occasionCounts.filter((o) => inGroup.has(o.id)) : occasionCounts)
      .slice()
      .sort((a, b) => fitScore(b) - fitScore(a))
    quickTags = options.slice(0, RANKING.maxQuickTags).map((o) => {
      const occLabel = labelFor(vocab, 'occasion', o.id)
      // "Birthday Dinner" reads well; long labels ("Indian Festivals & Ceremonies") stay as they are.
      const showFormat =
        formatLabel && !occLabel.includes('&') && !occLabel.toLowerCase().includes(formatLabel.toLowerCase())
      return { occasion: o.id, label: showFormat ? `${occLabel} ${formatLabel}` : occLabel, count: o.count }
    })
  }

  const priceCounts = row.price_counts as { free: number; premium: number }
  const orientationCounts = row.orientation_counts as { portrait: number; landscape: number }
  const photoCounts = row.photo_counts as { with: number; without: number }
  const facets: SearchResponse['facets'] = {
    occasion: occasionCounts.map((o) => ({ ...vocabLabel('occasion')(o), fit: o.fit ?? undefined })),
    themes: (row.themes as FacetValue[]).map(vocabLabel('theme')),
    styles: (row.styles as FacetValue[]).map(vocabLabel('style')),
    colors: (row.colors as FacetValue[]).map(label(COLOR_BY_ID)),
    docType: (row.doc_types as FacetValue[]).map(label(DOC_TYPE_BY_ID)),
    gender: (row.genders as FacetValue[]).map(label(GENDER_BY_ID)),
    assets: (row.assets as FacetValue[]).map(vocabLabel('asset')),
    moods: (row.moods as FacetValue[]).map(label(MOOD_BY_ID)),
    languages: (row.languages as FacetValue[]).map(label(LANGUAGE_BY_ID)),
    photo: [
      { id: 'with', label: 'With photo', count: photoCounts.with },
      { id: 'without', label: 'Without photo', count: photoCounts.without },
    ],
    milestones: (row.milestones as { id: string; count: number }[]).map((m) => ({ id: m.id, label: ordinal(Number(m.id)), count: m.count })),
    // No Free / PRO option in the sidebar when price filtering is off.
    price: priceFilter
      ? [
          { id: 'free', label: 'Free', count: priceCounts.free },
          { id: 'premium', label: 'PRO', count: priceCounts.premium },
        ]
      : [],
    orientation: [
      { id: 'portrait', label: 'Portrait', count: orientationCounts.portrait },
      { id: 'landscape', label: 'Landscape', count: orientationCounts.landscape },
    ],
  }
  // Tag suggestions count only the best-matching results (see the focus query).
  const focusRows = row.focus_facets as { g: string; id: string; count: number; fit: number | null }[]
  const focusOf = (g: string, toLabel: (f: { id: string; count: number; fit: number | null }) => FacetValue) =>
    focusRows.filter((f) => f.g === g).sort((a, b) => b.count - a.count).map(toLabel)
  const focusFacets: SearchResponse['facets'] = {
    ...facets,
    occasion: focusOf('occasion', (f) => ({ ...vocabLabel('occasion')(f), fit: f.fit ?? undefined })),
    themes: focusOf('themes', vocabLabel('theme')),
    assets: focusOf('assets', vocabLabel('asset')),
    styles: focusOf('styles', vocabLabel('style')),
    colors: focusOf('colors', label(COLOR_BY_ID)),
    moods: focusOf('moods', label(MOOD_BY_ID)),
    languages: focusOf('languages', label(LANGUAGE_BY_ID)),
    gender: focusOf('gender', label(GENDER_BY_ID)),
    milestones: focusOf('milestones', (m) => ({ id: m.id, label: ordinal(Number(m.id)), count: m.count })),
    photo: focusOf('photo', (f) => ({ id: 'with', label: 'With photo', count: f.count })),
  }
  const suggested = await suggestTags({ facets: focusFacets, total: row.focus_total, intent, filters, appliedOccasion: strictOccasion?.id ?? null, vocab, browsing: !query.trim() && activeTags(filters, vocab).length === 0 })
  // A query that names no event ("pizza", "dinner invitation") first asks what kind of event: Birthday,
  // Parties, Business & Community. A group whose results are nearly all one occasion shows that occasion.
  // Tapping a group ("Parties") then offers its events (Kitty Party, Sleepover, Food Party) as quick tags.
  const cfg = RANKING.suggestions
  let groupTags: SuggestedTag[] = []
  if (!occDef && !filters.occasions?.length && !chosenGroups.length && query.trim()) {
    const groupOf = new Map(groupedOccasions.map((t) => [t.id, groupIdOf(t)]))
    groupTags = (row.groups as { id: string; count: number; fit: number | null }[])
      .filter((g) => g.count >= cfg.minCount && OCCASION_GROUP_BY_ID.has(g.id))
      .sort((a, b) => fitScore(b) - fitScore(a))
      .slice(0, cfg.groups.groups.max)
      .map((g) => {
        const top = occasionCounts.filter((o) => groupOf.get(o.id) === g.id).sort((a, b) => b.count - a.count)[0]
        return top && top.count >= g.count * cfg.singleOccasionGroupShare
          ? { group: 'occasions' as const, value: top.id, label: labelFor(vocab, 'occasion', top.id), count: top.count }
          : { group: 'groups' as const, value: g.id, label: groupLabel(vocab, g.id), count: g.count }
      })
  }
  const suggestedTags: SuggestedTag[] = groupTags.length > 1
    ? [...groupTags, ...suggested.filter((t) => t.group !== 'occasions').slice(0, cfg.afterOccasionTags)]
    : quickTags.length
    ? [
        ...quickTags
          .filter((t) => t.count >= (chosenGroups.length ? cfg.minCountInGroup : cfg.minCount))
          .map((t) => ({ group: 'occasions' as const, value: t.occasion, label: t.label, count: t.count })),
        ...suggested.filter((t) => t.group !== 'occasions').slice(0, RANKING.suggestions.afterOccasionTags),
      ]
    : suggested
  return {
    searchId: null,
    query,
    intent,
    appliedOccasion: strictOccasion?.id ?? null,
    total: row.total,
    exactTotal: row.exact_total,
    matchCounts: {
      direct: row.direct_count,
      partial: row.total - row.direct_count - row.occasion_only_count,
      occasionOnly: row.occasion_only_count,
    },
    page,
    pageSize,
    results,
    facets,
    quickTags,
    suggestedTags,
    activeTags: activeTags(filters, vocab),
  }
}

export type { SearchIntent }
