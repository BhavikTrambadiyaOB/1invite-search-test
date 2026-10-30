import { KEYWORD_SYNONYMS } from './taxonomy'
import { normalizeText } from './text'

const GROUPS = KEYWORD_SYNONYMS.map((forms) => forms.map((f) => normalizeText(f)))

/**
 * The extra wording of a query as concepts, each a list of phrases that mean the same:
 * "wedding time line" with keywords [time, line] → [[timeline, time line, program, …]].
 * Keywords outside every synonym group are concepts of one word.
 */
export function keywordConcepts(normalizedQuery: string, keywords: string[]): string[][] {
  const text = ` ${normalizedQuery} `
  const concepts: string[][] = []
  const used = new Set<string>()
  for (const forms of GROUPS) {
    const found = forms.filter((f) => text.includes(` ${f} `))
    if (found.length === 0) continue
    concepts.push(forms)
    for (const f of found) for (const w of f.split(' ')) used.add(w)
  }
  for (const k of keywords) if (!used.has(k)) concepts.push([k])
  return concepts
}
