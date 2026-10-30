/** AI is used only when both an OpenAI key is set and SEARCH_AI_ENABLED=true. */
export function isAiEnabled() {
  return process.env.SEARCH_AI_ENABLED === 'true' && !!process.env.OPENAI_API_KEY
}

/** Model ids in Mastra "provider/model" form; overridable from the environment. */
export const AI_MODELS = {
  enrich: process.env.SEARCH_AI_ENRICH_MODEL ?? 'openai/gpt-6-luna',
  query: process.env.SEARCH_AI_QUERY_MODEL ?? 'openai/gpt-6-luna',
  embedding: process.env.SEARCH_AI_EMBEDDING_MODEL ?? 'openai/text-embedding-3-large',
}

/**
 * Embedding size stored in template_search.embedding (vector(1536)). text-embedding-3-large is shortened
 * to this size by OpenAI (pgvector indexes take at most 2,000), and still scores above 3-small at full size.
 * Changing the model or size means re-embedding every template: npm run search:embed -- --yes --all
 */
export const EMBEDDING_DIMENSIONS = 1536

/** USD per 1M input tokens for embeddings, from https://developers.openai.com/api/docs/pricing (checked 2026-10-29). */
export const EMBEDDING_PRICES: Record<string, number> = {
  'openai/text-embedding-3-large': 0.13,
  'openai/text-embedding-3-small': 0.02,
}

/**
 * OpenAI settings for template enrichment (Standard tier):
 * - low reasoning: thinking is billed as output, and tagging needs little of it.
 * - explicit caching: only the part marked with ENRICH_CACHE_BREAKPOINT (instructions + vocabulary) is cached.
 *   With implicit caching, the image and card text, which differ every time, would also be written
 *   to the cache at 1.25× the input price.
 */
export const ENRICH_PROVIDER_OPTIONS = {
  openai: {
    reasoningEffort: 'low',
    promptCacheOptions: { mode: 'explicit', ttl: '30m' },
  },
} as const

/** Marks the end of the prompt part that is the same for every template. */
export const ENRICH_CACHE_BREAKPOINT = { openai: { promptCacheBreakpoint: { mode: 'explicit' } } } as const

/** "high" caps an image at 2,500 patches (~3,000 tokens); preview images are usually ~1,200 tokens. */
export const ENRICH_IMAGE_OPTIONS = { openai: { imageDetail: 'high' } } as const

/**
 * USD per 1M tokens, Standard tier, from https://developers.openai.com/api/docs/pricing (checked 2026-10-28).
 * cacheWrite is the 30-minute cache write price.
 */
export const MODEL_PRICES: Record<string, { input: number; cached: number; cacheWrite: number; output: number }> = {
  'openai/gpt-6-luna': { input: 0.1, cached: 0.01, cacheWrite: 0.125, output: 0.5 },
  'openai/gpt-6.1-terra': { input: 1, cached: 0.05, cacheWrite: 1.25, output: 5 },
  'openai/gpt-6.1-sol': { input: 2, cached: 0.1, cacheWrite: 2.5, output: 10 },
}
