'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import {
  REPORT_RESULTS,
  REPORT_RESULT_LABELS,
  type ReportFeedback,
  type ReportResult,
} from '@/lib/search/report-types'

type SideState = {
  result: ReportResult | ''
  freshnessIssue: 'yes' | 'no'
  reason: string
}

function sideState(
  result: ReportResult | null,
  freshnessIssue: boolean | null,
  reason: string,
): SideState {
  return {
    result: result ?? '',
    freshnessIssue: freshnessIssue === true ? 'yes' : 'no',
    reason,
  }
}

function SideFields({
  label,
  value,
  onChange,
}: {
  label: string
  value: SideState
  onChange: (next: SideState) => void
}) {
  const idPrefix = label === 'Live' ? 'live' : 'current'
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold">{label}</legend>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor={`${idPrefix}-result`}>
          Result
        </label>
        <Select
          value={value.result}
          onValueChange={(result) => onChange({ ...value, result: result as ReportResult })}
        >
          <SelectTrigger id={`${idPrefix}-result`} className="w-full">
            <SelectValue placeholder="Choose a result" />
          </SelectTrigger>
          <SelectContent>
            {REPORT_RESULTS.map((result) => (
              <SelectItem key={result} value={result}>
                {REPORT_RESULT_LABELS[result]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor={`${idPrefix}-freshness`}>
          Freshness issue
        </label>
        <Select
          value={value.freshnessIssue}
          onValueChange={(freshnessIssue) =>
            onChange({ ...value, freshnessIssue: freshnessIssue as 'yes' | 'no' })
          }
        >
          <SelectTrigger id={`${idPrefix}-freshness`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="no">No</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor={`${idPrefix}-reason`}>
          Reason
        </label>
        <Textarea
          id={`${idPrefix}-reason`}
          value={value.reason}
          onChange={(event) => onChange({ ...value, reason: event.target.value })}
          placeholder="Why did you choose this answer?"
          maxLength={2000}
          className="min-h-20"
        />
      </div>
    </fieldset>
  )
}

export function ReportFeedbackDialog({
  reportId,
  query,
  feedback,
}: {
  reportId: string
  query: string
  feedback: ReportFeedback | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState<SideState>(sideState(null, null, ''))
  const [current, setCurrent] = useState<SideState>(sideState(null, null, ''))

  function reset() {
    setError(null)
    setLive(sideState(feedback?.liveResult ?? null, feedback?.liveFreshnessIssue ?? null, feedback?.liveReason ?? ''))
    setCurrent(
      sideState(
        feedback?.currentResult ?? null,
        feedback?.currentFreshnessIssue ?? null,
        feedback?.currentReason ?? '',
      ),
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!live.result || !current.result) {
      setError('Choose a result for both live and current version.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/search/report/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reportId,
          liveResult: live.result,
          liveFreshnessIssue: live.freshnessIssue === 'yes',
          liveReason: live.reason,
          currentResult: current.result,
          currentFreshnessIssue: current.freshnessIssue === 'yes',
          currentReason: current.reason,
        }),
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(data?.error ?? 'Could not save feedback')
      setOpen(false)
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save feedback')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset()
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <Button>{feedback ? 'Edit feedback' : 'Add feedback'}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Search report feedback</DialogTitle>
          <DialogDescription>
            “{query}” · answer for both sides, six fields in total.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <SideFields label="Live" value={live} onChange={setLive} />
            <SideFields label="Current version" value={current} onChange={setCurrent} />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner /> : 'Save feedback'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
