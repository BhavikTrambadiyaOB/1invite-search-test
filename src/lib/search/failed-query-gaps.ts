import { FAILURE_RULES, type FailedQuery, type GapType } from './failed-queries'

/** Gap labels and the collection direction of a failed query, shared by the failed-queries page and report pages. */

export const GAP_LABELS: Record<GapType, string> = {
  content_gap: 'Content gap',
  search_gap: 'Search gap',
  not_chosen: 'Not chosen',
  no_gap: 'No gap',
}
export const GAP_BADGE: Record<GapType, 'default' | 'secondary' | 'outline'> = {
  content_gap: 'default',
  search_gap: 'secondary',
  not_chosen: 'outline',
  no_gap: 'outline',
}
/** "No gap" in green, so passed searches stand apart from the failed ones. */
export const GAP_CLASS: Partial<Record<GapType, string>> = {
  no_gap: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
}

export function formatAverage(value: number | null) {
  if (value === null) return '–'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function collectionDirection(query: FailedQuery) {
  if (query.gapType === 'search_gap') {
    const terms = query.unknownWords.length > 0 ? query.unknownWords.join(', ') : 'the query wording'
    return `Teach search to recognize ${terms}.`
  }
  if (query.gapType === 'no_gap') {
    return `Nothing to do: the search worked (${FAILURE_RULES.fewExactMatches}+ exact matches and a strong best card).`
  }
  if (query.gapType === 'not_chosen') {
    return 'Search found fitting templates and ranked a strong match first, but the user did not pick one. Review the designs and their order (taste), not the collection size.'
  }

  const intent = query.exampleIntent
  const focus: string[] = []
  const add = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) focus.push(value.replace(/_/g, ' '))
  }
  const addMany = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(add)
  }

  add(intent?.occasion)
  addMany(intent?.alsoOccasions)
  add(intent?.milestone ? `${intent.milestone} milestone` : null)
  addMany(intent?.themes)
  addMany(intent?.assets)
  addMany(intent?.styles)
  addMany(intent?.colors)
  addMany(intent?.moods)
  add(intent?.format)
  add(intent?.docType)
  add(intent?.gender)
  add(intent?.language)
  addMany(intent?.keywords)
  if (intent?.hasPhoto === true) add('photo')
  if (intent?.hasPhoto === false) add('without photo')

  const collectionFocus = [...new Set(focus)].slice(0, 5).join(', ') || query.exampleQuery
  // The understood-tag recount, when higher: typed words like "toddler" are not printed on cards that fit.
  const directMatches = query.avgDirect === null ? null : Math.max(query.avgDirect, query.tagExact ?? 0)
  const coverageCount = directMatches ?? query.avgExact
  if (coverageCount === null) {
    return `Check coverage for ${collectionFocus}; exact-match data is unavailable for this period.`
  }
  const coverageLabel = directMatches === null
    ? `${formatAverage(coverageCount)} legacy exact-match ${coverageCount === 1 ? 'result' : 'results'}`
    : `${formatAverage(coverageCount)} direct ${coverageCount === 1 ? 'template' : 'templates'}`
  if (coverageCount >= FAILURE_RULES.fewExactMatches) {
    if (query.avgRelevance !== null && query.avgRelevance < FAILURE_RULES.lowRelevance) {
      return `Improve search relevance for ${collectionFocus}; there are ${coverageLabel} per visit on average, but the best matches score weakly.`
    }
    if (query.avgRelevance === null) {
      return `Review match quality for ${collectionFocus}; there are ${coverageLabel} per visit on average, but relevance data is unavailable.`
    }
    return `Coverage looks strong for ${collectionFocus} (${coverageLabel} per visit); review why users did not choose a result before expanding the collection.`
  }

  return `Add or enrich templates for ${collectionFocus}; average coverage is ${coverageLabel} per visit.`
}
