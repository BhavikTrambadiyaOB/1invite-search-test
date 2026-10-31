import { db } from '../db'
import { RANKING } from './ranking'
import { isAiEnabled } from './ai-config'
import { hasEmbeddingColumn, queryEmbedding } from './embeddings'
import { isDateWord, normalizeQuery, stripQueryNoise } from './parse-query'
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
  CARD_MEANS_GREETING_GROUPS,
  type OccasionDef,
  type SimpleDef,
} from './taxonomy'
import { keywordConcepts } from './keyword-concepts'
import { suggestTags } from './suggest-tags'
import { normalizeText, ordinal, queryText } from './text'
import type { ActiveTag, FacetValue, QuickTag, SuggestedTag, SearchFilters, SearchIntent, SearchResponse, SearchResultItem } from './types'

const FILTER_GROUPS = [
  'occasion', 'milestone', 'themes', 'assets', 'styles', 'moods', 'colors', 'docType', 'gender', 'language', 'photo', 'price', 'orientation',
] as const
type FilterGroup = (typeof FILTER_GROUPS)[number]

const EXCLUDED_CATALOG_IDS = [1058, 1079, 1081, 1082, 1083, 1084, 1088, 2186] as const

function catalogExclusion(templateAlias: string) {
  return `not exists (
    select 1 from images i
     where i.id = ${templateAlias}.template_id
       and i.catalog_id = any(array[${EXCLUDED_CATALOG_IDS.join(', ')}]::int[])
  )`
}

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
    hasPhoto: has('photo') ? null : intent.hasPhoto,
  }
}

/** The applied filters as labelled chips (Birthday, 30th, Dinosaurs, With photo…). */
function activeTags(filters: SearchFilters, vocab: Awaited<ReturnType<typeof getVocabulary>>): ActiveTag[] {
  const of = (group: ActiveTag['group'], values: string[] | undefined, toLabel: (v: string) => string) =>
    (values ?? []).map((value) => ({ group, value, label: toLabel(value) }))
  return [
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

export async function searchTemplates({ query: rawQuery, filters = {}, page = 1, ignore = [] }: SearchInput): Promise<SearchResponse> {
  // A pasted chat prefix ("[27/05, 1:14 pm] name: ") is not part of what the person wants.
  const query = stripQueryNoise(rawQuery)
  const read = withoutIgnored(await resolveIntent(query), ignore)
  // Date parts ("10 juin", "june 7") never have to appear on a design.
  const intent = { ...read, keywords: read.keywords.filter((k) => !k.split(' ').every((w) => isDateWord(w) || /^\d+(st|nd|rd|th)?$/.test(w))) }
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
  let meaning: { similarity: string; score: string; isMatch: string } | null = null
  if (qvec) {
    const best = await bestSimilarity(qvec)
    if (best !== null && best >= sem.minBest) {
      const similarity = `(1 - (embedding <=> ${p.add(qvec)}::vector))`
      const floor = Math.max(sem.floor, best - sem.window)
      meaning = {
        similarity,
        score: `least(1, greatest(0, (coalesce(${similarity}, 0) - ${floor}) / ${best - floor}))`,
        isMatch: `coalesce(${similarity}, 0) >= ${Math.max(sem.minMatch, best - sem.matchWithin)}`,
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
  const requestedChecks: string[] = []
  const detail = (condition: string) => {
    requestedChecks.push(condition)
    if (anchored) details.push(condition)
    else where.push(condition)
  }
  if (occDef && weakOccasion) details.push(`(${inOccasions(p.add(occasionFamily(occDef.id)))} or search_vector @@ ${tsAny(p, occDef.phrases)})`)

  // Without an occasion, a different printed milestone is wrong ("50th" card for "5th").
  if (intent.milestone) {
    const milestoneMatch = `(milestone = ${p.add(intent.milestone)})`
    requestedChecks.push(milestoneMatch)
    if (anchored) details.push(milestoneMatch)
    else where.push(`(milestone is null or milestone = ${p.add(intent.milestone)})`)
  }

  const themeOrAsset: string[] = []
  for (const theme of intent.themes) {
    themeOrAsset.push(`(themes @> array[${p.add(theme)}]::text[] or search_vector @@ ${tsAny(p, phrasesFor(vocab, 'theme', theme))})`)
  }
  // A specific object ("basketball", "sushi"): in the design or named in the template.
  for (const asset of intent.assets) {
    themeOrAsset.push(`(assets @> array[${p.add(asset)}]::text[] or search_vector @@ ${tsAny(p, phrasesFor(vocab, 'asset', asset))})`)
  }
  for (const condition of themeOrAsset) detail(condition)
  if (weakOccasion) where.push(`(${themeOrAsset.join(' or ')})`)
  // Gender: drop templates made for the other gender; keep gender-neutral ones (they can be edited).
  if (intent.gender === 'girl' || intent.gender === 'boy') {
    where.push(`coalesce(gender, 'neutral') <> ${p.add(intent.gender === 'girl' ? 'boy' : 'girl')}`)
    requestedChecks.push(`coalesce(gender = ${p.add(intent.gender)}, false)`)
  }
  for (const color of intent.colors) {
    detail(`(colors @> array[${p.add(color)}]::text[] or search_vector @@ ${tsAny(p, defsPhrases(COLOR_BY_ID.get(color)))})`)
  }
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
  if (intent.hasPhoto) detail('has_photo')
  if (intent.language) detail(`(languages @> array[${p.add(intent.language)}]::text[])`)
  for (const style of intent.styles) requestedChecks.push(`(styles @> array[${p.add(style)}]::text[])`)
  for (const mood of intent.moods) requestedChecks.push(`(moods @> array[${p.add(mood)}]::text[])`)
  if (intent.isFree !== null && !filters.price) where.push(`is_free = ${p.add(intent.isFree)}`)

  const structured =
    !!occDef || intent.themes.length > 0 || intent.assets.length > 0 || intent.colors.length > 0 || intent.styles.length > 0 ||
    !!intent.format || !!intent.docType || !!intent.gender || intent.moods.length > 0 ||
    !!intent.language || !!intent.hasPhoto
  // Words in other scripts count as typed words too, so "عيد مبارك" is never read as browsing everything.
  const allWords = queryText(query).split(' ')
  const queryWords = allWords.filter((w) => w && !['invitation', 'invitations', 'template', 'card', 'invite'].includes(w) && !isDateWord(w))
  const textQuery = orTsQuery(queryWords)
  // When nothing in the query was understood (AI may return an empty reading for "zxqv blorf"),
  // the typed words themselves must match, so search never falls back to every template.
  const keywords = structured || intent.keywords.length > 0 ? intent.keywords : queryWords
  const tsq = textQuery ? `to_tsquery('english', search_unaccent(${p.add(textQuery)}))` : null

  // Wording the vocabulary has no term for ("timeline", "barn") still says what is wanted, with synonyms
  // (timeline = program = itinerary…). With an occasion, cards that have it rank first, like any detail.
  const concepts = keywordConcepts(normalizeQuery(query), keywords)
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
  const filterFlags: Record<FilterGroup, string> = {
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
    relevance = '1' // Browsing without a query.
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
  // 1. how close the occasion is (asked one, then its parent), 2. how many asked details the card has
  // (5th, dinosaur, pink, "halloween" in "halloween wedding"), 3. for an asked age: no age printed beats another age.
  const tier = occDef && !weakOccasion
    ? `(case when ${inOccasions(p.add(occasionFamily(occDef.id)))} then 2
             when ${ancestors.length ? `occasion = any(${p.add(ancestors)}::text[])` : 'false'} then 1 else 0 end)`
    : '0'
  const detailChecks = [...details]
  for (const occasion of intent.alsoOccasions) {
    const condition = inOccasions(p.add(occasionFamily(occasion)))
    detailChecks.push(condition)
    requestedChecks.push(condition)
  }
  const detailHits = detailChecks.length ? detailChecks.map((c) => `coalesce(${c}, false)::int`).join(' + ') : '0'
  const requestedHits = requestedChecks.length
    ? requestedChecks.map((c) => `coalesce(${c}, false)::int`).join(' + ')
    : '0'
  const sameOccasion = occDef ? `coalesce(${inOccasions(p.add(occasionFamily(occDef.id)))}, false)` : 'false'
  const directOccasionCheck = occDef ? 'same_occasion' : 'true'
  const milestoneState = intent.milestone
    ? `(case when milestone = ${p.add(intent.milestone)} then 2 when milestone is null then 1 else 0 end)`
    : '0'

  const freshness = `exp(-ln(2) * extract(epoch from (now() - created_at)) / 86400 / ${RANKING.freshnessHalfLifeDays})`
  const milestoneBonus = intent.milestone ? `(case when milestone = ${p.add(intent.milestone)} then ${RANKING.milestoneBonus} else 0 end)` : '0'
  // Cards that also fit the query's other occasions ("halloween" in "halloween wedding") come first.
  const alsoBonus = intent.alsoOccasions.length
    ? intent.alsoOccasions.map((o) => `(case when ${inOccasions(p.add(occasionFamily(o)))} then ${RANKING.alsoOccasionBonus} else 0 end)`).join(' + ')
    : '0'
  // "thanksgiving card": for holidays and greetings, a card is usually a greeting, so greetings come first.
  // Only a preference: invitations still follow, and an asked color or theme still ranks higher.
  const saysCard = normalizeText(query).split(' ').some((w) => w === 'card' || w === 'cards')
  const greetingBonus =
    saysCard && !intent.docType && occDef && (CARD_MEANS_GREETING_GROUPS as readonly string[]).includes(occDef.group)
      ? `(case when doc_type = 'greeting' then ${RANKING.cardGreetingBonus} else 0 end)`
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
             ${detailHits} as detail_hits, ${requestedHits} as requested_hits, ${sameOccasion} as same_occasion,
             ${milestoneState} as milestone_state,
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
                        over (partition by selection_hits, tier, detail_hits, milestone_state) - ${RANKING.relevanceBand})
                + ${weights.freshness} * freshness + ${weights.quality} * quality as banded_score
        from scored where ${passes()}
    ),
    -- The best-matching results (asked occasion and every asked detail) for tag suggestions, so "dinosaur
    -- birthday" suggests within dinosaur birthdays. Too few of them (four 5th anniversaries) → the asked occasion.
    best as (select max(tier) mt, max(detail_hits) mh from final),
    top_rows as (select f.* from final f, best b where f.tier = b.mt and f.detail_hits = b.mh),
    focus as (
      select * from top_rows where (select count(*) from top_rows) >= ${RANKING.suggestions.minResults}
      union all
      select f.* from final f, best b where f.tier = b.mt and (select count(*) from top_rows) < ${RANKING.suggestions.minResults}
    )
    select
      (select count(*) from final)::int as total,
      (select count(*) from focus)::int as focus_total,
      (select count(*) from final where tier = ${occDef && !weakOccasion ? 2 : 0} and detail_hits = ${detailChecks.length})::int as exact_total,
      (select count(*) from final where ${directOccasionCheck} and requested_hits = ${requestedChecks.length})::int as direct_count,
      (select count(*) from final where same_occasion and ${requestedChecks.length > 0 ? 'requested_hits = 0' : 'false'})::int as occasion_only_count,
      (select coalesce(json_agg(json_build_object('g', g, 'id', v, 'count', c)), '[]') from (
         select 'occasion' g, o v, count(*)::int c from focus, unnest(array_remove(array[occasion] || extra_occasions, null)) o group by o
         union all select 'themes', v, count(*)::int from focus, unnest(themes) v group by v
         union all select 'assets', v, count(*)::int from focus, unnest(assets) v group by v
         union all select 'styles', v, count(*)::int from focus, unnest(styles) v group by v
         union all select 'colors', v, count(*)::int from focus, unnest(colors) v group by v
         union all select 'moods', v, count(*)::int from focus, unnest(moods) v group by v
         union all select 'languages', v, count(*)::int from focus, unnest(languages) v group by v
         union all select 'gender', coalesce(gender, 'neutral'), count(*)::int from focus group by 2
         union all select 'milestones', milestone::text, count(*)::int from focus where milestone is not null group by 2
         union all select 'photo', 'with', count(*)::int from focus where has_photo
       ) x) as focus_facets,
      (select coalesce(json_agg(r), '[]') from (
         select * from final
          order by selection_hits desc, tier desc, detail_hits desc, milestone_state desc, banded_score desc, score desc, created_at desc, template_id
          limit ${pageSize} offset ${offset}) r) as results,
      (select coalesce(json_agg(json_build_object('id', occasion, 'count', c, 'format', f)), '[]') from (
         select o as occasion, count(*)::int c, mode() within group (order by format) f
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
  const occasionCounts = row.occasions as { id: string; count: number; format: string | null }[]

  // Quick tags: when the query does not name a clear occasion, offer the occasions that have results.
  let quickTags: QuickTag[] = []
  // A family like "anniversary" also gets tags (Wedding Anniversary, Company Anniversary).
  const ambiguous = !strictOccasion || !!strictOccasion.abstract
  if (ambiguous && !filters.occasions?.length && occasionCounts.length > 1 && query.trim()) {
    const formatLabel = intent.format ? FORMAT_BY_ID.get(intent.format)?.label : undefined
    quickTags = occasionCounts.slice(0, RANKING.maxQuickTags).map((o) => {
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
    occasion: occasionCounts.map(vocabLabel('occasion')),
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
    price: [
      { id: 'free', label: 'Free', count: priceCounts.free },
      { id: 'premium', label: 'PRO', count: priceCounts.premium },
    ],
    orientation: [
      { id: 'portrait', label: 'Portrait', count: orientationCounts.portrait },
      { id: 'landscape', label: 'Landscape', count: orientationCounts.landscape },
    ],
  }
  // Tag suggestions count only the best-matching results (see the focus query).
  const focusRows = row.focus_facets as { g: string; id: string; count: number }[]
  const focusOf = (g: string, toLabel: (f: { id: string; count: number }) => FacetValue) =>
    focusRows.filter((f) => f.g === g).sort((a, b) => b.count - a.count).map(toLabel)
  const focusFacets: SearchResponse['facets'] = {
    ...facets,
    occasion: focusOf('occasion', vocabLabel('occasion')),
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
  // A query that fits many occasions ("Dinner Invitation") first asks which one: Birthday Dinner, Wedding
  // Dinner, Christmas Dinner… Then a few other chips (theme, element…) follow.
  const suggestedTags: SuggestedTag[] = quickTags.length
    ? [
        ...quickTags
          .filter((t) => t.count >= RANKING.suggestions.minCount)
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
