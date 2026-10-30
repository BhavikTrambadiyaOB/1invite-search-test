import { ModelRouterEmbeddingModel } from '@mastra/core/llm'
import { SpanType } from '@mastra/core/observability'
import { db } from '../db'
import { AI_MODELS, EMBEDDING_DIMENSIONS } from './ai-config'

let embeddingModel: ModelRouterEmbeddingModel | null = null

/** Embeds texts with the configured embedding model, at EMBEDDING_DIMENSIONS numbers per text. */
export async function embedTexts(values: string[]): Promise<number[][]> {
  if (values.length === 0) return []
  embeddingModel ??= new ModelRouterEmbeddingModel(AI_MODELS.embedding)

  // Embeddings call the model directly (no agent), so record a span for the trace store ourselves.
  const { observability } = await import('../../mastra')
  const span = observability.getDefaultInstance()?.startSpan({
    type: SpanType.GENERIC,
    name: `embed ${values.length} text${values.length === 1 ? '' : 's'}`,
    input: { model: AI_MODELS.embedding, count: values.length, sample: values.slice(0, 3).map((v) => v.slice(0, 300)) },
    metadata: { feature: 'embedding', model: AI_MODELS.embedding },
  })
  try {
    const { embeddings, usage } = await embeddingModel.doEmbed({
      values,
      providerOptions: { openai: { dimensions: EMBEDDING_DIMENSIONS } },
    })
    span?.end({ output: { vectors: embeddings.length, dimensions: embeddings[0]?.length ?? 0, usage } })
    return embeddings
  } catch (error) {
    span?.error({ error: error instanceof Error ? error : new Error(String(error)) })
    throw error
  }
}

/** pgvector literal, e.g. "[0.1,0.2]". */
export function toVector(values: number[]) {
  return `[${values.join(',')}]`
}

/** Embedding for a search query, cached in search_query_cache so each query is embedded once. */
export async function queryEmbedding(normalizedQuery: string): Promise<string | null> {
  const cached = await db.query<{ embedding: string | null }>(
    'select embedding::text from search_query_cache where normalized_query = $1',
    [normalizedQuery],
  )
  if (cached.rows[0]?.embedding) return cached.rows[0].embedding
  const [vector] = await embedTexts([normalizedQuery])
  const literal = toVector(vector)
  await db.query(
    `insert into search_query_cache (normalized_query, intent, source, embedding) values ($1, null, 'embedding', $2::vector)
     on conflict (normalized_query) do update set embedding = excluded.embedding`,
    [normalizedQuery, literal],
  )
  return literal
}

let embeddingColumn: Promise<boolean> | null = null

/** True once migration 002 (pgvector) has been applied. */
export function hasEmbeddingColumn() {
  embeddingColumn ??= db
    .query(
      `select 1 from information_schema.columns where table_name = 'template_search' and column_name = 'embedding'`,
    )
    .then((r) => (r.rowCount ?? 0) > 0)
    .catch(() => false)
  return embeddingColumn
}
