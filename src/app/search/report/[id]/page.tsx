import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { BackLink } from '@/components/search/back-link'
import { ReportFeedbackDialog } from '@/components/search/report-feedback-dialog'
import { ReportFeedbackSummary } from '@/components/search/report-feedback-summary'
import { ReportGrid } from '@/components/search/report-grid'
import { ReportQueryTags } from '@/components/search/report-query-tags'
import { SearchNav } from '@/components/search/search-nav'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { queryTags } from '@/lib/search/query-tags'
import { formatReportDate, getSearchReport, REPORT_LIMIT } from '@/lib/search/report'
import type { ReportSnapshot } from '@/lib/search/report-types'

export const metadata: Metadata = {
  title: 'Search Report',
  description: 'Live and current search results side by side.',
}

export default function SearchReportDetailPage({ params }: PageProps<'/search/report/[id]'>) {
  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-5 px-4 py-6 sm:py-8">
      <Suspense fallback={<Skeleton className="h-[70vh] w-full" />}>
        <ReportDetail params={params} />
      </Suspense>
    </main>
  )
}

async function ReportDetail({ params }: { params: PageProps<'/search/report/[id]'>['params'] }) {
  const { id } = await params
  // Stored snapshots and feedback are read per request, never prerendered.
  await connection()
  const report = await getSearchReport(id)
  if (!report) notFound()
  const tags = await queryTags(report.query)

  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchNav active="report" />
          <BackLink href="/search/report">All queries</BackLink>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{report.query}</h1>
              <Badge variant="secondary">Phase {report.phase}</Badge>
            </div>
            <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span>First {REPORT_LIMIT} results</span>
              <span>·</span>
              <span>Saved {formatReportDate(report.updatedAt)}</span>
              {report.liveError && <Badge variant="destructive">Live error</Badge>}
              {report.currentError && <Badge variant="destructive">Current error</Badge>}
            </p>
            <ReportQueryTags query={report.query} tags={tags} />
          </div>
          <ReportFeedbackDialog reportId={report.id} query={report.query} feedback={report.feedback} />
        </div>
        <ReportFeedbackSummary feedback={report.feedback} />
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ReportSide title="Live" snapshot={report.liveSnapshot} total={report.liveTotal} error={report.liveError} />
        <ReportSide
          title="Current version"
          snapshot={report.currentSnapshot}
          total={report.currentTotal}
          error={report.currentError}
        />
      </div>
    </>
  )
}

function ReportSide({
  title,
  snapshot,
  total,
  error,
}: {
  title: string
  snapshot: ReportSnapshot | null
  total: number | null
  error: string | null
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border p-4" aria-label={title}>
      <div className="bg-background/95 sticky top-0 z-10 flex flex-wrap items-baseline justify-between gap-2 pb-2 backdrop-blur">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground text-xs tabular-nums">
          {snapshot ? `${snapshot.results.length} shown` : 'No snapshot'}
          {total !== null ? ` of ${total}` : ''}
          {snapshot?.capturedAt ? ` · ${formatReportDate(snapshot.capturedAt)}` : ''}
        </p>
      </div>

      {error && <p className="bg-destructive/10 text-destructive rounded-md border border-destructive/30 p-3 text-xs">{error}</p>}
      <ReportSuggestedTags snapshot={snapshot} />
      <ReportGrid snapshot={snapshot} />
    </section>
  )
}

function ReportSuggestedTags({ snapshot }: { snapshot: ReportSnapshot | null }) {
  if (!snapshot) return null

  const tags = snapshot.suggestedTags
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3" aria-label="Suggested tags">
      <h3 className="text-sm font-medium">Suggested tags</h3>
      {snapshot.suggestionsError ? (
        <p className="text-destructive text-xs">{snapshot.suggestionsError}</p>
      ) : tags === undefined ? (
        <p className="text-muted-foreground text-xs">Not captured in this snapshot. Re-run the snapshot command.</p>
      ) : tags.length === 0 ? (
        <p className="text-muted-foreground text-xs">No suggested tags.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag, index) => (
            <li key={`${tag.group ?? 'tag'}-${tag.value}-${index}`}>
              <Badge variant="outline" title={tag.group ? `${tag.group}: ${tag.value}` : tag.value}>
                {tag.label}
                {tag.count !== null && <span className="ml-1 tabular-nums">{tag.count.toLocaleString()}</span>}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
