/**
 * AI enrichment of templates (costs money; run only after approval).
 *
 *   npm run search:enrich-ai -- --estimate                 how many templates and tokens a full run needs
 *   npm run search:enrich-ai -- --dry-run                  20 templates, print results, save nothing
 *   npm run search:enrich-ai -- --dry-run --limit 50
 *   npm run search:enrich-ai -- --dry-run --ids 71518,49301   only these templates
 *   npm run search:enrich-ai -- --dry-run --test-set       the templates in scripts/template-test-set.json
 *   npm run search:enrich-ai -- --yes                      enrich every new or changed template and save
 *   npm run search:enrich-ai -- --yes --limit 500 --parallel 3   one batch: the next 500 templates, 3 at a time
 *
 * Runs started with --yes end with a batch report (time, real tokens and cost from the traces,
 * new vocabulary terms, templates left). Batches continue where the last one stopped.
 * Needs OPENAI_API_KEY and SEARCH_AI_ENABLED=true. Resumable: only templates whose content
 * changed since their last AI enrichment are processed (unless --ids or --test-set picks them).
 * To score AI against the test set, use npm run search:check -- --ai.
 */
import {db} from '@/lib/db'
import {flushTracesAndClose} from './lib/close'
import {isAiEnabled, AI_MODELS, MODEL_PRICES} from '@/lib/search/ai-config'
import {printBatchReport} from './lib/batch-report'
import {DEFAULT_PARALLEL, runAiEnrichment} from './lib/run-ai-enrichment'
import {loadTestSet} from './lib/test-set'

/**
 * Token use per template, measured on gpt-6-luna on 2026-10-28 (2 test templates, from the traces):
 * - shared: instructions + answer schema + vocabulary, the same for every template (cached): 3,387.
 * - own: card text + cover image: ~1,265.
 * - output: ~210 tokens of tags plus ~140 of low-effort thinking; rounded up for longer cards.
 */
const TOKENS_PER_TEMPLATE = {shared: 3400, own: 1300, output: 400}
/** Share of requests expected to reuse the cached part; it is rewritten when the vocabulary grows. */
const CACHE_HIT_RATE = 0.9

/** Estimated USD for enriching `count` templates, or null when the model has no price listed. */
function estimateCost(model: string, count: number) {
    const price = MODEL_PRICES[model]
    if (!price) return null
    const t = TOKENS_PER_TEMPLATE
    const shared = t.shared * (CACHE_HIT_RATE * price.cached + (1 - CACHE_HIT_RATE) * price.cacheWrite)
    return (count * (shared + t.own * price.input + t.output * price.output)) / 1e6
}

function arg(name: string) {
    const i = process.argv.indexOf(name)
    return i >= 0 ? process.argv[i + 1] : undefined
}

async function pickTemplates(dryRun: boolean): Promise<number[]> {
    const idArg = arg('--ids')
    if (idArg) return idArg.split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n > 0)
    if (process.argv.includes('--test-set')) return (await loadTestSet()).map((t) => t.id)

    const limit = Number(arg('--limit') ?? (dryRun ? 20 : 0)) || undefined
    const {rows} = await db.query<{ template_id: number }>(
        `select template_id
         from template_search
         where enrich_source <> 'ai'
            or enriched_hash <> source_hash
         order by created_at desc ${limit ? `limit ${limit}` : ''}`,
    )
    return rows.map((r) => r.template_id)
}

/** Set when a run starts, so the report at the end covers only this run. */
let report: { startedAt: Date; tagged: number; failed: number } | null = null

async function main() {
    const dryRun = process.argv.includes('--dry-run')
    const estimate = process.argv.includes('--estimate')
    const confirmed = process.argv.includes('--yes')

    const ids = await pickTemplates(dryRun)
    console.log(`${ids.length} templates to enrich (model ${AI_MODELS.enrich}, embeddings ${AI_MODELS.embedding})`)
    const tokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}k`)
    const t = TOKENS_PER_TEMPLATE
    console.log(
        `estimated tokens: ~${tokens(ids.length * (t.shared + t.own))} input ` +
        `(~${tokens(ids.length * t.shared)} of it cacheable), ~${tokens(ids.length * t.output)} output`,
    )
    const cost = estimateCost(AI_MODELS.enrich, ids.length)
    console.log(
        cost === null
            ? `No price listed for ${AI_MODELS.enrich}; add it to MODEL_PRICES in src/lib/search/ai-config.ts.`
            : `estimated cost: ~$${cost.toFixed(2)} (Standard tier, ${CACHE_HIT_RATE * 100}% cache hits; prices checked 2026-10-28)`,
    )

    if (estimate || ids.length === 0) return
    if (!isAiEnabled()) {
        console.log('AI is off. Set OPENAI_API_KEY and SEARCH_AI_ENABLED=true in .env to run.')
        return
    }
    if (!dryRun && !confirmed) {
        console.log('Nothing done. Run with --dry-run first, then --yes for the full run.')
        return
    }

    const parallel = Math.min(20, Math.max(1, Number(arg('--parallel') ?? DEFAULT_PARALLEL) || DEFAULT_PARALLEL))
    console.log(`tagging ${parallel} at a time`)
    report = {startedAt: new Date(), tagged: 0, failed: 0}
    const result = await runAiEnrichment(ids, {
        save: !dryRun,
        parallel,
        onBatch: (done, total, out) => {
            for (const f of out.failed) console.error(`template ${f.templateId}: ${f.error}`)
            if (dryRun) {
                for (const e of out.enriched) {
                    console.log(`\n#${e.templateId} ${e.occasion} (${e.occasionConfidence}) milestone=${e.milestone} q=${e.qualityScore}`)
                    console.log(`  gender=${e.gender} themes=${e.themes.join(',')} assets=${e.assets.join(',')} styles=${e.styles.join(',')} colors=${e.colors.join(',')}`)
                    if (e.newTerms.length) console.log(`  new terms: ${e.newTerms.join(', ')}`)
                    console.log(`  ${e.summary}`)
                }
            }
            console.log(`progress ${done}/${total}`)
        },
    })
    console.log(`\nsaved ${result.saved} · failed ${result.failed.length}`)
    report.tagged = result.enriched.length
    report.failed = result.failed.length
    if (dryRun) console.log('Dry run: templates were not saved. New vocabulary terms were kept, so later runs reuse them.')
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(() => flushTracesAndClose(report ? () => printBatchReport(report!) : undefined))
