import type { ActiveTag, SearchFilters } from './types'

export type SearchState = {
  query: string
  filters: SearchFilters
  page: number
  debug: boolean
  /** Parts of the parsed query the user removed (see searchTemplates). */
  ignore: string[]
}

type RawParams = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
const list = (v: string | string[] | undefined) =>
  first(v)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

/** Reads the search page URL: /search?q=dinner&occasion=birthday&themes=floral&mood=fun&lang=spanish&photo=with&age=30&page=2 */
export function parseSearchParams(params: RawParams): SearchState {
  const price = first(params.price)
  const orientation = first(params.orientation)
  const photo = first(params.photo)
  return {
    query: first(params.q).slice(0, 200),
    page: Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Number.parseInt(first(params.page), 10) || 1)),
    debug: first(params.debug) === '1',
    ignore: list(params.ignore).slice(0, 20),
    filters: {
      occasions: list(params.occasion),
      themes: list(params.themes),
      styles: list(params.styles),
      colors: list(params.colors),
      docTypes: list(params.type),
      genders: list(params.gender),
      assets: list(params.elements),
      moods: list(params.mood),
      languages: list(params.lang),
      photo: photo === 'with' || photo === 'without' ? photo : undefined,
      milestones: list(params.age)
        .map((v) => Number.parseInt(v, 10))
        .filter((n) => Number.isInteger(n) && n > 0 && n <= 200)
        .slice(0, 10),
      price: price === 'free' || price === 'premium' ? price : undefined,
      orientation: orientation === 'portrait' || orientation === 'landscape' ? orientation : undefined,
    },
  }
}

/** Builds a /search URL from a state plus changes. Changing filters resets to page 1. */
export function searchHref(state: SearchState, changes: Partial<SearchState> & { filters?: Partial<SearchFilters> } = {}) {
  const filters = { ...state.filters, ...changes.filters }
  const page = changes.page ?? (changes.filters || changes.ignore || changes.query !== undefined ? 1 : state.page)
  const query = changes.query ?? state.query
  const debug = changes.debug ?? state.debug
  // A new query is parsed fresh, so earlier removals no longer apply.
  const ignore = changes.query !== undefined && changes.query !== state.query ? [] : (changes.ignore ?? state.ignore)

  const sp = new URLSearchParams()
  if (query) sp.set('q', query)
  if (filters.occasions?.length) sp.set('occasion', filters.occasions.join(','))
  if (filters.themes?.length) sp.set('themes', filters.themes.join(','))
  if (filters.styles?.length) sp.set('styles', filters.styles.join(','))
  if (filters.colors?.length) sp.set('colors', filters.colors.join(','))
  if (filters.docTypes?.length) sp.set('type', filters.docTypes.join(','))
  if (filters.genders?.length) sp.set('gender', filters.genders.join(','))
  if (filters.assets?.length) sp.set('elements', filters.assets.join(','))
  if (filters.moods?.length) sp.set('mood', filters.moods.join(','))
  if (filters.languages?.length) sp.set('lang', filters.languages.join(','))
  if (filters.photo) sp.set('photo', filters.photo)
  if (filters.milestones?.length) sp.set('age', filters.milestones.join(','))
  if (filters.price) sp.set('price', filters.price)
  if (filters.orientation) sp.set('orientation', filters.orientation)
  if (ignore.length) sp.set('ignore', ignore.join(','))
  if (page > 1) sp.set('page', String(page))
  if (debug) sp.set('debug', '1')
  const qs = sp.toString()
  return qs ? `/search?${qs}` : '/search'
}

/** Adds or removes a value from a multi-select filter. */
export function toggle(values: string[] | undefined, value: string) {
  const set = new Set(values ?? [])
  if (set.has(value)) set.delete(value)
  else set.add(value)
  return [...set]
}

export function activeFilterCount(filters: SearchFilters) {
  return (
    (filters.occasions?.length ?? 0) +
    (filters.themes?.length ?? 0) +
    (filters.styles?.length ?? 0) +
    (filters.colors?.length ?? 0) +
    (filters.docTypes?.length ?? 0) +
    (filters.genders?.length ?? 0) +
    (filters.assets?.length ?? 0) +
    (filters.moods?.length ?? 0) +
    (filters.languages?.length ?? 0) +
    (filters.photo ? 1 : 0) +
    (filters.milestones?.length ?? 0) +
    (filters.price ? 1 : 0) +
    (filters.orientation ? 1 : 0)
  )
}

/** Filter values that clear every filter group. */
export const NO_FILTERS: SearchFilters = {
  occasions: [],
  themes: [],
  styles: [],
  colors: [],
  docTypes: [],
  genders: [],
  assets: [],
  moods: [],
  languages: [],
  photo: undefined,
  milestones: [],
  price: undefined,
  orientation: undefined,
}

/**
 * The URL with a tag chip added (on) or removed (off). An added occasion replaces the chosen one,
 * since a kind of birthday ("Kids Birthday") narrows "Birthday" instead of adding to it.
 */
export function tagHref(state: SearchState, group: ActiveTag['group'], value: string, on: boolean) {
  const f = state.filters
  switch (group) {
    case 'occasions':
      return searchHref(state, { filters: { occasions: on ? [value] : toggle(f.occasions, value) } })
    case 'milestones': {
      const n = Number(value)
      const current = f.milestones ?? []
      return searchHref(state, { filters: { milestones: on ? [...new Set([...current, n])] : current.filter((m) => m !== n) } })
    }
    case 'photo':
      return searchHref(state, { filters: { photo: on ? (value as 'with' | 'without') : undefined } })
    case 'price':
      return searchHref(state, { filters: { price: on ? (value as 'free' | 'premium') : undefined } })
    case 'orientation':
      return searchHref(state, { filters: { orientation: on ? (value as 'portrait' | 'landscape') : undefined } })
    default: {
      const values = f[group] ?? []
      const next = on ? [...new Set([...values, value])] : values.filter((v) => v !== value)
      return searchHref(state, { filters: { [group]: next } })
    }
  }
}
