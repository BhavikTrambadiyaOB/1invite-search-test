import { NextResponse, type NextRequest } from 'next/server'
import { listSearchReportsForExport, reportFiltersFromParams } from '@/lib/search/report'
import { reportExportCsv } from '@/lib/search/report-export'

/** Downloads the search report as a CSV for Excel, using the same filters as /search/report. */
export async function GET(request: NextRequest) {
  const filters = reportFiltersFromParams((key) => request.nextUrl.searchParams.get(key))
  const rows = await listSearchReportsForExport(filters)

  const date = new Date().toISOString().slice(0, 10)
  const parts = [
    'search-report',
    filters.version !== undefined ? `v${filters.version}` : 'all-versions',
    filters.phase !== undefined ? `phase-${filters.phase}` : 'all-phases',
    filters.caseType
      ? filters.caseType
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      : null,
    date,
  ].filter(Boolean)

  return new NextResponse(reportExportCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${parts.join('_')}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
