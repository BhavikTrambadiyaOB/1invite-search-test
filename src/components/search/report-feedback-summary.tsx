import { Badge } from '@/components/ui/badge'
import { REPORT_RESULT_LABELS, type ReportFeedback } from '@/lib/search/report-types'

function resultVariant(result: ReportFeedback['liveResult']) {
  if (result === 'success') return 'default' as const
  if (result === 'partial') return 'outline' as const
  if (result === 'failed') return 'destructive' as const
  return 'secondary' as const
}

function Side({
  label,
  result,
  freshnessIssue,
  reason,
}: {
  label: string
  result: ReportFeedback['liveResult']
  freshnessIssue: boolean | null
  reason: string
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold">{label}</span>
        <Badge variant={resultVariant(result)}>{result ? REPORT_RESULT_LABELS[result] : 'No result answer'}</Badge>
        <Badge variant={freshnessIssue ? 'destructive' : 'outline'}>
          Freshness issue: {freshnessIssue === null ? '—' : freshnessIssue ? 'Yes' : 'No'}
        </Badge>
      </div>
      <p className="text-muted-foreground mt-2 text-xs whitespace-pre-wrap">
        {reason.trim() || 'No reason added.'}
      </p>
    </div>
  )
}

/** All six feedback answers, side by side. Used on the report list and detail pages. */
export function ReportFeedbackSummary({ feedback }: { feedback: ReportFeedback | null }) {
  if (!feedback) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-xs">
        No feedback yet. Open the report and use the Feedback button.
      </p>
    )
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Side
        label="Live"
        result={feedback.liveResult}
        freshnessIssue={feedback.liveFreshnessIssue}
        reason={feedback.liveReason}
      />
      <Side
        label="Current version"
        result={feedback.currentResult}
        freshnessIssue={feedback.currentFreshnessIssue}
        reason={feedback.currentReason}
      />
    </div>
  )
}
