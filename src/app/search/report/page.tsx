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
import {
  getSearchReportFilterOptions,
  listSearchReports,
  REPORT_PAGE_SIZE,
  type SearchReportFilters,
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
          query to compare both versions side by side, then add six answers: result, freshness issue and reason for each side.
        </p>
        <p className="text-muted-foreground max-w-3xl text-xs">
          Add queries with{' '}
          <code className="bg-muted rounded px-1.5 py-0.5">
            npm run search:report:snapshot -- &quot;query one&quot; &quot;query two&quot;
          </code>{' '}
          or{' '}
          <code className="bg-muted rounded px-1.5 py-0.5">
            npm run search:report:snapshot -- --file queries.txt
          </code>
          . Import the occasion CSV with{' '}
          <code className="bg-muted rounded px-1.5 py-0.5">
            npm run search:report:snapshot -- --csv &quot;1invites_user_search - Occasion_Wise.csv&quot;
          </code>
          .
        </p>
        <p className="text-muted-foreground max-w-3xl text-xs">
          Run or resume a phase in batches of up to three queries at a time with{' '}
          <code className="bg-muted rounded px-1.5 py-0.5">
            npm run search:report:snapshot -- --phase=2 --limit=10
          </code>
          . Repeat with a larger limit or omit <code>--limit</code> to capture all remaining queries in that phase.
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
  const rawPhase = param(sp.phase)
  const rawFeedback = param(sp.feedback)
  const rawError = param(sp.error)
  const parsedPhase = rawPhase && /^\d+$/.test(rawPhase) ? Number(rawPhase) : Number.NaN
  const filters: SearchReportFilters = {
    query: param(sp.q)?.trim().slice(0, 200) || undefined,
    phase: Number.isSafeInteger(parsedPhase) && parsedPhase > 0 ? parsedPhase : undefined,
    occasion: param(sp.occasion) || undefined,
    feedback:
      rawFeedback === 'unreviewed' || rawFeedback === 'incomplete' || rawFeedback === 'complete'
        ? rawFeedback
        : undefined,
    error:
      rawError === 'any' || rawError === 'live' || rawError === 'current'
        ? rawError
        : undefined,
  }
  const hasFilters = Object.values(filters).some((value) => value !== undefined)
  // The list changes whenever a snapshot or feedback is saved, so it is always rendered per request.
  await connection()
  const [result, pending, filterOptions] = await Promise.all([
    listSearchReports({
      page: Number.isFinite(rawPage) ? rawPage : 1,
      pageSize: REPORT_PAGE_SIZE,
      filters,
    }),
    countPendingImportedQueries(),
    getSearchReportFilterOptions(),
  ])
  // Rules only: the list shows what each query is understood as, without AI calls.
  const reports = await Promise.all(
    result.reports.map(async (report) => ({ ...report, tags: await queryTags(report.query) })),
  )
  const queryForPage = (page: number) => {
    const params = new URLSearchParams()
    if (filters.query) params.set('q', filters.query)
    if (filters.phase !== undefined) params.set('phase', String(filters.phase))
    if (filters.occasion) params.set('occasion', filters.occasion)
    if (filters.feedback) params.set('feedback', filters.feedback)
    if (filters.error) params.set('error', filters.error)
    if (page > 1) params.set('page', String(page))
    const search = params.toString()
    return search ? `/search/report?${search}` : '/search/report'
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        action="/search/report"
        method="get"
        className="flex flex-col gap-3 rounded-xl border p-4"
        aria-label="Filter search reports"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
        </div>
      </form>

      {pending > 0 && (
        <div className="rounded-lg border border-dashed p-4 text-sm">
          <p className="font-medium">
            {pending.toLocaleString()} imported {pending === 1 ? 'query is' : 'queries are'} waiting for a snapshot.
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Import the CSV once, then capture all of them or a batch with{' '}
            <code className="bg-muted rounded px-1.5 py-0.5">
              npm run search:report:snapshot -- --from-import --limit 10
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
