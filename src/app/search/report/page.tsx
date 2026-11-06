import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { BackLink } from '@/components/search/back-link'
import { ReportTable } from '@/components/search/report-table'
import { SearchNav } from '@/components/search/search-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { queryTags } from '@/lib/search/query-tags'
import { Download } from 'lucide-react'
import {
  getSearchReportFilterOptions,
  listSearchReports,
  REPORT_PAGE_SIZE,
  reportFilterParams,
  reportFiltersFromParams,
} from '@/lib/search/report'
import { countPendingImportedQueries } from '@/lib/search/report-import'

export const metadata: Metadata = {
  title: 'Search Report',
  description: 'Stored live and current search results with reviewer feedback.',
}

export default function SearchReportPage({ searchParams }: PageProps<'/search/report'>) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:py-8">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchNav active="report" />
          <BackLink href="/search">Back to search</BackLink>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Search report</h1>
        </div>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Each query stores the first 40 results, live suggested tags, and tags from the current search logic. Open a
          query to compare both versions side by side, then add six answers: result, freshness issue and reason for each
          side.
        </p>
        <p className="text-muted-foreground max-w-3xl text-xs">
          Each test-case sheet is a <b>version</b>. Import a new sheet as the next version with{' '}
          <code className="bg-muted rounded px-1.5 py-0.5">
            npm run search:report:snapshot -- --csv &quot;sheet.csv&quot; --version=3
          </code>
          , then capture it phase by phase with{' '}
          <code className="bg-muted rounded px-1.5 py-0.5">
            npm run search:report:snapshot -- --version=3 --phase=1
          </code>
          . Every capture needs a version and a phase and runs 19 searches at a time; run it again to continue. List
          versions with <code className="bg-muted rounded px-1.5 py-0.5">--versions</code>.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ReportList searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

async function ReportList({ searchParams }: { searchParams: PageProps<'/search/report'>['searchParams'] }) {
  const sp = await searchParams
  const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const rawPage = Number(param(sp.page))
  const filters = reportFiltersFromParams((key) => param(sp[key]))
  const hasFilters = Object.values(filters).some((value) => value !== undefined)
  // The list changes whenever a snapshot or feedback is saved, so it is always rendered per request.
  await connection()
  const [result, pending, filterOptions] = await Promise.all([
    listSearchReports({
      page: Number.isFinite(rawPage) ? rawPage : 1,
      pageSize: REPORT_PAGE_SIZE,
      filters,
    }),
    countPendingImportedQueries(filters.version),
    getSearchReportFilterOptions(filters.version),
  ])
  // Rules only: the list shows what each query is understood as, without AI calls.
  const reports = await Promise.all(
    result.reports.map(async (report) => ({ ...report, tags: await queryTags(report.query) })),
  )
  const queryForPage = (page: number) => {
    const params = reportFilterParams(filters)
    if (page > 1) params.set('page', String(page))
    const search = params.toString()
    return search ? `/search/report?${search}` : '/search/report'
  }
  const exportSearch = reportFilterParams(filters).toString()
  const exportHref = `/api/search/report/export${exportSearch ? `?${exportSearch}` : ''}`
  const gridColumns = filterOptions.occasions.length ? 'lg:grid-cols-7' : 'lg:grid-cols-6'

  return (
    <div className="flex flex-col gap-4">
      <form
        action="/search/report"
        method="get"
        className="flex flex-col gap-3 rounded-xl border p-4"
        aria-label="Filter search reports"
      >
        <div className={`grid gap-3 sm:grid-cols-2 ${gridColumns}`}>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Query
            <Input
              name="q"
              type="search"
              defaultValue={filters.query}
              placeholder="Search report queries"
              maxLength={200}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Version
            <select
              name="v"
              defaultValue={filters.version?.toString() ?? ''}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All versions</option>
              {filterOptions.versions.map(({ version, sourceFile, testCases }) => (
                <option key={version} value={version} title={sourceFile}>
                  v{version} ({testCases.toLocaleString()} test cases)
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Phase
            <select
              name="phase"
              defaultValue={filters.phase?.toString() ?? ''}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All phases</option>
              {filterOptions.phases.map(({ phase, count }) => (
                <option key={phase} value={phase}>
                  Phase {phase} ({count.toLocaleString()})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Case type
            <select
              name="case"
              defaultValue={filters.caseType ?? ''}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All case types</option>
              {filterOptions.caseTypes.map(({ caseType, count }) => (
                <option key={caseType} value={caseType}>
                  {caseType} ({count.toLocaleString()})
                </option>
              ))}
            </select>
          </label>
          {filterOptions.occasions.length > 0 && (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Occasion
              <select
                name="occasion"
                defaultValue={filters.occasion ?? ''}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All occasions</option>
                {filterOptions.occasions.map((occasion) => (
                  <option key={occasion} value={occasion}>
                    {occasion}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Feedback
            <select
              name="feedback"
              defaultValue={filters.feedback ?? ''}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All feedback</option>
              <option value="unreviewed">Not reviewed</option>
              <option value="incomplete">Incomplete</option>
              <option value="complete">Complete</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Capture errors
            <select
              name="error"
              defaultValue={filters.error ?? ''}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All reports</option>
              <option value="any">Any capture error</option>
              <option value="live">Live error</option>
              <option value="current">Current error</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit">Apply filters</Button>
          {hasFilters && (
            <Button asChild variant="outline">
              <Link href="/search/report">Clear filters</Link>
            </Button>
          )}
          <span className="text-muted-foreground text-xs">
            {result.total.toLocaleString()} matching {result.total === 1 ? 'report' : 'reports'}
          </span>
          {result.total > 0 && (
            <Button asChild variant="outline" className="ml-auto">
              <a href={exportHref} download>
                <Download aria-hidden />
                Export to Excel (CSV)
              </a>
            </Button>
          )}
        </div>
      </form>

      {pending > 0 && (
        <div className="rounded-lg border border-dashed p-4 text-sm">
          <p className="font-medium">
            {pending.toLocaleString()} {pending === 1 ? 'search' : 'searches'}
            {filters.version !== undefined ? ` in v${filters.version}` : ''} not captured in any phase yet.
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Capture the next 19 with{' '}
            <code className="bg-muted rounded px-1.5 py-0.5">
              npm run search:report:snapshot -- --version={filters.version ?? filterOptions.versions[0]?.version ?? 1}{' '}
              --phase=1
            </code>
            .
          </p>
        </div>
      )}

      <ReportTable
        reports={reports}
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
        hrefForPage={queryForPage}
        hasActiveFilters={hasFilters}
      />
    </div>
  )
}
