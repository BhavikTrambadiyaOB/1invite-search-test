import type { ReportExportRow } from './report'
import { REPORT_RESULT_LABELS } from './report-types'

const REASON = 'Reason (Why fail, why partially, note for success is any)'

function cell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  // Quote every cell; a leading = + - @ is prefixed so Excel never runs it as a formula.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

const yesNo = (value: boolean | null | undefined) => (value === null || value === undefined ? '' : value ? 'Yes' : 'No')

/** The reviewer sheet: one row per test case with the six feedback answers. "V2" is the current search. */
const COLUMNS: [string, (row: ReportExportRow) => unknown][] = [
  ['Case Type', (r) => r.caseType],
  ['Search Query', (r) => r.testQuery],
  ['Live Result', (r) => (r.feedback?.liveResult ? REPORT_RESULT_LABELS[r.feedback.liveResult] : '')],
  ['Freshness issue', (r) => yesNo(r.feedback?.liveFreshnessIssue)],
  [REASON, (r) => r.feedback?.liveReason],
  ['V2 Result', (r) => (r.feedback?.currentResult ? REPORT_RESULT_LABELS[r.feedback.currentResult] : '')],
  ['Freshness issue', (r) => yesNo(r.feedback?.currentFreshnessIssue)],
  [REASON, (r) => r.feedback?.currentReason],
]

/**
 * The report as a CSV that opens directly in Excel: a UTF-8 byte order mark (so emoji and Hindi show
 * correctly), CRLF line ends and every cell quoted.
 */
export function reportExportCsv(rows: ReportExportRow[]): string {
  const lines = [COLUMNS.map(([name]) => cell(name)).join(',')]
  for (const row of rows) lines.push(COLUMNS.map(([, get]) => cell(get(row))).join(','))
  return `﻿${lines.join('\r\n')}\r\n`
}
