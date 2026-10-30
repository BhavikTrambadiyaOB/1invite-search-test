/**
 * Clears cached query data so searches are read fresh.
 *
 *   npm run search:clear-cache            forget AI readings of queries (each is asked again on its next search)
 *   npm run search:clear-cache -- --all   also forget query embeddings (needed after changing the embedding model)
 *
 * Templates, tags and template embeddings are not touched. Restart the dev server too: it keeps the
 * vocabulary (1 minute) and tag counts (10 minutes) in memory.
 */
import { db } from '@/lib/db'

async function main() {
  const all = process.argv.includes('--all')
  if (all) {
    const { rowCount } = await db.query('delete from search_query_cache')
    console.log(`removed ${rowCount ?? 0} cached queries (AI readings and embeddings)`)
    return
  }
  // Rows that also hold an embedding keep it; only the AI reading is dropped.
  const dropped = await db.query(`delete from search_query_cache where intent is not null and embedding is null`)
  const cleared = await db.query(`update search_query_cache set intent = null where intent is not null`)
  console.log(`cleared ${(dropped.rowCount ?? 0) + (cleared.rowCount ?? 0)} cached AI readings of queries (query embeddings kept)`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.end())
