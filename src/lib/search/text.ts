/** Text helpers shared by template enrichment and query parsing. */

/** Lowercase, remove accents and apostrophes, turn punctuation into spaces. */
export function normalizeText(input: string | null | undefined): string {
  return (input ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`´]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    // Join letter-spaced words: "a n n i v e r s a r y" → "anniversary".
    .replace(/\b(?:[a-z] ){3,}[a-z]\b/g, (run) => run.replace(/ /g, ''))
    .trim()
}

/** A letter outside the Latin script (Arabic, Bengali, Devanagari, Tamil…). */
const NON_LATIN_LETTER = /(?!\p{Script=Latin})\p{L}/u

/** True when the text has letters of a non-Latin script ("عيد", "ঈদ"). */
export function hasNonLatinLetters(text: string): boolean {
  return NON_LATIN_LETTER.test(text)
}

/**
 * Query text for search: like normalizeText, but words in other scripts are kept ("عيد مبارك"),
 * so they can be read by AI and matched by meaning instead of being erased.
 * For Latin-only text it returns exactly normalizeText.
 */
export function queryText(input: string | null | undefined): string {
  const text = input ?? ''
  if (!NON_LATIN_LETTER.test(text)) return normalizeText(text)
  return text
    .normalize('NFC')
    .split(/[^\p{L}\p{M}\p{N}'’]+/u)
    .map((word) => (NON_LATIN_LETTER.test(word) ? word.toLowerCase().replace(/['’]/g, '') : normalizeText(word)))
    .filter(Boolean)
    .join(' ')
}

const ORDINAL_WORDS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9,
  tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16,
  seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, twentyfifth: 25, thirtieth: 30,
  fortieth: 40, fiftieth: 50, sixtieth: 60, seventieth: 70, eightieth: 80, ninetieth: 90, hundredth: 100,
}

const CARDINAL_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, sixteen: 16, eighteen: 18, twenty: 20, twentyfive: 25,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
}

const NAMED_MILESTONES: [RegExp, number][] = [
  [/\bsweet (16|sixteen)\b/, 16],
  [/\bquinceanera\b|\bxv anos\b|\bquince anos\b/, 15],
  [/\bsilver (wedding )?anniversary\b/, 25],
  [/\bpearl (wedding )?anniversary\b/, 30],
  [/\bruby (wedding )?anniversary\b/, 40],
  [/\bgolden (wedding )?anniversary\b|\bbodas de oro\b/, 50],
  [/\bdiamond (wedding )?anniversary\b/, 60],
]

const ORDINAL_RE = new RegExp(`\\b(?:(\\d{1,3})(?:st|nd|rd|th)|(${Object.keys(ORDINAL_WORDS).join('|')}))\\b`)
const YEARS_RE = new RegExp(`\\b(\\d{1,3}|${Object.keys(CARDINAL_WORDS).join('|')})\\s*(?:year|yr)s?\\b`)
const MILESTONE_CONTEXT = '(?:anniversary|anniversaries|birthday|bday|years?|aniversario|cumpleanos)'
// "birthday 40", "anniversary 25": a number right after the event word, but not a date ("birthday 6 june").
const MONTHS = 'jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre'
const AFTER_EVENT_RE = new RegExp(`\\b(?:birthday|bday|anniversary|aniversario|cumpleanos)\\s+(\\d{1,3})\\b(?!\\s+(?:${MONTHS})\\b)(?!\\s*(?:am|pm|st|nd|rd|th)\\b)`)

function toNumber(digits?: string, word?: string): number | null {
  if (digits) return Number(digits)
  if (word) return ORDINAL_WORDS[word] ?? CARDINAL_WORDS[word] ?? null
  return null
}

function valid(n: number | null) {
  return n !== null && n > 0 && n <= 120 ? n : null
}

/**
 * Finds a milestone number such as "5th", "fifth", "5 year" or "golden anniversary".
 * With `needsContext`, the number must be next to anniversary/birthday/years
 * (used for card text, where "October 31st" is a date, not a milestone).
 */
export function extractMilestone(normalized: string, needsContext = false): number | null {
  for (const [re, value] of NAMED_MILESTONES) if (re.test(normalized)) return value

  if (needsContext) {
    const ordinalWords = Object.keys(ORDINAL_WORDS).join('|')
    const cardinalWords = Object.keys(CARDINAL_WORDS).join('|')
    const re = new RegExp(
      `\\b(?:(\\d{1,3})(?:st|nd|rd|th)?|(${ordinalWords}|${cardinalWords}))\\s+(?:wedding\\s+|happy\\s+)?${MILESTONE_CONTEXT}\\b`,
    )
    const m = normalized.match(re)
    if (m) return valid(toNumber(m[1], m[2]))
    const turning = normalized.match(new RegExp(`\\bturning\\s+(\\d{1,3}|${cardinalWords})\\b`))
    if (turning) return valid(toNumber(/\d/.test(turning[1]) ? turning[1] : undefined, turning[1]))
    return null
  }

  const ord = normalized.match(ORDINAL_RE)
  if (ord) return valid(toNumber(ord[1], ord[2]))
  const years = normalized.match(YEARS_RE)
  if (years) return valid(toNumber(/\d/.test(years[1]) ? years[1] : undefined, years[1]))
  const after = normalized.match(AFTER_EVENT_RE)
  if (after) return valid(Number(after[1]))
  return null
}

/** Removes milestone numbers so "yoga center 8th anniversary" also reads as "yoga center anniversary". */
/** 1 → "1st", 22 → "22nd", 13 → "13th". */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

export function stripMilestones(normalized: string): string {
  return normalized
    .replace(new RegExp(ORDINAL_RE.source, 'g'), ' ')
    .replace(new RegExp(YEARS_RE.source, 'g'), ' ')
    .replace(new RegExp(AFTER_EVENT_RE.source, 'g'), (match, n) => match.slice(0, match.length - String(n).length))
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Compiles phrases into one regex that matches whole words with an optional plural "s"/"es". */
export function compilePhrases(phrases: string[]): RegExp | null {
  const parts = [...new Set(phrases.map((p) => normalizeText(p)).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map((p) => escapeRegExp(p).replace(/ /g, '\\s+'))
  if (parts.length === 0) return null
  return new RegExp(`\\b(?:${parts.join('|')})(?:s|es)?\\b`, 'g')
}

/** All phrase matches in `text` with their length in words. */
export function findMatches(re: RegExp | null, text: string): string[] {
  if (!re || !text) return []
  re.lastIndex = 0
  return text.match(re) ?? []
}
