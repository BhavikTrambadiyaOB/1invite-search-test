'use client'

import { ReportFeedbackSummary } from '@/components/search/report-feedback-summary'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { REPORT_RESULT_LABELS, type ReportFeedback } from '@/lib/search/report-types'

function resultLabel(result: ReportFeedback['liveResult']) {
  return result ? REPORT_RESULT_LABELS[result] : '—'
}

export function ReportFeedbackCell({ feedback, query }: { feedback: ReportFeedback | null; query: string }) {
  if (!feedback) {
    return <Badge variant="outline">Missing</Badge>
  }

  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">Live: {resultLabel(feedback.liveResult)}</Badge>
        <Badge variant="secondary">Current: {resultLabel(feedback.currentResult)}</Badge>
      </div>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="link" size="xs" className="h-auto px-0 py-0">
            View answers
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Feedback</DialogTitle>
            <DialogDescription className="break-words">{query}</DialogDescription>
          </DialogHeader>
          <ReportFeedbackSummary feedback={feedback} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
