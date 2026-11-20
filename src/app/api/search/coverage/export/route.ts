import { NextResponse, type NextRequest } from 'next/server'
import {
  coverageFiltersFromParams,
  listCoverageLists,
  listCoverageWords,
  listQueryCoverageForExport,
} from '@/lib/search/query-coverage'
import { coverageQueriesCsv, coverageWordsCsv } from '@/lib/search/query-coverage-export'

/**
 * Downloads tag coverage as a CSV for Excel. `view=words` gives every non-tag word with its query count;
 * otherwise one row per query, with the same filters as /search/coverage.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = coverageFiltersFromParams((key) => params.get(key))
  const lists = await listCoverageLists()
  const list = lists.find((l) => l.id === filters.list) ?? lists[0]
  if (!list) return NextResponse.json({ error: 'No query list imported yet' }, { status: 404 })

  const words = params.get('view') === 'words'
  const csv = words
    ? coverageWordsCsv(await listCoverageWords(list.id))
    : coverageQueriesCsv(await listQueryCoverageForExport(list.id, filters))
  const slug = list.sourceFile
    .replace(/\.csv$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const name = `tag-coverage_${slug}_${words ? 'words' : (filters.status ?? 'all')}_${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  })
}
