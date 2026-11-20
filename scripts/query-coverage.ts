/**
 * Tag coverage of a list of user search queries, for /search/coverage. Rules only: no AI and no
 * embeddings are used, so it costs nothing and never calls the live server.
 *
 * Usage:
 *   npm run search:coverage -- "birthday_search_test_cases_NP - User_Birthday_Query.csv"
 *
 * The sheet needs one column of queries (a header with "query" in it, or the first column). Running the
 * same file again replaces its earlier results, so re-run it after tags or rules change.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { db } from '@/lib/db'
import { parseQueryListCsv } from '@/lib/search/report-csv'
import { analyzeQueryCoverage, COVERAGE_STATUS_LABELS, COVERAGE_STATUSES, saveQueryCoverage } from '@/lib/search/query-coverage'

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: npm run search:coverage -- "queries.csv"')
    process.exitCode = 1
    return
  }
  const queries = parseQueryListCsv(await readFile(file, 'utf8'))
  if (!queries.length) {
    console.error(`No queries found in ${path.basename(file)}.`)
    process.exitCode = 1
    return
  }

  const started = Date.now()
  const rows = await analyzeQueryCoverage(queries, (message) => console.log(message))
  const listId = await saveQueryCoverage(path.basename(file), rows)

  console.log(`\nSaved ${rows.length.toLocaleString()} queries from ${path.basename(file)} in ${((Date.now() - started) / 1000).toFixed(1)}s.`)
  for (const status of COVERAGE_STATUSES) {
    const n = rows.filter((r) => r.status === status).length
    console.log(`  ${COVERAGE_STATUS_LABELS[status].padEnd(16)} ${String(n).padStart(6)}  (${((n / rows.length) * 100).toFixed(1)}%)`)
  }
  const zero = rows.filter((r) => r.templatesAllTags === 0).length
  console.log(`  Tags but no template has all of them: ${zero}`)
  console.log(`\nReview at /search/coverage?list=${listId}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.end())
