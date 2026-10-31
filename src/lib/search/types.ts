/** Structured description of a template, produced by rule or AI enrichment. */
export type Enrichment = {
  occasion: string | null
  /** girl, boy or neutral. */
  gender: string | null
  /** Visible objects, canonical ids where known (butterfly, basketball, lion…). */
  assets: string[]
  occasionConfidence: number
  milestone: number | null
  format: string | null
  docType: string | null
  audience: string | null
  themes: string[]
  styles: string[]
  colors: string[]
  /** How the design feels (fun, calm…), from MOODS. */
  moods: string[]
  /** Specific shade names (lavender, sage green); their base colors are in `colors`. */
  colorShades: string[]
  /** Other occasions the same design fits, e.g. kids_birthday for a 4th birthday card. */
  extraOccasions: string[]
  /** Printed languages, main one first. */
  languages: string[]
  /** Has a photo slot or a photograph in the design. */
  hasPhoto: boolean
  qualityScore: number
  summary: string
}

/** What the user is looking for, parsed from the query. */
export type SearchIntent = {
  occasion: string | null
  occasionConfidence: number
  /** Other occasions in the query ("halloween" in "halloween wedding"); cards that fit them rank higher. */
  alsoOccasions: string[]
  milestone: number | null
  format: string | null
  docType: string | null
  /** girl or boy when the query says who it is for. */
  gender: string | null
  themes: string[]
  /** Specific objects asked for (butterfly, basketball). */
  assets: string[]
  styles: string[]
  colors: string[]
  /** How the design should feel ("fun birthday"). */
  moods: string[]
  /** A language named in the query ("spanish invitation"). */
  language: string | null
  /** true when the query asks for a photo card. */
  hasPhoto: boolean | null
  isFree: boolean | null
  /** Words the parser did not map to the taxonomy; used for full-text matching. */
  keywords: string[]
  /** Words the parser could not understand at all (not in the taxonomy or the template vocabulary). */
  unknownWords: string[]
  source: 'rules' | 'ai'
}

/**
 * User-selected filters. Values in the same group combine with OR (floral or butterfly);
 * different groups combine with AND (floral and free).
 */
export type SearchFilters = {
  occasions?: string[]
  themes?: string[]
  styles?: string[]
  colors?: string[]
  docTypes?: string[]
  genders?: string[]
  assets?: string[]
  moods?: string[]
  languages?: string[]
  photo?: 'with' | 'without'
  /** Printed ages or years: 1 (1st birthday), 30, 25 (25th anniversary). */
  milestones?: number[]
  price?: 'free' | 'premium'
  orientation?: 'portrait' | 'landscape'
}

export type SearchResultItem = {
  id: number
  name: string
  previewUrl: string
  isFree: boolean
  isPortrait: boolean | null
  createdAt: string
  occasion: string | null
  occasionLabel: string | null
  milestone: number | null
  gender: string | null
  themes: string[]
  assets: string[]
  moods: string[]
  extraOccasions: string[]
  languages: string[]
  hasPhoto: boolean
  docType: string | null
  score: number
  debug: {
    relevance: number
    freshness: number
    quality: number
    milestoneBonus: number
    textRank: number
  }
}

export type FacetValue = { id: string; label: string; count: number }

export type QuickTag = { occasion: string; label: string; count: number }

/** The filter group a suggested tag sets. Values in a group combine with OR, groups with AND. */
export type TagGroup = 'occasions' | 'milestones' | 'genders' | 'themes' | 'assets' | 'styles' | 'colors' | 'moods' | 'languages' | 'photo'

/**
 * A chip that narrows the current results ("Kids", "1st", "Dinosaurs", "With photo").
 * Tapping it adds `value` to the `group` filter; `count` is how many results it leaves.
 */
export type SuggestedTag = { group: TagGroup; value: string; label: string; count: number }

/** How many search results match all query details, some of them, or only the occasion. */
export type SearchMatchCounts = {
  direct: number
  partial: number
  occasionOnly: number
}

/** A filter the user already chose, shown as a removable chip. */
export type ActiveTag = { group: TagGroup | 'price' | 'orientation' | 'docTypes'; value: string; label: string }

export type SearchResponse = {
  searchId: number | null
  query: string
  intent: SearchIntent
  appliedOccasion: string | null
  total: number
  /**
   * Results that fit the asked occasion and every asked detail. "dinosaur wedding" can show 1,106 wedding
   * cards with 0 exact matches: a content gap, even though the page is not empty.
   */
  exactTotal: number
  matchCounts: SearchMatchCounts
  page: number
  pageSize: number
  results: SearchResultItem[]
  facets: {
    occasion: FacetValue[]
    themes: FacetValue[]
    styles: FacetValue[]
    colors: FacetValue[]
    docType: FacetValue[]
    gender: FacetValue[]
    assets: FacetValue[]
    moods: FacetValue[]
    languages: FacetValue[]
    photo: FacetValue[]
    milestones: FacetValue[]
    price: FacetValue[]
    orientation: FacetValue[]
  }
  quickTags: QuickTag[]
  /** Chips that narrow these results the most, best first. */
  suggestedTags: SuggestedTag[]
  /** The filters already applied, with labels, so a client can show them as removable chips. */
  activeTags: ActiveTag[]
}
