import { db } from '../db'
import { isAiEnabled } from './ai-config'
import { isConfidentParse, normalizeQuery, parseQuery } from './parse-query'
import { hasNonLatinLetters } from './text'
import type { SearchIntent } from './types'
import { getVocabulary, learnedTerms } from './vocabulary'

/**
 * Turns a query into an intent: the AI cache first, then the rule parser,
 * then AI for queries the rules could not understand (only when AI is enabled).
 */
export async function resolveIntent(query: string): Promise<SearchIntent> {
  const normalized = normalizeQuery(query)
  const rules = parseQuery(query, learnedTerms(await getVocabulary()))
  if (!normalized || isConfidentParse(rules) || !isAiEnabled()) return rules

  const cached = await db.query<{ intent: SearchIntent }>(
    'select intent from search_query_cache where normalized_query = $1',
    [normalized],
  )
  const hit = cached.rows[0]?.intent as Partial<SearchIntent> | undefined
  // Intents cached before moods, language and photo were added lack those fields.
  if (hit) {
    const intent = { ...hit, moods: hit.moods ?? [], alsoOccasions: hit.alsoOccasions ?? [], language: hit.language ?? null, hasPhoto: hit.hasPhoto ?? null } as SearchIntent
    return { ...intent, language: askedLanguage(query, rules, intent.language) }
  }

  try {
    // Loaded only when needed, so search without AI never imports the AI stack.
    const { aiParseQuery } = await import('./ai-parse-query')
    const read = await aiParseQuery(query, rules)
    const intent = { ...read, language: askedLanguage(query, rules, read.language) }
    await db.query(
      `insert into search_query_cache (normalized_query, intent, source) values ($1, $2, 'ai')
       on conflict (normalized_query) do update set intent = excluded.intent, created_at = now()`,
      [normalized, JSON.stringify(intent)],
    )
    return intent
  } catch (error) {
    console.error('AI query parsing failed; using rules', error)
    return rules
  }
}

/**
 * The AI often sets the language a query is written in ("invitación de hombre" → Spanish), which would show
 * Spanish-text cards first instead of designs for a man. Keep it only when the query names a language
 * ("en español", read by the rules) or is written in another script ("عيد اضحى بالعربية").
 */
function askedLanguage(query: string, rules: SearchIntent, ai: string | null): string | null {
  if (rules.language) return rules.language
  return ai && hasNonLatinLetters(query) ? ai : null
}
