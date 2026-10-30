/**
 * One-off data fixes for search (Phase D). Shows what would change; `--apply` writes it.
 *
 *   npm run search:fix-data              dry run: counts and examples
 *   npm run search:fix-data -- --apply   write the changes
 *
 * 1. Occasions: parents for learned occasions (LEARNED_OCCASION_PARENTS) and merges of tiny duplicates
 *    (LEARNED_OCCASION_MERGES), both from taxonomy.ts.
 * 2. Audience: baby showers and gender reveals are for adult guests (ADULT_GUEST_OCCASIONS).
 * 3. Languages: Tamil, Telugu, Bengali, Punjabi, Gujarati, Marathi, Arabic and Zulu read from the card's script
 *    and words, instead of "Other" or "Hindi". No AI.
 * 4. Cached AI readings of queries that name a changed language or occasion are cleared.
 *
 * Changed templates get new embeddings with `npm run search:embed` (only changed text is re-embedded).
 */
import { db } from '@/lib/db'
import { occasionWords } from '@/lib/search/rule-enrich'
import {
  ADULT_GUEST_OCCASIONS,
  HINDI_WORDS,
  LEARNED_OCCASION_ALIASES,
  LEARNED_OCCASION_MERGES,
  LEARNED_OCCASION_PARENTS,
  MARATHI_WORDS,
  SCRIPT_LANGUAGES,
  URDU_LETTERS,
  ZULU_WORDS,
} from '@/lib/search/taxonomy'

const apply = process.argv.includes('--apply')
/** Fewer words than this in another script, on an English card, is a blessing line, not a language. */
const BLESSING_WORDS = 10
const log = (...args: unknown[]) => console.log(...args)

async function occasions() {
  const { rows: terms } = await db.query<{ id: string; parent: string | null; source: string }>(
    `select id, parent, source from vocab_term where kind = 'occasion'`,
  )
  const byId = new Map(terms.map((t) => [t.id, t]))

  let parents = 0
  for (const [child, parent] of Object.entries(LEARNED_OCCASION_PARENTS)) {
    const term = byId.get(child)
    if (!term) { log(`  skip parent: ${child} is not a known occasion`); continue }
    if (!byId.has(parent)) { log(`  skip parent: ${parent} is not a known occasion`); continue }
    if (term.source === 'seed' || term.parent === parent) continue
    if (term.parent) { log(`  skip parent: ${child} already has parent ${term.parent}`); continue }
    parents++
    if (apply) await db.query(`update vocab_term set parent = $2 where kind = 'occasion' and id = $1`, [child, parent])
  }
  log(`occasions: ${parents} parents set`)

  let aliases = 0
  for (const [alias, id] of Object.entries(LEARNED_OCCASION_ALIASES)) {
    if (!byId.has(id)) { log(`  skip alias: ${id} is not a known occasion`); continue }
    const { rowCount } = apply
      ? await db.query(`insert into vocab_alias (kind, alias, term_id, method) values ('occasion', $1, $2, 'seed') on conflict do nothing`, [alias, id])
      : await db.query(`select 1 from (select 1) x where not exists (select 1 from vocab_alias where kind = 'occasion' and alias = $1)`, [alias])
    aliases += rowCount ?? 0
  }
  log(`occasions: ${aliases} spellings added`)

  for (const [from, to] of Object.entries(LEARNED_OCCASION_MERGES)) {
    if (!byId.has(from)) continue
    if (!byId.has(to)) { log(`  skip merge: ${to} is not a known occasion`); continue }
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int n from template_search where occasion = $1 or $1 = any(extra_occasions)`, [from],
    )
    log(`  merge ${from} → ${to}: ${rows[0].n} templates`)
    if (!apply) continue
    await db.query(`update template_search set occasion = $2, occasion_words = $3 where occasion = $1`, [from, to, occasionWords(to)])
    // Replace in extra occasions, dropping it when it is now the card's own occasion.
    await db.query(
      `update template_search
          set extra_occasions = array(select distinct o from unnest(array_replace(extra_occasions, $1, $2)) o where o is distinct from occasion)
        where $1 = any(extra_occasions)`,
      [from, to],
    )
    await db.query(
      `update vocab_alias set term_id = $2 where kind = 'occasion' and term_id = $1
          and alias not in (select alias from vocab_alias where kind = 'occasion' and term_id = $2)`,
      [from, to],
    )
    await db.query(`delete from vocab_term where kind = 'occasion' and id = $1`, [from])
  }
}

async function audience() {
  const ids = [...ADULT_GUEST_OCCASIONS]
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int n from template_search where occasion = any($1) and audience is distinct from 'adults'`, [ids],
  )
  log(`audience: ${rows[0].n} baby shower / gender reveal templates → adults`)
  if (apply) await db.query(`update template_search set audience = 'adults' where occasion = any($1) and audience is distinct from 'adults'`, [ids])
}

/** Languages a card is printed in, read from its letters and words. Empty when nothing is certain. */
function detectLanguages(text: string): string[] {
  const found: string[] = []
  for (const [re, lang] of SCRIPT_LANGUAGES) if (re.test(text)) found.push(lang)
  if (/\p{Script=Arabic}/u.test(text)) found.push(URDU_LETTERS.test(text) ? 'urdu' : 'arabic')
  if (/\p{Script=Devanagari}/u.test(text)) {
    const words = text.split(/[^\p{L}\p{M}]+/u)
    const count = (list: string[]) => words.filter((w) => list.includes(w)).length
    found.push(count(MARATHI_WORDS) > count(HINDI_WORDS) ? 'marathi' : 'hindi')
  }
  if (ZULU_WORDS.test(text)) found.push('zulu')
  return found
}

async function languages() {
  const { rows } = await db.query<{ template_id: number; name: string; card_text: string; languages: string[] }>(
    `select template_id, name, card_text, languages from template_search
      where languages && array['other', 'hindi', 'urdu']::text[] or name || card_text ~ '[^\\x01-\\x7F]'`,
  )
  const changes: { id: number; from: string[]; to: string[]; name: string }[] = []
  for (const r of rows) {
    const text = `${r.name} ${r.card_text}`
    // An English card with only a short blessing line ("ॐ गणपतये नमः", "ੴ ਸਤਿਗੁਰੂ ਪ੍ਰਸ਼ਾਦ") is an English card.
    const otherScriptWords = text.split(/\s+/).filter((w) => /(?!\p{Script=Latin})\p{L}/u.test(w)).length
    const blessingOnly = r.languages.includes('english') && otherScriptWords < BLESSING_WORDS
    const detected = blessingOnly ? [] : detectLanguages(text)
    if (blessingOnly && r.languages.includes('other') && /(?!\p{Script=Latin})\p{L}/u.test(text)) {
      changes.push({ id: r.template_id, from: r.languages, to: r.languages.filter((l) => l !== 'other'), name: r.name })
      continue
    }
    if (!detected.length) continue
    let next = [...r.languages]
    // "Other" and "Hindi" were the fallbacks for these scripts; the detected language replaces them.
    if (detected.includes('marathi')) next = next.map((l) => (l === 'hindi' ? 'marathi' : l))
    next = next.map((l) => (l === 'other' ? detected.find((d) => !next.includes(d)) ?? 'other' : l)).filter((l) => l !== 'other')
    for (const d of detected) if (!next.includes(d)) next.push(d)
    next = [...new Set(next)]
    if (next.join() !== r.languages.join()) changes.push({ id: r.template_id, from: r.languages, to: next, name: r.name })
  }
  const summary = new Map<string, number>()
  for (const c of changes) summary.set(`${c.from.join('/')} → ${c.to.join('/')}`, (summary.get(`${c.from.join('/')} → ${c.to.join('/')}`) ?? 0) + 1)
  log(`languages: ${changes.length} templates`)
  for (const [k, n] of [...summary].sort((a, b) => b[1] - a[1])) log(`  ${n}× ${k}`)
  for (const c of changes.slice(0, 12)) log(`    ${c.id} ${c.name.slice(0, 50)}: ${c.from.join('/')} → ${c.to.join('/')}`)
  if (!apply) return
  for (const c of changes) await db.query('update template_search set languages = $2 where template_id = $1', [c.id, c.to])
}

async function queryCache() {
  const words = ['marathi', 'tamil', 'telugu', 'bengali', 'bangla', 'punjabi', 'arabic', 'urdu', 'zulu', 'xhosa', 'lunch', 'breakfast', 'luncheon']
  const pattern = `\\m(${words.join('|')})`
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int n from search_query_cache where intent is not null and normalized_query ~ $1`, [pattern],
  )
  log(`query cache: ${rows[0].n} AI readings to re-ask`)
  if (apply) await db.query(`update search_query_cache set intent = null where intent is not null and normalized_query ~ $1`, [pattern])
}

async function main() {
  log(apply ? 'Applying changes' : 'Dry run (add --apply to write)')
  await occasions()
  await audience()
  await languages()
  await queryCache()
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.end())
