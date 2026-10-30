/**
 * Tags templates with the rule-based enricher (no AI).
 * Templates already enriched by AI are skipped unless they changed since.
 * Usage: npm run search:enrich-rules            (new or changed templates)
 *        npm run search:enrich-rules -- --all   (redo every non-AI template)
 */
import { db } from '@/lib/db'
import { saveEnrichments, type EnrichmentRecord } from '@/lib/search/enrichment-store'
import { ruleEnrich } from '@/lib/search/rule-enrich'
import { refreshTermCounts } from '@/lib/search/vocabulary'

const BATCH = 1000

type Row = {
  template_id: number
  name: string
  card_text: string
  tags: string[]
  is_featured: boolean
  photo_slot: boolean
  source_hash: string
}

async function main() {
  const all = process.argv.includes('--all')
  const where = all
    ? `enrich_source <> 'ai' or enriched_hash <> source_hash`
    : `enriched_hash <> source_hash`

  const { rows } = await db.query<Row>(
    `select template_id, name, card_text, tags, is_featured, photo_slot, source_hash
       from template_search where ${where} order by template_id`,
  )
  console.log(`enriching ${rows.length} templates with rules`)

  let saved = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const records: EnrichmentRecord[] = rows.slice(i, i + BATCH).map((row) => ({
      templateId: row.template_id,
      sourceHash: row.source_hash,
      ...ruleEnrich({ name: row.name, cardText: row.card_text, tags: row.tags, isFeatured: row.is_featured, photoSlot: row.photo_slot }),
    }))
    saved += await saveEnrichments(records, 'rules')
  }
  console.log(`saved ${saved}`)
  await refreshTermCounts()
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.end())
