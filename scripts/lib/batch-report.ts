import { db } from '@/lib/db'
import { MODEL_PRICES } from '@/lib/search/ai-config'

type Usage = {
  inputTokens?: number
  outputTokens?: number
  inputDetails?: { text?: number; cacheRead?: number; cacheWrite?: number }
  outputDetails?: { text?: number; reasoning?: number }
}

/**
 * Prints what an AI enrichment run did, read from the traces and the database (no AI calls):
 * time, real tokens and cost, new vocabulary terms, and how many templates are left.
 * Call it after traces are flushed (flushTracesAndClose runs it before closing the pool).
 */
export async function printBatchReport({ startedAt, tagged, failed }: { startedAt: Date; tagged: number; failed: number }) {
  const seconds = (Date.now() - startedAt.getTime()) / 1000

  const spans = await db.query<{ model: string; usage: Usage | null; agent: string | null }>(
    `select attributes->>'model' as model, attributes->'usage' as usage, "entityName" as agent
       from mastra_span_events
      where "spanType" = 'model_generation' and not "isPending" and "startedAt" >= $1`,
    [startedAt],
  )

  const totals = { calls: 0, uncached: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0, cost: 0 }
  const callsByAgent = new Map<string, number>()
  let unpriced = 0
  for (const { model, usage, agent } of spans.rows) {
    if (!usage) continue
    const read = usage.inputDetails?.cacheRead ?? 0
    const write = usage.inputDetails?.cacheWrite ?? 0
    const uncached = usage.inputDetails?.text ?? Math.max(0, (usage.inputTokens ?? 0) - read - write)
    const output = usage.outputTokens ?? 0
    totals.calls++
    totals.uncached += uncached
    totals.cacheRead += read
    totals.cacheWrite += write
    totals.output += output
    totals.reasoning += usage.outputDetails?.reasoning ?? 0
    callsByAgent.set(agent ?? 'other', (callsByAgent.get(agent ?? 'other') ?? 0) + 1)
    const price = MODEL_PRICES[model.includes('/') ? model : `openai/${model}`]
    if (!price) {
      unpriced++
      continue
    }
    totals.cost += (uncached * price.input + read * price.cached + write * price.cacheWrite + output * price.output) / 1e6
  }

  const newTerms = await db.query<{ kind: string; id: string; themes: string[] }>(
    `select kind, id, themes from vocab_term where source = 'ai' and created_at >= $1 order by kind, id`,
    [startedAt],
  )
  const left = await db.query<{ n: number }>(
    `select count(*)::int n from template_search where enrich_source <> 'ai' or enriched_hash <> source_hash`,
  )
  const remaining = left.rows[0].n

  const k = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString())
  const perTemplate = tagged > 0 ? totals.cost / tagged : 0
  console.log('\n──────── Batch report ────────')
  console.log(`tagged ${tagged} · failed ${failed} (failed ones are picked up by the next batch)`)
  console.log(`time ${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s · ${tagged > 0 ? (seconds / tagged).toFixed(1) : '—'}s per template`)
  console.log(
    `AI calls ${totals.calls} (${[...callsByAgent].map(([a, n]) => `${a}: ${n}`).join(', ')})`,
  )
  console.log(
    `tokens: input ${k(totals.uncached)} uncached + ${k(totals.cacheRead)} cache read + ${k(totals.cacheWrite)} cache write · ` +
      `output ${k(totals.output)} (thinking ${k(totals.reasoning)})`,
  )
  console.log(
    `cost $${totals.cost.toFixed(4)} · $${perTemplate.toFixed(5)} per template` +
      (unpriced ? ` · ${unpriced} calls with no listed price not counted` : ''),
  )
  console.log(`left ${remaining} templates · at this rate about $${(perTemplate * remaining).toFixed(2)} more`)
  console.log(
    newTerms.rows.length
      ? `new terms ${newTerms.rows.length}: ${newTerms.rows.map((t) => `${t.kind}:${t.id}${t.themes.length ? ` (${t.themes.join(',')})` : ''}`).join(', ')}`
      : 'new terms 0',
  )
  console.log('──────────────────────────────')
}
