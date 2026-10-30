import { db } from '../db'
import { RANKING } from './ranking'
import { singularPhrase } from './singular'
import { MILESTONE_BIRTHDAYS, OCCASION_AGES } from './taxonomy'
import { normalizeText, ordinal } from './text'
import type { FacetValue, SearchFilters, SearchIntent, SearchResponse, SuggestedTag, TagGroup } from './types'
import { occasionAncestorsFrom, occasionFamilyFrom, type Vocabulary } from './vocabulary'

/** How many templates in the whole catalog have each value, keyed "group:value". */
type CatalogCounts = { total: number; counts: Map<string, number> }

let catalog: { value: Promise<CatalogCounts>; at: number } | null = null
const CATALOG_TTL_MS = 10 * 60 * 1000

/** Catalog-wide counts, so a chip can say how special a value is for this search. Cached for 10 minutes. */
function catalogCounts(): Promise<CatalogCounts> {
  if (catalog && performance.now() - catalog.at < CATALOG_TTL_MS) return catalog.value
  const value = db
    .query<{ k: string; c: number }>(
      `select 'occasions:' || o k, count(*)::int c from template_search, unnest(array_remove(array[occasion] || extra_occasions, null)) o group by o
       union all select 'themes:' || v, count(*)::int from template_search, unnest(themes) v group by v
       union all select 'assets:' || v, count(*)::int from template_search, unnest(assets) v group by v
       union all select 'styles:' || v, count(*)::int from template_search, unnest(styles) v group by v
       union all select 'colors:' || v, count(*)::int from template_search, unnest(colors) v group by v
       union all select 'moods:' || v, count(*)::int from template_search, unnest(moods) v group by v
       union all select 'languages:' || v, count(*)::int from template_search, unnest(languages) v group by v
       union all select 'genders:' || coalesce(gender, 'neutral'), count(*)::int from template_search group by gender
       union all select 'milestones:' || milestone, count(*)::int from template_search where milestone is not null group by milestone
       union all select 'photo:with', count(*)::int from template_search where has_photo
       union all select 'total', count(*)::int from template_search`,
    )
    .then(({ rows }) => {
      const counts = new Map(rows.map((r) => [r.k, r.c]))
      return { total: counts.get('total') ?? 1, counts }
    })
    .catch((error) => {
      catalog = null
      throw error
    })
  catalog = { value, at: performance.now() }
  return value
}

type Candidate = SuggestedTag & { score: number }

/**
 * Picks the chips that narrow the current results best. A good chip:
 * - keeps a useful share of the results (not 2 of 900, not 880 of 900),
 * - is more common here than in the whole catalog ("Dinosaurs" for a kids birthday, not "Greenery"),
 * - is not something the query or a filter already asks for.
 * Kinds are mixed (occasion, age, theme, element, boy/girl, photo, color…) so the row offers real choices.
 */
export async function suggestTags({
  facets,
  total,
  intent,
  filters,
  appliedOccasion,
  vocab,
  browsing,
}: {
  facets: SearchResponse['facets']
  total: number
  intent: SearchIntent
  filters: SearchFilters
  appliedOccasion: string | null
  vocab: Vocabulary
  /** No query and no filters: only occasions make sense as a first step. */
  browsing: boolean
}): Promise<SuggestedTag[]> {
  const cfg = RANKING.suggestions
  if (total < cfg.minResults) return []
  const { total: catalogTotal, counts } = await catalogCounts()

  // Already asked for, by the query or a filter: offering it again would change nothing.
  const taken = new Set<string>([
    ...(intent.occasion ? [`occasions:${intent.occasion}`] : []),
    ...intent.alsoOccasions.map((o) => `occasions:${o}`),
    ...(intent.milestone ? [`milestones:${intent.milestone}`] : []),
    ...(intent.gender ? ['genders:girl', 'genders:boy'] : []),
    ...intent.themes.map((t) => `themes:${t}`),
    ...intent.assets.map((a) => `assets:${a}`),
    ...intent.styles.map((s) => `styles:${s}`),
    ...intent.colors.map((c) => `colors:${c}`),
    ...intent.moods.map((m) => `moods:${m}`),
    ...(intent.language ? [`languages:${intent.language}`] : []),
    ...(intent.hasPhoto || filters.photo ? ['photo:with'] : []),
    ...(filters.occasions ?? []).map((o) => `occasions:${o}`),
    ...(filters.milestones ?? []).map((m) => `milestones:${m}`),
    ...(filters.genders?.length ? ['genders:girl', 'genders:boy'] : []),
    ...(filters.themes ?? []).map((v) => `themes:${v}`),
    ...(filters.assets ?? []).map((v) => `assets:${v}`),
    ...(filters.styles ?? []).map((v) => `styles:${v}`),
    ...(filters.colors ?? []).map((v) => `colors:${v}`),
    ...(filters.moods ?? []).map((v) => `moods:${v}`),
    ...(filters.languages ?? []).map((v) => `languages:${v}`),
  ])
  const skip = new Set<string>(cfg.skip.map((s) => s.replace(/^asset:/, 'assets:').replace(/^style:/, 'styles:')))
  // The occasion the results are about (and its parents) is not a chip; its kinds are ("Kids Birthday").
  const mainOccasions = new Set<string>(
    [appliedOccasion, intent.occasion, ...(filters.occasions ?? [])].filter((o): o is string => !!o),
  )
  // A wedding anniversary already is an anniversary, and a kids birthday a birthday: parents add nothing.
  for (const o of [...mainOccasions]) for (const a of occasionAncestorsFrom(vocab, o)) taken.add(`occasions:${a}`)
  // An age in the query rules out other ages and occasions for another age ("5th birthday": no 25th, no Quinceañera).
  const askedAge = intent.milestone ?? (filters.milestones?.length === 1 ? filters.milestones[0] : null)
  const subOccasions = new Set<string>(
    [...mainOccasions].flatMap((o) => occasionFamilyFrom(vocab, o)).filter((o) => !mainOccasions.has(o)),
  )

  // Values in a filter group are OR-ed, so a second "age" or "color" would widen the results, not narrow
  // them. Once an occasion is chosen, the next step is inside it (theme, boy/girl…), not a sibling occasion.
  const chosenIn: Record<TagGroup, number> = {
    occasions: filters.occasions?.length ?? 0,
    milestones: filters.milestones?.length ?? 0,
    genders: filters.genders?.length ?? 0,
    themes: filters.themes?.length ?? 0,
    assets: filters.assets?.length ?? 0,
    styles: filters.styles?.length ?? 0,
    colors: filters.colors?.length ?? 0,
    moods: filters.moods?.length ?? 0,
    languages: filters.languages?.length ?? 0,
    photo: filters.photo ? 1 : 0,
  }

  const candidates: Candidate[] = []
  const consider = (group: TagGroup, values: FacetValue[], label: (v: FacetValue) => string = (v) => v.label) => {
    if (chosenIn[group] > 0) return
    const { weight } = cfg.groups[group]
    for (const v of values) {
      const key = `${group}:${v.id}`
      if (taken.has(key) || skip.has(key)) continue
      const share = v.count / total
      if (v.count < cfg.minCount || share < cfg.minShare || share > cfg.maxShare) continue
      const catalogShare = Math.max(counts.get(key) ?? v.count, 1) / catalogTotal
      const lift = Math.min(share / catalogShare, cfg.maxLift)
      // Bigger groups are more useful, but a chip that keeps nearly everything narrows nothing.
      const balance = Math.sqrt(share) * (1 - share)
      // A kind of the searched occasion ("First Birthday" under Birthday) is the most natural next step.
      const familyBoost = group === 'occasions' && subOccasions.has(v.id) ? 1.5 : 1
      candidates.push({ group, value: v.id, label: label(v), count: v.count, score: balance * Math.sqrt(lift) * weight * familyBoost })
    }
  }

  consider(
    'occasions',
    facets.occasion.filter((o) => !mainOccasions.has(o.id) && !(askedAge && OCCASION_AGES[o.id] && OCCASION_AGES[o.id] !== askedAge)),
  )
  if (browsing) return pick(candidates, cfg.max, cfg.max)
  if (!askedAge) consider('milestones', facets.milestones, (v) => ordinal(Number(v.id)))
  consider('genders', facets.gender.filter((g) => g.id === 'girl' || g.id === 'boy'))
  consider('themes', facets.themes)
  consider('assets', facets.assets)
  consider('photo', facets.photo.filter((p) => p.id === 'with'))
  consider('languages', facets.languages.filter((l) => l.id !== 'english'))
  consider('moods', facets.moods)
  consider('styles', facets.styles)
  consider('colors', facets.colors)

  return pick(candidates, cfg.max)
}

/** Best first, a few per kind, one chip per meaning. */
function pick(candidates: Candidate[], max: number, maxPerGroup?: number): SuggestedTag[] {
  const cfg = RANKING.suggestions
  // Best first, a few per kind, and one chip per meaning: "Bear" next to "Teddy Bear", or "Floral Border"
  // next to "Floral & Botanical", says the same thing twice. Occasions and ages are always distinct.
  candidates.sort((a, b) => b.score - a.score)
  const perGroup = new Map<TagGroup, number>()
  const seenWords = new Set<string>()
  const wordsOf = (label: string) =>
    normalizeText(label)
      .split(' ')
      .filter((w) => w.length >= 4)
      .map((w) => singularPhrase(w))
  const chosen: SuggestedTag[] = []
  const chosenOccasions = new Set<string>()
  for (const c of candidates) {
    if (chosen.length >= max) break
    if ((perGroup.get(c.group) ?? 0) >= (maxPerGroup ?? cfg.groups[c.group].max)) continue
    // "1st" adds nothing next to "First Birthday".
    if (c.group === 'milestones' && [...chosenOccasions].includes(MILESTONE_BIRTHDAYS[Number(c.value)] ?? '')) continue
    if (c.group !== 'occasions' && c.group !== 'milestones') {
      const words = wordsOf(c.label)
      if (words.some((w) => seenWords.has(w))) continue
      for (const w of words) seenWords.add(w)
    }
    if (c.group === 'occasions') chosenOccasions.add(c.value)
    perGroup.set(c.group, (perGroup.get(c.group) ?? 0) + 1)
    chosen.push({ group: c.group, value: c.value, label: c.label, count: c.count })
  }
  return chosen
}
