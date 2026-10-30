/** Ranking weights and thresholds in one place, so they are easy to tune. */
export const RANKING = {
  /** Final score = relevance × 0.75 + freshness × 0.15 + quality × 0.10 (+ milestone bonus). */
  weights: { relevance: 0.75, freshness: 0.15, quality: 0.1 },
  /** Exact milestone match ("5th" template for "5th anniversary"). */
  milestoneBonus: 0.08,
  /**
   * Card also fits another occasion named in the query ("halloween" in "halloween wedding").
   * Larger than freshness + quality together (0.25), so fitting both beats being newer.
   */
  alsoOccasionBonus: 0.35,
  /** "card" with a holiday or greeting occasion ("thanksgiving card"): greeting cards first, same size as above. */
  cardGreetingBonus: 0.35,
  /**
   * Inside a tier, cards whose match (0.75 × relevance + bonuses) is within this of the best one count as
   * equally relevant, and newer, better designs come first among them. Tuned on the 1,034 report queries.
   */
  relevanceBand: 0.04,
  /** Freshness halves every this many days (about 18 months). */
  freshnessHalfLifeDays: 540,
  /** Results below this relevance are dropped: a short list beats a wrong one. */
  minRelevance: 0.2,
  /** Occasion score when the template only lists the occasion as an extra one (its own occasion scores 1). */
  extraOccasionScore: 0.75,
  /** Query occasion confidence needed to use it as a strict filter. */
  strictOccasionConfidence: 0.9,
  /** How relevance is built when the query has structure (occasion, theme, format…). */
  structured: { occasion: 0.45, attributes: 0.25, text: 0.3 },
  /** Same, when meaning-based matching is on (AI on and templates embedded). */
  structuredWithMeaning: { occasion: 0.4, attributes: 0.2, text: 0.15, meaning: 0.25 },
  /** How relevance is built for free-text queries the parser could not map. */
  keywordOnly: { text: 0.7, nameSimilarity: 0.3 },
  keywordOnlyWithMeaning: { text: 0.35, nameSimilarity: 0.15, meaning: 0.5 },
  /**
   * Meaning match (text-embedding-3-large, cosine similarity), relative to the best match for the query:
   * the best template scores 1, `window` below it (never below `floor`) scores 0.
   * For queries the rules could not map, a template counts as a match within `matchWithin` of the best
   * (and at least `minMatch`). Below `minBest` nothing is close ("zxqv blorf" peaks at 0.25), so meaning is not used.
   */
  semantic: { floor: 0.3, window: 0.25, matchWithin: 0.1, minMatch: 0.35, minBest: 0.35 },
  /** ts_rank_cd values are small; this scales them to roughly 0–1. */
  textRankScale: 1.5,
  pageSize: 24,
  /** An occasion with fewer designs than this gets its page filled with its parent and close-in-meaning designs. */
  thinOccasionResults: 24,
  maxQuickTags: 8,
  /** Suggested tags: chips that narrow the current results (see suggest-tags.ts). */
  suggestions: {
    max: 10,
    /** For a query that fits many occasions, the occasion chips come first, then this many others. */
    afterOccasionTags: 4,
    /** No chips for fewer results than this: there is little to narrow. */
    minResults: 8,
    /** A chip must keep at least this many results and this share of them… */
    minCount: 5,
    minShare: 0.02,
    /** …and must not keep almost all of them (it would not narrow anything). */
    maxShare: 0.85,
    /** How much more common a value is here than in the whole catalog counts, up to this cap. */
    maxLift: 6,
    /** Preference per kind of chip, and how many chips each kind may have. */
    groups: {
      occasions: { weight: 1.4, max: 3 },
      milestones: { weight: 1.25, max: 3 },
      themes: { weight: 1.15, max: 3 },
      genders: { weight: 1.1, max: 2 },
      assets: { weight: 1, max: 3 },
      photo: { weight: 0.9, max: 1 },
      languages: { weight: 0.9, max: 1 },
      moods: { weight: 0.8, max: 1 },
      styles: { weight: 0.75, max: 1 },
      colors: { weight: 0.7, max: 2 },
    },
    /** Values never offered as chips: the photo frame is the "With photo" chip, typography is on most cards. */
    skip: ['asset:photo_frame', 'style:typography', 'style:illustrated', 'style:photo'],
  },
} as const
