import { queryIntentSchema } from './ai-schemas'
import { getVocabulary, lookupTerm, vocabularyPrompt, type VocabKind } from './vocabulary'
import type { SearchIntent } from './types'

/** Asks the query-parser agent what a query means. The result is cached by the caller. */
export async function aiParseQuery(query: string, rules: SearchIntent): Promise<SearchIntent> {
  const vocab = await getVocabulary()
  // Through the registered Mastra instance, so the call is traced.
  const { mastra } = await import('../../mastra')
  const response = await mastra.getAgent('queryParserAgent').generate(
    `Search query: "${query.slice(0, 200)}"\n\nThe rule parser read it as: ${JSON.stringify({
      occasion: rules.occasion,
      milestone: rules.milestone,
      format: rules.format,
      themes: rules.themes,
      keywords: rules.keywords,
    })}. Correct or complete this.`,
    {
      system: vocabularyPrompt(vocab),
      structuredOutput: { schema: queryIntentSchema },
      tracingOptions: { rootSpanName: `understand query: ${query.slice(0, 60)}`, metadata: { feature: 'query-parse', query } },
    },
  )
  const ai = queryIntentSchema.parse(response.object)
  // Keep only words that map to known terms ("puppies" → dog); queries never create new terms.
  const known = (kind: VocabKind, words: string[]) =>
    [...new Set(words.map((w) => lookupTerm(vocab, kind, w)).filter((id): id is string => !!id))]
  return {
    ...ai,
    occasion: ai.occasion ? lookupTerm(vocab, 'occasion', ai.occasion) : null,
    // The rules already find a second occasion reliably; the AI answer has no such field.
    alsoOccasions: rules.alsoOccasions.filter((o) => o !== ai.occasion),
    themes: known('theme', ai.themes),
    assets: known('asset', ai.assets),
    styles: known('style', ai.styles),
    unknownWords: [],
    source: 'ai',
  }
}
