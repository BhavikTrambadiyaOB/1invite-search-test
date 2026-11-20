import { db } from '../db'
import { isAiEnabled } from './ai-config'
import { isConfidentParse, normalizeQuery, parseQuery } from './parse-query'
import { ASSET_BY_ID } from './taxonomy'
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
    return { ...intent, ...kidsOccasion(rules, intent), assets: withRuleAssets(rules, intent), audience: rules.audience, language: askedLanguage(query, rules, intent.language) }
  }

  try {
    // Loaded only when needed, so search without AI never imports the AI stack.
    const { aiParseQuery } = await import('./ai-parse-query')
    const read = await aiParseQuery(query, rules)
    const intent = { ...read, ...kidsOccasion(rules, read), assets: withRuleAssets(rules, read), language: askedLanguage(query, rules, read.language) }
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
 * "shawn the sheep, party, kids": the rules read a kids word with "party" or "birthday" as a kids birthday. The AI
 * may call it a themed party (or nothing), which lets Passover and Eid cards with a sheep in. A kids birthday
 * wins over those broad readings; a specific event the AI found ("baby shower") stays.
 */
const BROAD_PARTY_OCCASIONS = new Set(['themed_party', 'birthday'])
function kidsOccasion(rules: SearchIntent, ai: SearchIntent): Pick<SearchIntent, 'occasion' | 'occasionConfidence'> {
  if (rules.occasion === 'kids_birthday' && (!ai.occasion || BROAD_PARTY_OCCASIONS.has(ai.occasion))) {
    // As sure as the rules are: a sure kids birthday keeps other events out.
    return { occasion: 'kids_birthday', occasionConfidence: Math.max(rules.occasionConfidence, ai.occasionConfidence ?? 0) }
  }
  return { occasion: ai.occasion, occasionConfidence: ai.occasionConfidence }
}

/**
 * An element the rules found by name is kept when the AI left that very name as a plain word ("jump place" →
 * trampoline), so the asked object ranks as the subject. A word that only contains a name stays with the AI:
 * "gift card" is a kind of card, not a gift.
 */
function withRuleAssets(rules: SearchIntent, ai: SearchIntent): string[] {
  const keywords = new Set((ai.keywords ?? []).map((k) => k.toLowerCase()))
  const named = rules.assets.filter((id) => ASSET_BY_ID.get(id)?.phrases.some((phrase) => keywords.has(phrase)))
  return [...new Set([...(ai.assets ?? []), ...named])]
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
