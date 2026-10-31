/**
 * Captures live and current search results and suggested tags for /search/report.
 *
 * Usage:
 *   npm run search:report:snapshot -- "5th Wedding Anniversary" "Dinner Invitation"
 *   npm run search:report:snapshot -- --file queries.txt
 *   npm run search:report:snapshot -- --csv "1invites_user_search - Occasion_Wise.csv"
 *   npm run search:report:snapshot -- --from-import --limit 1
 *   npm run search:report:snapshot -- --phase=2 --limit=10
 *   npm run search:report:snapshot -- --refresh
 *
 * `--csv` imports the occasion-wise export into search_report_import. It does not run the queries.
 * `--from-import` captures pending imported queries; `--limit N` caps the batch.
 * `--phase N` captures all imported and stored queries not yet captured in that phase.
 * Phase runs resume between batches; each run captures at most three queries concurrently.
 * `--file` accepts a JSON array of query strings, {"queries": [...]} or one query per line.
 * `--refresh` reruns every query already stored in the report.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { db } from '@/lib/db'
import { flushTracesAndClose } from './lib/close'
import { parseOccasionCsv } from '@/lib/search/report-csv'
import { normalizeQuery } from '@/lib/search/parse-query'
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
  phase?: number
  help: boolean
}

function usage() {
  console.log(`Usage:
  npm run search:report:snapshot -- "query one" "query two"
  npm run search:report:snapshot -- --file path/to/queries.txt
  npm run search:report:snapshot -- --csv "1invites_user_search - Occasion_Wise.csv"
  npm run search:report:snapshot -- --from-import --limit 1
  npm run search:report:snapshot -- --phase=2 --limit=10
  npm run search:report:snapshot -- --refresh

Phase runs resume automatically. Omit --limit to capture every remaining query in that phase.
At most 3 queries run concurrently. Requesting a phase beyond the next phase starts the next phase.
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
        const limit = Number(value())
        if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error('--limit must be a positive number')
        options.limit = limit
        break
      }
      case '--phase': {
        const phase = Number(value())
        if (!Number.isSafeInteger(phase) || phase <= 0) throw new Error('--phase must be a positive number')
        options.phase = phase
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

async function storedQueries() {
  const { rows } = await db.query<{ query: string }>('select query from search_report order by id')
  return rows.map((row) => row.query)
}

async function storedQueriesForPhase(phase: number) {
  const { rows } = await db.query<{ query: string }>(
    `select distinct source.query
       from search_report source
      where not exists (
        select 1
          from search_report captured
         where captured.phase = $1
           and (
             captured.normalized_query = source.normalized_query or
             lower(regexp_replace(trim(captured.query), '[[:space:]]+', ' ', 'g')) =
               lower(regexp_replace(trim(source.query), '[[:space:]]+', ' ', 'g'))
           )
           and captured.live_snapshot is not null
           and captured.current_snapshot is not null
           and captured.live_error is null
           and captured.current_error is null
      )
      order by source.query`,
    [phase],
  )
  return rows.map((row) => row.query)
}

async function importedQueriesForPhase(phase: number) {
  const { rows } = await db.query(
    `select i.id, i.query, i.occasion, i.last_run_at
       from search_report_import i
      where not exists (
        select 1
          from search_report captured
         where captured.id = i.last_report_id
           and captured.phase = $1
           and captured.live_snapshot is not null
           and captured.current_snapshot is not null
           and captured.live_error is null
           and captured.current_error is null
      )
      order by i.id`,
    [phase],
  )
  return rows.map((row) => ({
    id: String(row.id),
    query: row.query,
    occasion: row.occasion,
    lastRunAt: row.last_run_at ? new Date(row.last_run_at).toISOString() : null,
  }))
}

async function latestReportPhase() {
  const { rows } = await db.query<{ phase: number | null }>(
    'select max(phase)::int as phase from search_report',
  )
  return rows[0]?.phase ?? 0
}

type Target = { query: string; importIds: string[] }

function addTarget(map: Map<string, Target>, query: string, importId?: string) {
  const cleaned = cleanQuery(query)
  if (!cleaned) return
  const key = normalizeQuery(cleaned) || cleaned.toLowerCase()
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

  if (options.phase !== undefined && (options.fromImport || options.refresh || options.file || options.csv || options.queries.length)) {
    console.error('--phase cannot be combined with --from-import, --refresh, --file, --csv, or positional queries')
    usage()
    process.exitCode = 1
    return
  }
  if (options.limit !== undefined && !options.fromImport && options.phase === undefined) {
    console.error('--limit requires --from-import or --phase')
    usage()
    process.exitCode = 1
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
  let phase = options.phase
  if (phase !== undefined) {
    const maxPhase = await latestReportPhase()
    const nextPhase = maxPhase + 1
    if (phase > nextPhase) {
      console.log(`Phase ${phase} is ahead of the next phase. Starting Phase ${nextPhase} (latest saved phase: ${maxPhase}).`)
      phase = nextPhase
    }
    for (const row of await importedQueriesForPhase(phase)) addTarget(byQuery, row.query, row.id)
    for (const query of await storedQueriesForPhase(phase)) addTarget(byQuery, query)
  } else {
    for (const query of options.queries) addTarget(byQuery, query)
    if (options.file) {
      for (const query of await queriesFromFile(options.file)) addTarget(byQuery, query)
    }
    if (options.refresh) {
      for (const query of await storedQueries()) addTarget(byQuery, query)
    }
  }
  if (options.fromImport) {
    for (const row of await listPendingImportedQueries(options.limit)) addTarget(byQuery, row.query, row.id)
  }

  const allTargets = [...byQuery.values()]
  const targets = options.limit === undefined ? allTargets : allTargets.slice(0, options.limit)
  if (targets.length === 0) {
    if (phase !== undefined) {
      console.log(`Phase ${phase} is already complete. Visit /search/report?phase=${phase} to review the results.`)
      return
    }
    if (options.csv) {
      console.log('CSV imported. Run `npm run search:report:snapshot -- --from-import --limit 1` to capture a query.')
      return
    }
    usage()
    process.exitCode = 1
    return
  }

  console.log(
    `Capturing ${targets.length} ${targets.length === 1 ? 'query' : 'queries'}${phase !== undefined ? ` for Phase ${phase}` : ''} (first 40 results each; up to 3 at a time)\n`,
  )

  let failed = 0
  let nextTarget = 0
  async function captureWorker() {
    while (nextTarget < targets.length) {
      const index = nextTarget++
      const target = targets[index]
      const prefix = `[${index + 1}/${targets.length}]`
      console.log(`${prefix} Starting${phase !== undefined ? ` Phase ${phase}:` : ''} ${target.query}`)
      try {
        const [live, current] = await Promise.all([
          captureLiveReport(target.query),
          captureCurrentReport(target.query),
        ])
        const hasError = !!(live.error || current.error || !live.snapshot || !current.snapshot)
        const id = await saveSearchReport(target.query, live, current, phase)
        for (const importId of target.importIds) await markImportedQueryRun(importId, id)

        console.log(`${prefix} Saved report #${id} for "${target.query}"`)
        console.log(
          `${prefix} live: ${live.error ?? `${live.snapshot?.results.length ?? 0} shown${live.snapshot?.total != null ? ` of ${live.snapshot.total}` : ''}`}`,
        )
        console.log(
          `${prefix} live tags: ${live.snapshot?.suggestionsError ?? (live.snapshot ? `${live.snapshot.suggestedTags?.length ?? 0} tags` : 'not captured')}`,
        )
        console.log(
          `${prefix} current: ${current.error ?? `${current.snapshot?.results.length ?? 0} shown${current.snapshot?.total != null ? ` of ${current.snapshot.total}` : ''}`}`,
        )
        console.log(
          `${prefix} current tags: ${current.snapshot ? `${current.snapshot.suggestedTags?.length ?? 0} tags` : 'not captured'}`,
        )
        if (hasError) failed++
      } catch (error) {
        failed++
        console.error(`${prefix} Failed "${target.query}": ${error instanceof Error ? error.message : error}`)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(3, targets.length) }, () => captureWorker()))

  const saved = targets.length - failed
  console.log(
    `Finished ${targets.length} ${targets.length === 1 ? 'query' : 'queries'}${phase !== undefined ? ` for Phase ${phase}` : ''}; ${saved} without errors${failed ? `, ${failed} failed or need retrying` : ''}.`,
  )
  console.log(`Open /search/report${phase !== undefined ? `?phase=${phase}` : ''} to review them.`)
  if (failed) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => flushTracesAndClose())
