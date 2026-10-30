import Link from 'next/link'
import { ReportFeedbackSummary } from '@/components/search/report-feedback-summary'
import { Pagination } from '@/components/search/pagination'
import { ReportQueryTags } from '@/components/search/report-query-tags'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { QueryTag } from '@/lib/search/query-tags'
import { formatReportDate } from '@/lib/search/report'
import {
  REPORT_RESULT_LABELS,
  type ReportFeedback,
  type ReportRow,
} from '@/lib/search/report-types'

function countLabel(count: number, total: number | null) {
  return total === null ? `${count} shown` : `${count} of ${total}`
}

function resultVariant(result: ReportFeedback['liveResult']) {
  if (result === 'success') return 'default' as const
  if (result === 'partial') return 'outline' as const
  if (result === 'failed') return 'destructive' as const
  return 'secondary' as const
}

function FeedbackBadges({ feedback }: { feedback: ReportFeedback | null }) {
  if (!feedback) {
    return <Badge variant="outline">Missing</Badge>
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={resultVariant(feedback.liveResult)}>
        Live: {feedback.liveResult ? REPORT_RESULT_LABELS[feedback.liveResult] : '—'}
      </Badge>
      <Badge variant={resultVariant(feedback.currentResult)}>
        Current: {feedback.currentResult ? REPORT_RESULT_LABELS[feedback.currentResult] : '—'}
      </Badge>
    </div>
  )
}

function FeedbackCell({ feedback }: { feedback: ReportFeedback | null }) {
  if (!feedback) {
    return <Badge variant="outline">Missing</Badge>
  }

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-1.5">
        <FeedbackBadges feedback={feedback} />
        <span className="text-muted-foreground text-xs underline-offset-4 group-open:hidden">
          Show answers
        </span>
        <span className="text-muted-foreground hidden text-xs underline-offset-4 group-open:inline">
          Hide answers
        </span>
      </summary>
      <div className="mt-2 w-[min(42rem,70vw)] min-w-72">
        <ReportFeedbackSummary feedback={feedback} />
      </div>
    </details>
  )
}

/** Paginated table of stored reports. Feedback expands in place so all six answers stay on this page. */
export function ReportTable({
  reports,
  page,
  totalPages,
  total,
  pageSize,
}: {
  reports: Array<ReportRow & { tags: QueryTag[] }>
  page: number
  totalPages: number
  total: number
  pageSize: number
}) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-3">
      {reports.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm md:hidden">
          No saved queries yet. Run the snapshot command above, then reload this page.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 md:hidden">
          {reports.map((report) => (
            <li key={report.id}>
              <article className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/search/report/${report.id}`}
                    className="min-w-0 font-medium underline-offset-4 hover:underline"
                  >
                    {report.query}
                  </Link>
                  <Link
                    href={`/search/report/${report.id}`}
                    className="text-primary shrink-0 text-sm underline-offset-4 hover:underline"
                  >
                    View
                  </Link>
                </div>

                <ReportQueryTags query={report.query} tags={report.tags} />

                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Live</span>{' '}
                    <span className="tabular-nums">{countLabel(report.liveCount, report.liveTotal)}</span>
                    {report.liveError && (
                      <Badge variant="destructive" className="ml-1">
                        Error
                      </Badge>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Current</span>{' '}
                    <span className="tabular-nums">{countLabel(report.currentCount, report.currentTotal)}</span>
                    {report.currentError && (
                      <Badge variant="destructive" className="ml-1">
                        Error
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <FeedbackBadges feedback={report.feedback} />
                  <span className="text-muted-foreground text-xs">
                    {formatReportDate(report.feedback?.updatedAt ?? report.updatedAt)}
                  </span>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Query</TableHead>
              <TableHead>Live results</TableHead>
              <TableHead>Current results</TableHead>
              <TableHead>Feedback</TableHead>
              <TableHead>Saved</TableHead>
              <TableHead className="pr-4 text-right">Report</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  No saved queries yet. Run the snapshot command above, then reload this page.
                </TableCell>
              </TableRow>
            ) : (
              reports.map((report) => (
                <TableRow key={report.id} className="align-top">
                  <TableCell className="max-w-96 py-3 pl-4 font-medium whitespace-normal">
                    <Link
                      href={`/search/report/${report.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {report.query}
                    </Link>
                    <ReportQueryTags query={report.query} tags={report.tags} />
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="tabular-nums">{countLabel(report.liveCount, report.liveTotal)}</span>
                      {report.liveError && <Badge variant="destructive">Error</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="tabular-nums">{countLabel(report.currentCount, report.currentTotal)}</span>
                      {report.currentError && <Badge variant="destructive">Error</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-96 py-3 whitespace-normal">
                    <FeedbackCell feedback={report.feedback} />
                  </TableCell>
                  <TableCell className="text-muted-foreground py-3 text-xs">
                    {formatReportDate(report.feedback?.updatedAt ?? report.updatedAt)}
                  </TableCell>
                  <TableCell className="py-3 pr-4 text-right">
                    <Link
                      href={`/search/report/${report.id}`}
                      className="text-primary text-sm underline-offset-4 hover:underline"
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs tabular-nums">
          {total === 0 ? 'No reports' : `Showing ${first}–${last} of ${total.toLocaleString()}`}
        </p>
        <Pagination
          page={page}
          totalPages={totalPages}
          label="Report pages"
          hrefForPage={(nextPage) => (nextPage <= 1 ? '/search/report' : `/search/report?page=${nextPage}`)}
        />
      </div>
    </div>
  )
}
