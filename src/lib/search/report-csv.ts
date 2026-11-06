/** One query to import into the search report, with the group it came from. */
export type ReportImportRow = {
  query: string
  /** Column name in the occasion-wise CSV. */
  occasion?: string
  /** "Case Type" in the test-case CSV ("Age-Based Search"…). */
  caseType?: string
  whatItTests?: string
  expectedResult?: string
  /** Other sheet columns, by header name. */
  extra?: Record<string, string>
}

/** One non-empty cell in the occasion-wise CSV: a user query and the column it came from. */
export type OccasionQuery = ReportImportRow & { occasion: string }

function parseRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"'
        i++
      } else {
        quoted = !quoted
      }
      continue
    }

    if (!quoted && char === ',') {
      row.push(field)
      field = ''
      continue
    }

    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }

    field += char
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

const clean = (value: string) => value.replace(/\s+/g, ' ').trim()

/**
 * Reads `1invites_user_search - Occasion_Wise.csv`: the first row is occasion names,
 * every later row holds one search query per occasion column. Blank cells are skipped.
 */
export function parseOccasionCsv(text: string): OccasionQuery[] {
  const rows = parseRows(text.replace(/^\uFEFF/, ''))
  if (rows.length < 2) return []

  const occasions = rows[0].map(clean)
  const queries: OccasionQuery[] = []
  for (const row of rows.slice(1)) {
    for (let column = 0; column < occasions.length; column++) {
      const query = clean(row[column] ?? '')
      if (query) queries.push({ occasion: occasions[column], query })
    }
  }
  return queries
}

/** Header names read as the query and as the case type. Any other column is kept as an extra. */
const QUERY_COLUMNS = ['search query', 'query', 'search term']
const CASE_TYPE_COLUMNS = ['case type', 'search category', 'category', 'case']
const NOTE_COLUMNS: Record<string, 'whatItTests' | 'expectedResult'> = {
  'what it tests': 'whatItTests',
  'expected result': 'expectedResult',
}

/** The header row of a CSV, trimmed. */
export function csvHeader(text: string): string[] {
  return (parseRows(text.replace(/^\uFEFF/, ''))[0] ?? []).map(clean)
}

/** True when the CSV is a test-case sheet: a query column and a case type (or category) column. */
export function isTestCaseCsv(text: string): boolean {
  const header = csvHeader(text).map((name) => name.toLowerCase())
  return header.some((name) => QUERY_COLUMNS.includes(name)) && header.some((name) => CASE_TYPE_COLUMNS.includes(name))
}

/**
 * A test-case query as the tester wrote it: line breaks around it are removed (spreadsheet cells often end
 * with one), but spaces and letter case stay, so "BIRTHDAY" and "ceramic  birthday" are tested as typed.
 */
export function testCaseQuery(value: string): string {
  return value.replace(/^[\r\n]+|[\r\n]+$/g, '')
}

/**
 * Reads a test-case sheet in any of its formats: "Case Type" or "Search Category" for the case type,
 * "Search Query" for the query, optional "What It Tests" and "Expected Result", and every other named
 * column as an extra. Rows without a query are placeholders and are skipped.
 */
export function parseTestCaseCsv(text: string): ReportImportRow[] {
  const rows = parseRows(text.replace(/^\uFEFF/, ''))
  if (rows.length < 2) return []
  const names = rows[0].map(clean)
  const lower = names.map((name) => name.toLowerCase())
  const queryColumn = lower.findIndex((name) => QUERY_COLUMNS.includes(name))
  const caseColumn = lower.findIndex((name) => CASE_TYPE_COLUMNS.includes(name))
  return rows
    .slice(1)
    .map((row) => {
      const result: ReportImportRow = {
        query: testCaseQuery(row[queryColumn] ?? ''),
        caseType: clean(row[caseColumn] ?? ''),
        extra: {},
      }
      names.forEach((name, i) => {
        if (i === queryColumn || i === caseColumn || !name) return
        const value = clean(row[i] ?? '')
        if (!value) return
        const note = NOTE_COLUMNS[lower[i]]
        if (note) result[note] = value
        else result.extra![name] = value
      })
      return result
    })
    .filter((row) => row.query.trim())
}
