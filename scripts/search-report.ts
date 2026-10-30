/**
 * Captures live and current search results and suggested tags for /search/report.
 *
 * Usage:
 *   npm run search:report:snapshot -- "5th Wedding Anniversary" "Dinner Invitation"
 *   npm run search:report:snapshot -- --file queries.txt
 *   npm run search:report:snapshot -- --csv "1invites_user_search - Occasion_Wise.csv"
 *   npm run search:report:snapshot -- --from-import --limit 1
 *   npm run search:report:snapshot -- --refresh
 *
 * `--csv` imports the occasion-wise export into search_report_import. It does not run the queries.
 * `--from-import` captures pending imported queries; `--limit N` caps the batch.
 * `--file` accepts a JSON array of query strings, {"queries": [...]} or one query per line.
 * `--refresh` reruns every query already stored in the report.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { db } from '@/lib/db'
import { flushTracesAndClose } from './lib/close'
import { parseOccasionCsv } from '@/lib/search/report-csv'
import {
  importSearchReportQueries,
  listPendingImportedQueries,
  markImportedQueryRun,
} from '@/lib/search/report-import'
import {
  captureCurrentReport,
  captureLiveReport,
  saveSearchReport,
} from '@/lib/search/report'

type Options = {
  queries: string[]
  file?: string
  csv?: string
  refresh: boolean
  fromImport: boolean
  limit?: number
  help: boolean
}

function usage() {
  console.log(`Usage:
  npm run search:report:snapshot -- "query one" "query two"
  npm run search:report:snapshot -- --file path/to/queries.txt
  npm run search:report:snapshot -- --csv "1invites_user_search - Occasion_Wise.csv"
  npm run search:report:snapshot -- --from-import --limit 1
  npm run search:report:snapshot -- --refresh

File formats: JSON array of strings, {"queries": ["..."]}, or one query per line.`)
}

function parseArgs(args: string[]): Options {
  const options: Options = { queries: [], refresh: false, fromImport: false, help: false }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg.startsWith('--')) {
      options.queries.push(arg)
      continue
    }

    const equals = arg.indexOf('=')
    const name = equals >= 0 ? arg.slice(0, equals) : arg
    const inline = equals >= 0 ? arg.slice(equals + 1) : undefined
    const value = () => {
      const next = inline ?? args[++i]
      if (next === undefined) throw new Error(`${name} needs a value`)
      return next
    }

    switch (name) {
      case '--help':
      case '-h':
        options.help = true
        break
      case '--file':
        options.file = value()
        break
      case '--csv':
        options.csv = value()
        break
      case '--refresh':
        options.refresh = true
        break
      case '--from-import':
        options.fromImport = true
        break
      case '--limit': {
        const limit = Number.parseInt(value(), 10)
        if (!Number.isInteger(limit) || limit <= 0) throw new Error('--limit must be a positive number')
        options.limit = limit
        break
      }
      default:
        throw new Error(`Unknown option ${name}`)
    }
  }

  return options
}

async function queriesFromFile(file: string): Promise<string[]> {
  const text = await readFile(file, 'utf8')
  const trimmed = text.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed: unknown = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return parsed.filter((q): q is string => typeof q === 'string')
    if (typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { queries?: unknown }).queries)) {
      return (parsed as { queries: unknown[] }).queries.filter((q): q is string => typeof q === 'string')
    }
    throw new Error('JSON file must be an array of strings or {"queries": [...]}')
  }

  return trimmed.split(/\r?\n/)
}

function cleanQuery(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function cleanQueries(queries: string[]) {
  return [...new Set(queries.map(cleanQuery).filter(Boolean))]
}

async function storedQueries() {
  const { rows } = await db.query<{ query: string }>('select query from search_report order by id')
  return rows.map((row) => row.query)
}

type Target = { query: string; importIds: string[] }

function addTarget(map: Map<string, Target>, query: string, importId?: string) {
  const cleaned = cleanQuery(query)
  if (!cleaned) return
  const key = cleaned.toLowerCase()
  const existing = map.get(key)
  if (existing) {
    if (importId && !existing.importIds.includes(importId)) existing.importIds.push(importId)
    return
  }
  map.set(key, { query: cleaned, importIds: importId ? [importId] : [] })
}

async function main() {
  let options: Options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    usage()
    process.exitCode = 1
    return
  }

  if (options.help) {
    usage()
    return
  }

  if (options.csv) {
    const text = await readFile(options.csv, 'utf8')
    const parsed = parseOccasionCsv(text)
    const result = await importSearchReportQueries(parsed, path.basename(options.csv))
    console.log(
      `Imported ${result.rows.toLocaleString()} queries from ${path.basename(options.csv)} (${result.saved.toLocaleString()} saved).`,
    )
  }

  const byQuery = new Map<string, Target>()
  for (const query of options.queries) addTarget(byQuery, query)
  if (options.file) {
    for (const query of await queriesFromFile(options.file)) addTarget(byQuery, query)
  }
  if (options.refresh) {
    for (const query of await storedQueries()) addTarget(byQuery, query)
  }
  if (options.fromImport) {
    for (const row of await listPendingImportedQueries(options.limit)) addTarget(byQuery, row.query, row.id)
  }

  const targets = [...byQuery.values()]
  if (targets.length === 0) {
    if (options.csv) {
      console.log('CSV imported. Run `npm run search:report:snapshot -- --from-import --limit 1` to capture a query.')
      return
    }
    usage()
    process.exitCode = 1
    return
  }

  console.log(`Capturing ${targets.length} ${targets.length === 1 ? 'query' : 'queries'} (first 40 results each)\n`)

  let failed = 0
  for (const [index, target] of targets.entries()) {
    process.stdout.write(`[${index + 1}/${targets.length}] ${target.query}\n`)
    const [live, current] = await Promise.all([captureLiveReport(target.query), captureCurrentReport(target.query)])
    const id = await saveSearchReport(target.query, live, current)
    for (const importId of target.importIds) await markImportedQueryRun(importId, id)

    console.log(`  report #${id}`)
    console.log(
      `  live:    ${live.error ?? `${live.snapshot?.results.length ?? 0} shown${live.snapshot?.total != null ? ` of ${live.snapshot.total}` : ''}`}`,
    )
    console.log(
      `  live tags: ${live.snapshot?.suggestionsError ?? (live.snapshot ? `${live.snapshot.suggestedTags?.length ?? 0} tags` : 'not captured')}`,
    )
    console.log(
      `  current: ${current.error ?? `${current.snapshot?.results.length ?? 0} shown${current.snapshot?.total != null ? ` of ${current.snapshot.total}` : ''}`}`,
    )
    console.log(`  current tags: ${current.snapshot ? `${current.snapshot.suggestedTags?.length ?? 0} tags` : 'not captured'}`)
    if (live.error || current.error || live.snapshot?.suggestionsError) failed++
    console.log()
  }

  console.log(`Saved ${targets.length} ${targets.length === 1 ? 'query' : 'queries'}${failed ? `, ${failed} with an error` : ''}.`)
  console.log('Open /search/report to review them.')
  if (failed) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => flushTracesAndClose())
