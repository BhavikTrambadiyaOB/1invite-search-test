/**
 * Logs the current search of reports captured before report searches were logged, so the failed-queries page can
 * list their failed searches by version and phase. New captures log themselves (saveSearchReport).
 *
 *   npm run search:report:log -- --version=3 --phase=2     reports of v3 Phase 2 not logged yet
 *   npm run search:report:log -- --version=3               every phase of v3
 *   npm run search:report:log -- --version=3 --phase=2 --again   log them again (after search or data changes)
 *
 * Each search reuses the cached query reading and embedding, so it normally makes no AI calls.
 */
import { db } from '@/lib/db'
import { logReportSearch, searchLogValues } from '@/lib/search/report-search-log'
import { searchTemplates } from '@/lib/search/search-templates'
import { flushTracesAndClose } from './lib/close'

const PARALLEL = 4

function arg(name: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=')[1] : undefined
}

async function main() {
  const version = Number(arg('version'))
  const phase = arg('phase') ? Number(arg('phase')) : null
  if (!Number.isInteger(version) || version < 1) {
    console.log('Pass --version=N (and optionally --phase=N).')
    return
  }
  const again = process.argv.includes('--again')
  const { rows } = await db.query<{ id: string; query: string; at: Date }>(
    `select r.id::text, r.query,
            coalesce((r.current_snapshot ->> 'capturedAt')::timestamptz, r.updated_at) as at
       from search_report r
      where r.version = $1 and ($2::int is null or r.phase = $2) and r.current_snapshot is not null
        and ($3 or not exists (select 1 from search_log l where l.report_id = r.id))
      order by r.id`,
    [version, phase, again],
  )
  console.log(`Logging ${rows.length} report searches for v${version}${phase ? ` Phase ${phase}` : ''}`)
  // Search logs its own errors (for example an empty embedding text); keep the output readable.
  const quiet = console.error
  console.error = () => {}
  let next = 0
  let done = 0
  let failed = 0
  const worker = async () => {
    while (next < rows.length) {
      const row = rows[next++]
      try {
        const response = await searchTemplates({ query: row.query })
        await logReportSearch(row.id, row.query, searchLogValues(response), row.at)
      } catch {
        failed++
      }
      if (++done % 50 === 0) console.log(`  ${done}/${rows.length}`)
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker))
  console.error = quiet
  console.log(`Done: ${done - failed} logged${failed ? `, ${failed} failed` : ''}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(flushTracesAndClose)
