/**
 * One template in a stored report snapshot. Category, age and colors stay out of the card copy so the
 * two sides are compared on the design itself; the optional fields only power the report filters.
 */
export type ReportItem = {
  id: string
  name: string
  previewUrl: string
  width: number | null
  height: number | null
  isFree?: boolean | null
  isPortrait?: boolean | null
  hasPhoto?: boolean | null
  occasionLabel?: string | null
  themes?: string[]
  milestone?: number | null
}

export type ReportSuggestedTag = {
  group: string | null
  value: string
  label: string
  count: number | null
}

/** The first results captured for one side of the report, stored as JSON. */
export type ReportSnapshot = {
  source: 'live' | 'current'
  capturedAt: string
  /** Total matching templates, when the source reports it. */
  total: number | null
  results: ReportItem[]
  /** Tags suggested by the live API or the current search implementation. */
  suggestedTags?: ReportSuggestedTag[]
  /** A tag API failure does not invalidate the captured search results. */
  suggestionsError?: string | null
}

export const REPORT_RESULTS = ['success', 'partial', 'failed'] as const
export type ReportResult = (typeof REPORT_RESULTS)[number]

export const REPORT_RESULT_LABELS: Record<ReportResult, string> = {
  success: 'Success',
  partial: 'Partially successful',
  failed: 'Failed',
}

export type ReportFeedback = {
  liveResult: ReportResult | null
  liveFreshnessIssue: boolean | null
  liveReason: string
  currentResult: ReportResult | null
  currentFreshnessIssue: boolean | null
  currentReason: string
  updatedAt: string | null
}

export type ReportRow = {
  id: string
  query: string
  liveTotal: number | null
  currentTotal: number | null
  liveCount: number
  currentCount: number
  liveError: string | null
  currentError: string | null
  createdAt: string
  updatedAt: string
  feedback: ReportFeedback | null
}

export type ReportDetail = ReportRow & {
  liveSnapshot: ReportSnapshot | null
  currentSnapshot: ReportSnapshot | null
}

export function isReportResult(value: unknown): value is ReportResult {
  return typeof value === 'string' && (REPORT_RESULTS as readonly string[]).includes(value)
}
