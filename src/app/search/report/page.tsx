import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { BackLink } from '@/components/search/back-link'
import { ReportTable } from '@/components/search/report-table'
import { SearchNav } from '@/components/search/search-nav'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { queryTags } from '@/lib/search/query-tags'
import { listSearchReports, REPORT_PAGE_SIZE } from '@/lib/search/report'
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
          <Badge variant="secondary">Phase 2</Badge>
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
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ReportList searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

async function ReportList({ searchParams }: { searchParams: PageProps<'/search/report'>['searchParams'] }) {
  const sp = await searchParams
  const requested = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page)
  // The list changes whenever a snapshot or feedback is saved, so it is always rendered per request.
  await connection()
  const [result, pending] = await Promise.all([
    listSearchReports({ page: Number.isFinite(requested) ? requested : 1, pageSize: REPORT_PAGE_SIZE }),
    countPendingImportedQueries(),
  ])
  // Rules only: the list shows what each query is understood as, without AI calls.
  const reports = await Promise.all(
    result.reports.map(async (report) => ({ ...report, tags: await queryTags(report.query) })),
  )

  return (
    <div className="flex flex-col gap-4">
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
      />
    </div>
  )
}
