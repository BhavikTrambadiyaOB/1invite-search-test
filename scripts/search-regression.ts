/**
 * Safety net for search changes: save the results of every report query, change the code, save again, compare.
 *
 *   npm run search:snapshot -- baseline             run all search_report queries, save search-snapshots/baseline.json
 *   npm run search:snapshot -- after-b1
 *   npm run search:compare -- baseline after-b1     write SEARCH-REGRESSION.md (winners, losers, zeros, metrics)
 *
 * Snapshots reuse cached query readings and embeddings, so they normally make no AI calls.
 * The snapshot prints how many new cache rows (= AI calls) a run added.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { db } from '@/lib/db'
import { searchTemplates } from '@/lib/search/search-templates'
import { flushTracesAndClose } from './lib/close'

const DIR = 'search-snapshots'
const TOP = 24
const CONCURRENCY = 6

type Row = { id: number; occasion: string | null; milestone: number | null; created: string; relevance: number }
type Entry = { query: string; total: number; exactTotal: number; intentOccasion: string | null; error?: string; top: Row[] }
type Snapshot = { name: string; at: string; entries: Entry[] }

async function snapshot(name: string) {
  const { rows } = await db.query<{ query: string }>('select query from search_report order by id')
  const cacheBefore = await cacheRows()
  const entries: Entry[] = new Array(rows.length)
  let next = 0
  let done = 0
  // Errors are logged by search itself (e.g. empty-text embeddings); keep the output readable.
  const quiet = console.error
  console.error = () => {}
  const worker = async () => {
    while (next < rows.length) {
      const i = next++
      const query = rows[i].query
      try {
        const r = await searchTemplates({ query })
        entries[i] = {
          query,
          total: r.total,
          exactTotal: r.exactTotal,
          intentOccasion: r.intent.occasion,
          top: r.results.slice(0, TOP).map((x) => ({
            id: x.id,
            occasion: x.occasion,
            milestone: x.milestone,
            created: x.createdAt,
            relevance: Math.round(x.debug.relevance * 1000) / 1000,
          })),
        }
      } catch (error) {
        entries[i] = { query, total: 0, exactTotal: 0, intentOccasion: null, error: String(error), top: [] }
      }
      if (++done % 100 === 0) process.stdout.write(`${done}/${rows.length}\n`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.error = quiet
  await mkdir(DIR, { recursive: true })
  const file = path.join(DIR, `${name}.json`)
  await writeFile(file, JSON.stringify({ name, at: new Date().toISOString(), entries } satisfies Snapshot))
  const added = (await cacheRows()) - cacheBefore
  console.log(`saved ${entries.length} queries to ${file}; errors: ${entries.filter((e) => e.error).length}; new AI cache rows: ${added}`)
}

async function cacheRows() {
  const { rows } = await db.query<{ c: number }>('select count(*)::int c from search_query_cache')
  return rows[0].c
}

const load = async (name: string): Promise<Snapshot> => JSON.parse(await readFile(path.join(DIR, `${name}.json`), 'utf8'))

const avgYear = (e: Entry) => {
  const ys = e.top.slice(0, 10).map((r) => new Date(r.created).getFullYear() + new Date(r.created).getMonth() / 12)
  return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : null
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

function metrics(s: Snapshot) {
  const years = s.entries.map(avgYear).filter((y): y is number => y !== null)
  return {
    zero: s.entries.filter((e) => e.total === 0).length,
    under10: s.entries.filter((e) => e.total < 10).length,
    under40: s.entries.filter((e) => e.total < 40).length,
    fullCatalog: s.entries.filter((e) => e.total >= 11000).length,
    errors: s.entries.filter((e) => e.error).length,
    avgYearTop10: years.reduce((a, b) => a + b, 0) / years.length,
    avgRelevanceTop10: avg(s.entries.flatMap((e) => e.top.slice(0, 10).map((r) => r.relevance))),
    olderThan2022Top10: s.entries.flatMap((e) => e.top.slice(0, 10)).filter((r) => r.created < '2022').length,
  }
}

type Change = { query: string; a: Entry; b: Entry; overlap10: number; why: string[] }

async function compare(aName: string, bName: string) {
  const a = await load(aName)
  const b = await load(bName)
  const byQuery = new Map(b.entries.map((e) => [e.query, e]))
  const losers: Change[] = []
  const winners: Change[] = []
  const reordered: Change[] = []
  let same = 0
  for (const ea of a.entries) {
    const eb = byQuery.get(ea.query)
    if (!eb) continue
    const ids10 = new Set(ea.top.slice(0, 10).map((r) => r.id))
    const overlap10 = eb.top.slice(0, 10).filter((r) => ids10.has(r.id)).length
    const sameTop = ea.top.map((r) => r.id).join() === eb.top.map((r) => r.id).join()
    if (sameTop && ea.total === eb.total && ea.exactTotal === eb.exactTotal) {
      same++
      continue
    }
    const lose: string[] = []
    const win: string[] = []
    if (ea.total > 0 && eb.total === 0) lose.push('went to 0 results')
    if (eb.total < ea.total) lose.push(`total ${ea.total} → ${eb.total}`)
    else if (eb.total > ea.total) win.push(`total ${ea.total} → ${eb.total}`)
    if (eb.exactTotal < ea.exactTotal) lose.push(`exact ${ea.exactTotal} → ${eb.exactTotal}`)
    else if (eb.exactTotal > ea.exactTotal) win.push(`exact ${ea.exactTotal} → ${eb.exactTotal}`)
    if (ea.intentOccasion !== eb.intentOccasion) lose.push(`occasion ${ea.intentOccasion} → ${eb.intentOccasion}`)
    if (overlap10 < 6 && ea.top.length >= 10) lose.push(`top 10 changed a lot (${overlap10}/10 kept)`)
    if (eb.error && !ea.error) lose.push('error')
    const change = { query: ea.query, a: ea, b: eb, overlap10, why: [...lose, ...win] }
    if (lose.length) losers.push(change)
    else if (win.length) winners.push(change)
    else reordered.push(change)
  }

  const ma = metrics(a)
  const mb = metrics(b)
  const metricRow = (label: string, x: number, y: number, digits = 0) =>
    `| ${label} | ${x.toFixed(digits)} | ${y.toFixed(digits)} | ${y - x > 0 ? '+' : ''}${(y - x).toFixed(digits)} |`
  const line = (c: Change) =>
    `| ${c.query.replace(/\|/g, '/').slice(0, 70)} | ${c.a.total} → ${c.b.total} | ${c.a.exactTotal} → ${c.b.exactTotal} | ${c.overlap10}/10 | ${c.why.join('; ')} |`
  const table = (list: Change[]) =>
    list.length
      ? ['| Query | Total | Exact | Top 10 kept | Why |', '|---|---|---|---|---|', ...list.map(line)].join('\n')
      : '_None._'
  const md = `# Search regression: ${aName} → ${bName}

${a.entries.length} report queries. ${same} unchanged, ${winners.length} winners, ${losers.length} to review, ${reordered.length} reordered only.

| Metric | ${aName} | ${bName} | Change |
|---|---|---|---|
${metricRow('Zero results', ma.zero, mb.zero)}
${metricRow('Under 10 results', ma.under10, mb.under10)}
${metricRow('Under 40 results', ma.under40, mb.under40)}
${metricRow('Whole catalog (≥ 11,000)', ma.fullCatalog, mb.fullCatalog)}
${metricRow('Errors', ma.errors, mb.errors)}
${metricRow('Avg year of top 10', ma.avgYearTop10, mb.avgYearTop10, 2)}
${metricRow('Avg relevance of top 10', ma.avgRelevanceTop10, mb.avgRelevanceTop10, 3)}
${metricRow('Top-10 cards older than 2022', ma.olderThan2022Top10, mb.olderThan2022Top10)}

## To review (something dropped)
${table(losers.sort((x, y) => y.why.length - x.why.length))}

## Winners (more results or more exact matches, nothing dropped)
${table(winners.sort((x, y) => y.b.total - y.a.total - (x.b.total - x.a.total)))}

## Reordered only (same counts)
${table(reordered.sort((x, y) => x.overlap10 - y.overlap10))}
`
  await writeFile('SEARCH-REGRESSION.md', md)
  console.log(`wrote SEARCH-REGRESSION.md: ${same} same, ${winners.length} winners, ${losers.length} to review, ${reordered.length} reordered`)
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'snapshot' && args[0]) return snapshot(args[0])
  if (command === 'compare' && args[0] && args[1]) return compare(args[0], args[1])
  console.log('Usage: search-regression snapshot <name> | compare <before> <after>')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => flushTracesAndClose())
