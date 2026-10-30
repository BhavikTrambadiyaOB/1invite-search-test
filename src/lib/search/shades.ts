/**
 * Color shades ("lavender", "sage green", "metallic gold") and the base colors they belong to.
 * Shades are free text; base colors come from COLORS in taxonomy.ts.
 */
import { COLORS } from './taxonomy'
import { compilePhrases, findMatches, normalizeText } from './text'

const COMPILED = COLORS.map((c) => {
  const idText = c.id.replace(/_/g, ' ')
  return { id: c.id, idText, idRe: compilePhrases([idText]), re: compilePhrases([idText, ...c.phrases]) }
})

/** Color phrases that are not shade names (general words, or Spanish color names). */
const NOT_SHADES = new Set([
  'dark', 'neutral', 'metallic', 'rainbow', 'multicolor', 'multicolour', 'colorful', 'colourful', 'pastels', 'earthy',
  'rosa', 'rojo', 'amarillo', 'dorado', 'verde', 'azul', 'morado', 'negro', 'blanco', 'cherry', 'lemon', 'peach', 'wine',
])

/** Cleans a shade name: lowercase, plain words, at most three words. */
export function normalizeShade(shade: string): string {
  return normalizeText(shade).split(' ').filter(Boolean).slice(0, 3).join(' ')
}

/** Base colors for a shade: "lavender" → purple, "metallic gold" → gold, "rose gold" → rose_gold. */
export function baseColorsForShade(shade: string): string[] {
  const text = normalizeShade(shade)
  const matched = COMPILED.filter((c) => findMatches(c.re, text).length > 0)
  // A shade that names a base color ("metallic gold") belongs to that color only.
  const named = matched.filter((c) => findMatches(c.idRe, text).length > 0)
  const pick = named.length > 0 ? named.filter((c) => !named.some((o) => o !== c && o.idText.includes(c.idText))) : matched
  return pick.map((c) => c.id)
}

const SHADE_PHRASES = COLORS.flatMap((c) =>
  c.phrases
    .map((phrase) => normalizeText(phrase))
    .filter((p) => p && !NOT_SHADES.has(p) && p !== c.id.replace(/_/g, ' '))
    .map((p) => ({ shade: p, re: compilePhrases([p]) })),
)

/** Shade names found in text by the rules: specific color words, not the plain base color names. */
export function findShades(text: string): string[] {
  return [...new Set(SHADE_PHRASES.filter((s) => findMatches(s.re, text).length > 0).map((s) => s.shade))]
}
