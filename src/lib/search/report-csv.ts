/** One non-empty cell in the occasion-wise CSV: a user query and the column it came from. */
export type OccasionQuery = {
  occasion: string
  query: string
}

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
