/**
 * Scores template tags against the hand-checked test set (scripts/template-test-set.json).
 *
 *   npm run search:check            score the tags saved now (rules, or AI once it has run)
 *   npm run search:check -- --ai    run AI on the test-set templates (nothing saved) and score its answers
 *
 * Single fields (occasion, gender, milestone…) are right or wrong.
 * Lists (themes, elements, styles, colors) report how many expected values were found ("found")
 * and how many returned values were expected ("on target"), plus what was missing or extra.
 */
import { db } from '@/lib/db'
import { flushTracesAndClose } from './lib/close'
import { isAiEnabled } from '@/lib/search/ai-config'
import { termId } from '@/lib/search/singular'
import { COLORS, GENDERS, LANGUAGES, MOODS } from '@/lib/search/taxonomy'
import { normalizeShade } from '@/lib/search/shades'
import { normalizeText } from '@/lib/search/text'
import { getVocabulary, labelFor, lookupTerm, occasionFamilyFrom, type Vocabulary, type VocabKind } from '@/lib/search/vocabulary'
import { runAiEnrichment } from './lib/run-ai-enrichment'
import { loadTestSet, type TestTemplate } from './lib/test-set'

type Tags = {
  occasion: string | null
  gender: string | null
  milestone: number | null
  format: string | null
  docType: string | null
  themes: string[]
  assets: string[]
  styles: string[]
  colors: string[]
  moods: string[]
  colorShades: string[]
  extraOccasions: string[]
  languages: string[]
  hasPhoto: boolean
}

const SINGLE = ['occasion', 'gender', 'milestone', 'format', 'docType', 'hasPhoto'] as const
const LISTS = [
  ['themes', 'theme'],
  ['assets', 'asset'],
  ['styles', 'style'],
  ['colors', 'color'],
  ['moods', 'mood'],
  ['colorShades', 'shade'],
  ['extraOccasions', 'occasion'],
  ['languages', 'language'],
] as const

const GENDER_WORDS: Record<string, string> = {
  girl: 'girl', female: 'girl', woman: 'girl', her: 'girl', she: 'girl',
  boy: 'boy', male: 'boy', man: 'boy', him: 'boy', he: 'boy',
  neutral: 'neutral', 'gender neutral': 'neutral', any: 'neutral', unisex: 'neutral',
}

/** Turns an expected value written in everyday words into the id the tagger would use. */
function canonical(vocab: Vocabulary, kind: VocabKind | 'color' | 'gender' | 'mood' | 'language' | 'shade', value: string): string {
  const key = normalizeText(value)
  if (kind === 'shade') return normalizeShade(value)
  if (kind === 'mood' || kind === 'language') {
    const defs = kind === 'mood' ? MOODS : LANGUAGES
    return defs.find((d) => d.id === key || normalizeText(d.label) === key || d.phrases.includes(key))?.id ?? key
  }
  if (kind === 'gender') return GENDER_WORDS[key] ?? GENDERS.find((g) => normalizeText(g.label) === key)?.id ?? key
  if (kind === 'color') {
    return COLORS.find((c) => c.id === key.replace(/ /g, '_') || normalizeText(c.label) === key || c.phrases.includes(key))?.id ?? termId(key)
  }
  return (
    lookupTerm(vocab, kind, value) ??
    [...vocab.byKind[kind].values()].find((t) => normalizeText(t.label) === key)?.id ??
    termId(value)
  )
}

async function savedTags(ids: number[]): Promise<Map<number, Tags>> {
  const { rows } = await db.query(
    `select template_id, occasion, gender, milestone, format, doc_type, themes, assets, styles, colors,
            moods, color_shades, extra_occasions, languages, has_photo
       from template_search where template_id = any($1)`,
    [ids],
  )
  return new Map(
    rows.map((r) => [
      r.template_id,
      {
        occasion: r.occasion, gender: r.gender, milestone: r.milestone, format: r.format, docType: r.doc_type,
        themes: r.themes, assets: r.assets, styles: r.styles, colors: r.colors,
        moods: r.moods, colorShades: r.color_shades, extraOccasions: r.extra_occasions, languages: r.languages, hasPhoto: r.has_photo,
      },
    ]),
  )
}

async function aiTags(ids: number[]): Promise<Map<number, Tags>> {
  const out = await runAiEnrichment(ids, { save: false })
  for (const f of out.failed) console.error(`template ${f.templateId}: AI failed: ${f.error}`)
  return new Map(out.enriched.map((e) => [e.templateId, e]))
}

async function main() {
  const useAi = process.argv.includes('--ai')
  if (useAi && !isAiEnabled()) {
    console.log('AI is off. Set OPENAI_API_KEY and SEARCH_AI_ENABLED=true in .env, or run without --ai to score saved tags.')
    return
  }
  const testSet = await loadTestSet()
  const ids = testSet.map((t) => t.id)
  const actualById = useAi ? await aiTags(ids) : await savedTags(ids)
  const vocab = await getVocabulary()
  console.log(`Scoring ${useAi ? 'AI answers (not saved)' : 'saved tags'} for ${testSet.length} test templates\n`)

  const single: Record<string, { right: number; total: number }> = {}
  const lists: Record<string, { expected: number; found: number; returned: number; onTarget: number }> = {}

  for (const t of testSet) {
    const actual = actualById.get(t.id)
    console.log(`#${t.id}${t.note ? `  (${t.note})` : ''}`)
    if (!actual) {
      console.log('  ✗ no tags (template missing or AI failed)\n')
      continue
    }
    checkSingle(t, actual, vocab, single)
    checkLists(t, actual, vocab, lists)
    console.log()
  }

  console.log('Summary')
  for (const [field, s] of Object.entries(single)) console.log(`  ${field.padEnd(10)} ${s.right}/${s.total} right`)
  for (const [field, s] of Object.entries(lists)) {
    const found = s.expected ? Math.round((s.found / s.expected) * 100) : 100
    const onTarget = s.returned ? Math.round((s.onTarget / s.returned) * 100) : 100
    console.log(`  ${field.padEnd(10)} ${found}% found (${s.found}/${s.expected}), ${onTarget}% on target (${s.onTarget}/${s.returned})`)
  }
}

function checkSingle(t: TestTemplate, actual: Tags, vocab: Vocabulary, totals: Record<string, { right: number; total: number }>) {
  for (const field of SINGLE) {
    const expected = t.expect[field]
    if (expected === undefined) continue
    const want =
      field === 'occasion' ? canonical(vocab, 'occasion', String(expected))
      : field === 'gender' ? canonical(vocab, 'gender', String(expected))
      : field === 'milestone' || field === 'hasPhoto' ? expected
      : normalizeText(String(expected)).replace(/ /g, '_')
    const got = actual[field] ?? (field === 'gender' ? 'neutral' : null)
    // A more specific occasion inside the expected family (first_birthday for birthday) counts as right.
    const ok = got === want || (field === 'occasion' && !!got && occasionFamilyFrom(vocab, String(want)).includes(String(got)))
    totals[field] ??= { right: 0, total: 0 }
    totals[field].total++
    if (ok) totals[field].right++
    const show = (v: unknown) => (field === 'occasion' && v ? labelFor(vocab, 'occasion', String(v)) : String(v ?? '—'))
    console.log(`  ${ok ? '✓' : '✗'} ${field.padEnd(10)} expected ${show(want)}, got ${show(got)}`)
  }
}

function checkLists(
  t: TestTemplate,
  actual: Tags,
  vocab: Vocabulary,
  totals: Record<string, { expected: number; found: number; returned: number; onTarget: number }>,
) {
  for (const [field, kind] of LISTS) {
    const expectedRaw = t.expect[field]
    if (!expectedRaw) continue
    let want = [...new Set(expectedRaw.map((v) => canonical(vocab, kind, v)))]
    let got = actual[field]
    if (field === 'extraOccasions') {
      // Main and extra occasions may come in either order (Kids Birthday + Birthday, or the reverse):
      // compare all occasions on each side.
      const main = t.expect.occasion ? [canonical(vocab, 'occasion', t.expect.occasion)] : []
      want = [...new Set([...main, ...want])]
      got = [...new Set([...(actual.occasion ? [actual.occasion] : []), ...got])]
    }
    const found = want.filter((w) => got.includes(w))
    const missing = want.filter((w) => !got.includes(w))
    const extra = got.filter((g) => !want.includes(g))
    totals[field] ??= { expected: 0, found: 0, returned: 0, onTarget: 0 }
    totals[field].expected += want.length
    totals[field].found += found.length
    totals[field].returned += got.length
    totals[field].onTarget += got.length - extra.length
    const name = (id: string) =>
      kind === 'occasion' || kind === 'theme' || kind === 'asset' || kind === 'style' ? labelFor(vocab, kind, id) : id
    const mark = missing.length === 0 ? '✓' : '✗'
    console.log(
      `  ${mark} ${field.padEnd(10)} found ${found.length}/${want.length}` +
        (missing.length ? ` · missing ${missing.map(name).join(', ')}` : '') +
        (extra.length ? ` · extra ${extra.map(name).join(', ')}` : ''),
    )
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => flushTracesAndClose())
