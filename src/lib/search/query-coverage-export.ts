import { COVERAGE_STATUS_LABELS, tagText, type CoverageRow, type CoverageWord } from './query-coverage'
import { csvCell } from './report-export'

/** A CSV that opens directly in Excel: UTF-8 byte order mark, CRLF line ends, every cell quoted. */
function toCsv<T>(columns: [string, (row: T) => unknown][], rows: T[]): string {
  const lines = [columns.map(([name]) => csvCell(name)).join(',')]
  for (const row of rows) lines.push(columns.map(([, get]) => csvCell(get(row))).join(','))
  return `﻿${lines.join('\r\n')}\r\n`
}

const list = (values: string[]) => values.join(', ')

/** One row per query in the sheet. */
export function coverageQueriesCsv(rows: CoverageRow[]): string {
  return toCsv<CoverageRow>(
    [
      ['Row', (r) => r.rowNo],
      ['Search Query', (r) => r.query],
      ['Coverage', (r) => COVERAGE_STATUS_LABELS[r.status]],
      ['Tags', (r) => list(r.tags.map(tagText))],
      ['Tag count', (r) => r.tags.length],
      ['Not tags - found in template text', (r) => list(r.textWords)],
      ['Not tags - in no template', (r) => list(r.missingWords)],
      ['Templates with all tags', (r) => r.templatesAllTags ?? ''],
      ['Tags no template has', (r) => list(r.emptyTags)],
    ],
    rows,
  )
}

/** Every word that is not a tag, with how many queries use it. */
export function coverageWordsCsv(words: CoverageWord[]): string {
  return toCsv<CoverageWord>(
    [
      ['Word', (w) => w.word],
      ['Found in template text', (w) => (w.kind === 'text' ? 'Yes' : 'No')],
      ['Queries using it', (w) => w.queries],
    ],
    words,
  )
}
