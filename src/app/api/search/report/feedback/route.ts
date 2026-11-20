import { NextResponse } from 'next/server'
import { z } from 'zod'
import { saveReportFeedback } from '@/lib/search/report'

const resultSchema = z.enum(['success', 'partial', 'failed'])

const bodySchema = z.object({
  reportId: z.string().regex(/^\d+$/),
  liveResult: resultSchema,
  liveFreshnessIssue: z.boolean(),
  liveReason: z.string().max(2000).default(''),
  currentResult: resultSchema,
  currentFreshnessIssue: z.boolean(),
  currentReason: z.string().max(2000).default(''),
  // Optional: left empty when the suggested tags are fine.
  currentTagsReason: z.string().max(2000).nullish(),
})

/** Saves the search-report answers: result, freshness issue and reason for each side, plus an optional tags note for the current version. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid report feedback' }, { status: 400 })

  const saved = await saveReportFeedback(parsed.data)
  if (!saved) return NextResponse.json({ error: 'Unknown search report' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
