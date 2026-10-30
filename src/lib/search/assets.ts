/**
 * Asset and gender helpers shared by rule enrichment, AI enrichment and query parsing.
 */
import {
  ADULT_GENDER_WORDS,
  ASSETS,
  ASSET_BY_ID,
  FIGURATIVE_ASSETS,
  GENDERLESS_GROUPS,
  GENDERS,
  MAX_THEMES,
  MIN_ASSETS_FOR_THEME,
  OCCASION_THEME_REPEATS,
  type OccasionDef,
} from './taxonomy'
import { compilePhrases, findMatches, normalizeText } from './text'

/** Every asset phrase (normalized) → asset id, e.g. "puppies" → dog, "hockey puck" → hockey. */
const PHRASE_TO_ASSET = new Map<string, string>()
for (const asset of ASSETS) {
  for (const phrase of [asset.id.replace(/_/g, ' '), ...asset.phrases]) {
    const key = normalizeText(phrase)
    if (key && !PHRASE_TO_ASSET.has(key)) PHRASE_TO_ASSET.set(key, asset.id)
  }
}

const ASSET_MATCHERS = ASSETS.map((asset) => ({ id: asset.id, re: compilePhrases([asset.id.replace(/_/g, ' '), ...asset.phrases]) }))

/** Turns an asset name into its canonical id, or a cleaned lowercase name when it is not in the dictionary. */
export function canonicalAsset(name: string): string {
  const key = normalizeText(name)
  if (!key) return ''
  return PHRASE_TO_ASSET.get(key) ?? PHRASE_TO_ASSET.get(key.replace(/(es|s)$/, '')) ?? key.replace(/ /g, '_')
}

/** Assets named in a piece of text. With `figurative`, words like "heart" or "star" are skipped. */
export function findAssets(normalizedText: string, { skipFigurative = false } = {}): string[] {
  const found = ASSET_MATCHERS.filter((m) => !(skipFigurative && FIGURATIVE_ASSETS.has(m.id)))
    .filter((m) => findMatches(m.re, normalizedText).length > 0)
    .map((m) => m.id)
  // A more specific asset hides the general one it contains ("teddy bear" is not a woodland bear).
  return found.filter((id) => !(SHADOWED_BY[id] ?? []).some((specific) => found.includes(specific)))
}

const SHADOWED_BY: Record<string, string[]> = {
  bear: ['teddy_bear'],
  flower: ['sunflower', 'cherry_blossom'],
}

/** Themes implied by assets: a basketball makes a template Sports too. */
export function themesForAssets(assets: string[]): string[] {
  return [...new Set(assets.flatMap((id) => ASSET_BY_ID.get(id)?.themes ?? []))]
}

/** Canonical, de-duplicated assets plus the themes they imply. */
export function normalizeAssetsAndThemes(assets: string[], themes: string[]) {
  const canonical = [...new Set(assets.map(canonicalAsset).filter(Boolean))]
  return { assets: canonical, themes: [...new Set([...themes, ...themesForAssets(canonical)])] }
}

const GENDER_MATCHERS = GENDERS.filter((g) => g.id !== 'neutral').map((g) => ({
  id: g.id as 'girl' | 'boy',
  all: compilePhrases(g.phrases),
  babyOnly: compilePhrases(g.phrases.filter((p) => !ADULT_GENDER_WORDS.has(p))),
}))

/** Occasions where gender does not apply (a couple, a company, a holiday) — except bride-only events. */
export function isGenderless(occ: OccasionDef | undefined) {
  if (!occ) return false
  if (occ.id === 'bridal_shower' || occ.id === 'bachelorette') return false
  return GENDERLESS_GROUPS.has(occ.group)
}

/**
 * Gender target from wording: girl, boy or neutral.
 * Only clear words count. Both genders present (a couple, "he or she") means neutral.
 * On baby events, words about the parents ("mom to be") are ignored.
 */
export function detectGender(normalizedText: string, occ: OccasionDef | undefined): 'girl' | 'boy' | 'neutral' {
  if (isGenderless(occ)) return 'neutral'
  const babyEvent = occ?.group === 'Baby & Kids'
  const hits = GENDER_MATCHERS.filter((g) => findMatches(babyEvent ? g.babyOnly : g.all, normalizedText).length > 0)
  return hits.length === 1 ? hits[0].id : 'neutral'
}

/**
 * Final themes for an AI-tagged template:
 * - the AI's own themes come first (the overall concept of the design);
 * - a theme implied by elements is added only when at least MIN_ASSETS_FOR_THEME elements share it,
 *   so one lemon does not make a card "Food & Sweets";
 * - themes that only repeat the occasion (Party & Celebration on a birthday) are dropped;
 * - at most MAX_THEMES are kept.
 */
export function pickThemes({
  own,
  assetThemes,
  occasionId,
  occasionGroup,
}: {
  own: string[]
  /** For each visible element, the themes it belongs to. */
  assetThemes: string[][]
  occasionId: string | null
  occasionGroup: string | null
}): string[] {
  const repeats = new Set([
    ...(occasionId ? OCCASION_THEME_REPEATS[occasionId] ?? [] : []),
    ...(occasionGroup ? OCCASION_THEME_REPEATS[occasionGroup] ?? [] : []),
  ])
  const counts = new Map<string, number>()
  for (const themes of assetThemes) for (const t of new Set(themes)) counts.set(t, (counts.get(t) ?? 0) + 1)
  const fromAssets = [...counts.entries()]
    .filter(([, n]) => n >= MIN_ASSETS_FOR_THEME)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
  return [...new Set([...own, ...fromAssets])].filter((t) => !repeats.has(t)).slice(0, MAX_THEMES)
}
