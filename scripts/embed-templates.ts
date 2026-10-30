/**
 * Embeds templates for meaning-based search (costs money; run only after approval).
 *
 *   npm run search:embed -- --estimate          how many templates, tokens and dollars
 *   npm run search:embed -- --show 5            print the text that would be embedded for 5 templates
 *   npm run search:embed -- --yes               embed every new or changed template and save
 *   npm run search:embed -- --yes --limit 500   only the next 500
 *   npm run search:embed -- --yes --all         re-embed everything (after changing the model or the text)
 *
 * Needs pgvector (migration 002), OPENAI_API_KEY and SEARCH_AI_ENABLED=true. Resumable: each batch of
 * 100 is saved as it finishes, and templates whose text has not changed are skipped.
 */
import { db } from '@/lib/db'
import { AI_MODELS, EMBEDDING_DIMENSIONS, EMBEDDING_PRICES, isAiEnabled } from '@/lib/search/ai-config'
import { hasEmbeddingColumn } from '@/lib/search/embeddings'
import { embedAndStore, templatesToEmbed } from '@/lib/search/template-embeddings'
import { flushTracesAndClose } from './lib/close'

function arg(name: string) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

/** Rough token count: about 4 characters per token for English, fewer for Hindi and other scripts. */
function tokensFor(text: string) {
  const ascii = text.replace(/[^\x00-\x7F]/g, '').length
  return Math.ceil(ascii / 4 + (text.length - ascii) / 1.5)
}

async function main() {
  if (!(await hasEmbeddingColumn())) {
    console.log('No embedding column yet. Install pgvector, then run npm run db:migrate (see db/migrations/002_template_embeddings.sql).')
    return
  }
  const limit = Number(arg('--limit')) || undefined
  const jobs = await templatesToEmbed({ all: process.argv.includes('--all'), limit })
  const tokens = jobs.reduce((sum, j) => sum + tokensFor(j.text), 0)
  const price = EMBEDDING_PRICES[AI_MODELS.embedding]
  console.log(`${jobs.length} templates to embed with ${AI_MODELS.embedding} (${EMBEDDING_DIMENSIONS} dimensions)`)
  console.log(
    `estimated tokens: ~${tokens.toLocaleString()} · cost: ${price === undefined ? 'no price listed in EMBEDDING_PRICES' : `~$${((tokens * price) / 1e6).toFixed(3)}`}`,
  )

  const show = Number(arg('--show'))
  if (show) for (const j of jobs.slice(0, show)) console.log(`\n#${j.templateId}: ${j.text}`)

  if (process.argv.includes('--estimate') || show || jobs.length === 0) return
  if (!isAiEnabled()) {
    console.log('AI is off. Set OPENAI_API_KEY and SEARCH_AI_ENABLED=true in .env to run.')
    return
  }
  if (!process.argv.includes('--yes')) {
    console.log('Nothing done. Run with --estimate first, then --yes.')
    return
  }

  const started = Date.now()
  const done = await embedAndStore(jobs, (n) => {
    if (n % 1000 === 0 || n === jobs.length) console.log(`embedded ${n}/${jobs.length}`)
  })
  console.log(`done: ${done} templates in ${Math.round((Date.now() - started) / 1000)}s`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => flushTracesAndClose().catch(() => db.end()))
