/**
 * Growing vocabulary of occasions, themes, assets and styles.
 *
 * Seeded from taxonomy.ts, then extended by AI tagging. Every term AI returns goes through
 * resolveTerm, which maps it to an existing term or creates a new one:
 *   1. exact      the normalized word is a known alias
 *   2. singular   its singular form is a known alias ("butterflies" → butterfly)
 *   3. spelling   a near-identical spelling exists ("bumble bee" / "bumblebee", typos)
 *   4. ai_judge   an AI check against similar terms ("kitty" → cat), only when AI is on
 *   5. new        none of the above: a new term is created and used right away
 * Each decision is saved as an alias, so the same word is never checked twice.
 */
import { db } from '../db'
import { isAiEnabled } from './ai-config'
import { singularPhrase, termId, termLabel } from './singular'
import { FORMATS, MOODS, OCCASION_GROUPS, RESERVED_OCCASION_WORDS, RESERVED_TERM_WORDS } from './taxonomy'
import { normalizeText, stripMilestones } from './text'

export type VocabKind = 'occasion' | 'theme' | 'asset' | 'style'

export type VocabTerm = {
  kind: VocabKind
  id: string
  label: string
  occasionGroup: string | null
  parent: string | null
  themes: string[]
  source: 'seed' | 'ai'
  templateCount: number
}

export type Vocabulary = {
  terms: VocabTerm[]
  byKind: Record<VocabKind, Map<string, VocabTerm>>
  /** Normalized alias → term id, per kind. */
  aliases: Record<VocabKind, Map<string, string>>
  /** Term id → all its aliases, per kind. */
  aliasesByTerm: Record<VocabKind, Map<string, string[]>>
}

const SPELLING_SIMILARITY = 0.8
const JUDGE_MIN_SIMILARITY = 0.35
const JUDGE_CANDIDATES = 6
const CACHE_MS = 60_000

let cached: { at: number; vocab: Promise<Vocabulary> } | null = null

/** The whole vocabulary, cached for a minute (new terms appear in search shortly after they are learned). */
export function getVocabulary(): Promise<Vocabulary> {
  if (cached && performance.now() - cached.at < CACHE_MS) return cached.vocab
  const vocab = loadVocabulary()
  cached = { at: performance.now(), vocab }
  vocab.catch(() => (cached = null))
  return vocab
}

async function loadVocabulary(): Promise<Vocabulary> {
  const [termRows, aliasRows] = await Promise.all([
    db.query(`select kind, id, label, occasion_group, parent, themes, source, template_count from vocab_term`),
    db.query<{ kind: VocabKind; alias: string; term_id: string }>(`select kind, alias, term_id from vocab_alias`),
  ])
  const empty = () => ({ occasion: new Map(), theme: new Map(), asset: new Map(), style: new Map() })
  const byKind: Vocabulary['byKind'] = empty()
  const aliases: Vocabulary['aliases'] = empty()
  const terms: VocabTerm[] = termRows.rows.map((r) => ({
    kind: r.kind,
    id: r.id,
    label: r.label,
    occasionGroup: r.occasion_group,
    parent: r.parent,
    themes: r.themes,
    source: r.source,
    templateCount: r.template_count,
  }))
  for (const t of terms) byKind[t.kind].set(t.id, t)
  const aliasesByTerm: Vocabulary['aliasesByTerm'] = empty()
  for (const a of aliasRows.rows) {
    aliases[a.kind].set(a.alias, a.term_id)
    const list = aliasesByTerm[a.kind].get(a.term_id) ?? []
    list.push(a.alias)
    aliasesByTerm[a.kind].set(a.term_id, list)
  }
  return { terms, byKind, aliases, aliasesByTerm }
}

export function invalidateVocabulary() {
  cached = null
}

export type TermHint = {
  label?: string
  occasionGroup?: string | null
  parent?: string | null
  themes?: string[]
}

export type ResolvedTerm = { id: string; method: string; created: boolean }

const FORMAT_WORDS = new Set(FORMATS.flatMap((f) => [f.id.replace(/_/g, ' '), ...f.phrases.map((p) => normalizeText(p))]))
const MOOD_WORDS = new Set(MOODS.flatMap((m) => [m.id, normalizeText(m.label), ...m.phrases.map((p) => normalizeText(p))]))

// One resolution at a time per word, so parallel taggers do not create the same term twice.
const inFlight = new Map<string, Promise<ResolvedTerm | null>>()
// New terms are created one at a time. Before creating, the word is checked again against terms
// created moments ago by other parallel taggers ("bumble bee" vs "bumblebee").
let createQueue: Promise<unknown> = Promise.resolve()
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = createQueue.then(task, task)
  createQueue = run.catch(() => undefined)
  return run
}

/** Maps a raw word from AI to a term id, creating the term when it is new. */
export function resolveTerm(kind: VocabKind, raw: string, hint: TermHint = {}): Promise<ResolvedTerm | null> {
  // "30th birthday" is a birthday with milestone 30, not an occasion of its own.
  const key = kind === 'occasion' ? stripMilestones(normalizeText(raw)) : normalizeText(raw)
  if (!key) return Promise.resolve(null)
  const lockKey = `${kind}:${singularPhrase(key)}`
  const running = inFlight.get(lockKey)
  if (running) return running
  const task = resolveTermNow(kind, key, hint).finally(() => inFlight.delete(lockKey))
  inFlight.set(lockKey, task)
  return task
}

/** Counts new terms, so a re-check can tell whether anything was added since its first look. */
let termsCreated = 0

/**
 * `checkedAt`: the value of termsCreated when the meaning check last ran for this word. Under the creation
 * lock the word is checked again, but the AI meaning check only reruns if new terms appeared since then.
 */
async function resolveTermNow(
  kind: VocabKind,
  key: string,
  hint: TermHint,
  locked = false,
  checkedAt?: number,
): Promise<ResolvedTerm | null> {
  const vocab = await getVocabulary()
  const aliases = vocab.aliases[kind]
  const singular = singularPhrase(key)
  // Theme names are often titles ("SpongeBob SquarePants", "Star Wars"), so they keep their spelling.
  const id = kind === 'theme' ? key.replace(/ /g, '_').slice(0, 60) : termId(key)

  // 1–2. Known word, or known in its singular form / as an id.
  const exact = aliases.get(key)
  if (exact) return { id: exact, method: 'exact', created: false }
  const fromSingular = aliases.get(singular) ?? (vocab.byKind[kind].has(id) ? id : undefined)
  if (fromSingular) {
    await saveAlias(kind, key, fromSingular, 'singular')
    return { id: fromSingular, method: 'singular', created: false }
  }

  // 3. Near-identical spelling, or the same letters without spaces ("bumble bee" / "bumblebee").
  const similar = await db.query<{ term_id: string; alias: string; score: number }>(
    `select term_id, alias, greatest(similarity(alias, $2), case when replace(alias, ' ', '') = replace($2, ' ', '') then 1 else 0 end) as score
       from vocab_alias where kind = $1 and (alias % $2 or replace(alias, ' ', '') = replace($2, ' ', ''))
      order by score desc limit $3`,
    [kind, singular, JUDGE_CANDIDATES * 3],
  )
  const best = similar.rows[0]
  if (best && best.score >= SPELLING_SIMILARITY) {
    await saveAlias(kind, key, best.term_id, 'spelling')
    return { id: best.term_id, method: 'spelling', created: false }
  }
  // One or two letters off. AI answers have no typos, so this is often a different word
  // ("moose" is not "mouse"): it goes to the meaning check below instead of being merged.
  const typo = closeSpelling(singular, aliases)

  // 4. Ask AI whether it means the same as one of the closest existing terms.
  const checkedNow = termsCreated
  if (isAiEnabled() && checkedAt !== termsCreated) {
    const candidateIds = [...new Set(similar.rows.filter((r) => r.score >= JUDGE_MIN_SIMILARITY).map((r) => r.term_id))]
    const wordCandidates = await wordOverlapCandidates(kind, singular)
    const candidates = [...new Set([...(typo ? [typo] : []), ...candidateIds, ...wordCandidates])].slice(0, JUDGE_CANDIDATES)
    if (candidates.length > 0) {
      const match = await judgeSameTerm(kind, key, candidates.map((c) => vocab.byKind[kind].get(c)).filter((t): t is VocabTerm => !!t))
      if (match) {
        await saveAlias(kind, key, match, 'ai_judge')
        return { id: match, method: 'ai_judge', created: false }
      }
    }
  }

  // Some words must not become new themes, elements or styles: who the card is for ("girl", "baby"),
  // an occasion ("graduation" as a theme), or an element as a theme ("butterfly"). They are dropped.
  if (kind !== 'occasion' && isReservedForOtherUse(vocab, kind, key, singular)) return null
  // A bare "shower" or "party" is not an occasion of its own, and "breakfast" is a format.
  if (kind === 'occasion' && (RESERVED_OCCASION_WORDS.has(key) || RESERVED_OCCASION_WORDS.has(singular) || FORMAT_WORDS.has(key))) {
    return null
  }

  // 5. A new term: used right away, no approval step. Re-checked first under the creation lock,
  // with the vocabulary reloaded, so a term another tagger just created is found instead.
  if (!locked) {
    return oneAtATime(() => {
      invalidateVocabulary()
      return resolveTermNow(kind, key, hint, true, checkedNow)
    })
  }
  const group = hint.occasionGroup && (OCCASION_GROUPS as readonly string[]).includes(hint.occasionGroup) ? hint.occasionGroup : null
  const parent = hint.parent && vocab.byKind.occasion.has(hint.parent) ? hint.parent : null
  const inserted = await db.query(
    `insert into vocab_term (kind, id, label, occasion_group, parent, themes, source)
     values ($1, $2, $3, $4, $5, $6, 'ai') on conflict (kind, id) do nothing`,
    [kind, id, termLabel(hint.label || singular), kind === 'occasion' ? group ?? 'Parties' : null, kind === 'occasion' ? parent : null, kind === 'asset' ? hint.themes ?? [] : []],
  )
  await saveAlias(kind, key, id, 'new')
  if (singular !== key) await saveAlias(kind, singular, id, 'new')
  if ((inserted.rowCount ?? 0) > 0) termsCreated++
  invalidateVocabulary()
  return { id, method: 'new', created: (inserted.rowCount ?? 0) > 0 }
}

function isReservedForOtherUse(vocab: Vocabulary, kind: VocabKind, key: string, singular: string): boolean {
  const forms = [key, singular]
  if (forms.some((f) => RESERVED_TERM_WORDS.has(f))) return true
  // A number ("50") is a milestone, not an element.
  if (/^(number|no)?\d+(st|nd|rd|th)?$/.test(key.replace(/ /g, ''))) return true
  // Mood words ("cozy", "playful") are moods, not themes or styles.
  if (kind !== 'asset' && forms.some((f) => MOOD_WORDS.has(f))) return true
  // An occasion's own name ("graduation") is not a theme or element. Other occasion words can be
  // real objects ("grill" is a BBQ word and a grill), so only ids and labels count here.
  const occasionNames = [...vocab.byKind.occasion.values()].flatMap((t) => [t.id.replace(/_/g, ' '), normalizeText(t.label)])
  if (forms.some((f) => occasionNames.includes(f))) return true
  // One word means one thing: "photo" is a style, so it is not also an element.
  const otherKinds: VocabKind[] = kind === 'theme' ? ['asset', 'style'] : kind === 'asset' ? ['theme', 'style'] : ['theme', 'asset']
  return otherKinds.some((k) => forms.some((f) => vocab.aliases[k].has(f)))
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = temp
    }
  }
  return row[b.length]
}

/** An existing alias within 1 edit (5+ letters) or 2 edits (9+ letters) of the word. */
function closeSpelling(word: string, aliases: Map<string, string>): string | null {
  if (word.length < 5) return null
  const allowed = word.length >= 9 ? 2 : 1
  for (const [alias, id] of aliases) {
    if (Math.abs(alias.length - word.length) > allowed || alias.length < 5) continue
    if (editDistance(alias, word) <= allowed) return id
  }
  return null
}

/** Terms sharing a whole word with the new one ("hockey puck" ↔ hockey stick), for the AI check. */
async function wordOverlapCandidates(kind: VocabKind, singular: string) {
  const words = singular.split(' ').filter((w) => w.length > 2)
  if (words.length === 0) return []
  const { rows } = await db.query<{ term_id: string }>(
    `select distinct term_id from vocab_alias
      where kind = $1 and string_to_array(alias, ' ') && $2::text[] limit ${JUDGE_CANDIDATES}`,
    [kind, words],
  )
  return rows.map((r) => r.term_id)
}

async function judgeSameTerm(kind: VocabKind, word: string, candidates: VocabTerm[]): Promise<string | null> {
  try {
    const { z } = await import('zod')
    // Through the registered Mastra instance, so the call is traced.
    const { mastra } = await import('../../mastra')
    const ids = candidates.map((c) => c.id) as [string, ...string[]]
    const schema = z.object({ match: z.enum(ids).nullable() })
    const response = await mastra.getAgent('termMatcherAgent').generate(
      `Kind: ${kind}\nNew term: "${word}"\nExisting terms:\n${candidates.map((c) => `- ${c.id} (${c.label})`).join('\n')}`,
      {
        structuredOutput: { schema },
        tracingOptions: {
          rootSpanName: `match term: ${kind} "${word}"`,
          metadata: { feature: 'term-match', kind, word, candidates: candidates.map((c) => c.id) },
        },
      },
    )
    return schema.parse(response.object).match
  } catch (error) {
    console.error('Term matching failed; treating as a new term', error)
    return null
  }
}

async function saveAlias(kind: VocabKind, alias: string, id: string, method: string) {
  await db.query(
    `insert into vocab_alias (kind, alias, term_id, method) values ($1, $2, $3, $4) on conflict (kind, alias) do nothing`,
    [kind, alias, id, method],
  )
  const vocab = await getVocabulary()
  vocab.aliases[kind].set(alias, id)
  vocab.aliasesByTerm[kind].set(id, [...(vocab.aliasesByTerm[kind].get(id) ?? []), alias])
}

/** Finds an existing term for a word (exact or singular spelling only). Never creates a term. */
export function lookupTerm(vocab: Vocabulary, kind: VocabKind, raw: string): string | null {
  const key = normalizeText(raw)
  if (!key) return null
  const id = termId(key)
  const asWritten = key.replace(/ /g, '_')
  return (
    vocab.aliases[kind].get(key) ??
    vocab.aliases[kind].get(singularPhrase(key)) ??
    (vocab.byKind[kind].has(id) ? id : vocab.byKind[kind].has(asWritten) ? asWritten : null)
  )
}

/** Recounts how many templates use each term. */
export async function refreshTermCounts() {
  await db.query(`
    with counts as (
      select 'occasion' kind, occasion id, count(*) c from template_search where occasion is not null group by occasion
      union all select 'theme', t, count(*) from template_search, unnest(themes) t group by t
      union all select 'asset', a, count(*) from template_search, unnest(assets) a group by a
      union all select 'style', s, count(*) from template_search, unnest(styles) s group by s
    )
    update vocab_term v set template_count = coalesce(c.c, 0)
      from vocab_term v2 left join counts c on c.kind = v2.kind and c.id = v2.id
     where v.kind = v2.kind and v.id = v2.id`)
  invalidateVocabulary()
}

// ---- Helpers for search and display ---------------------------------------------

/** Label for any term id, also for terms learned after the code was written. */
export function labelFor(vocab: Vocabulary, kind: VocabKind, id: string): string {
  return vocab.byKind[kind].get(id)?.label ?? termLabel(id)
}

/** Every spelling of a term (its id and aliases), for text matching. */
export function phrasesFor(vocab: Vocabulary, kind: VocabKind, id: string): string[] {
  return [...new Set([id.replace(/_/g, ' '), ...(vocab.aliasesByTerm[kind].get(id) ?? [])])]
}

export type LearnedTerm = { id: string; phrases: string[] }
export type LearnedVocabulary = Record<VocabKind, LearnedTerm[]>

/** Terms learned from AI (not in taxonomy.ts), so the query parser also understands them. */
const learnedCache = new WeakMap<Vocabulary, LearnedVocabulary>()

export function learnedTerms(vocab: Vocabulary): LearnedVocabulary {
  const hit = learnedCache.get(vocab)
  if (hit) return hit
  const pick = (kind: VocabKind) =>
    [...vocab.byKind[kind].values()].filter((t) => t.source === 'ai').map((t) => ({ id: t.id, phrases: phrasesFor(vocab, kind, t.id) }))
  const learned = { occasion: pick('occasion'), theme: pick('theme'), asset: pick('asset'), style: pick('style') }
  learnedCache.set(vocab, learned)
  return learned
}

/** An occasion and all its descendants, using parents from the database. */
/** The occasions above one, nearest first: wedding_anniversary → [anniversary]. */
export function occasionAncestorsFrom(vocab: Vocabulary, id: string): string[] {
  const out: string[] = []
  let parent = vocab.byKind.occasion.get(id)?.parent
  while (parent && !out.includes(parent)) {
    out.push(parent)
    parent = vocab.byKind.occasion.get(parent)?.parent
  }
  return out
}

export function occasionFamilyFrom(vocab: Vocabulary, id: string): string[] {
  const out = [id]
  for (const t of vocab.byKind.occasion.values()) if (t.parent === id) out.push(...occasionFamilyFrom(vocab, t.id))
  return out
}

/**
 * The vocabulary for AI prompts, in two parts so prompt caching keeps working while terms are learned:
 * - `known`: the starting vocabulary from taxonomy.ts, in a fixed order. It is the same on every call, so it is
 *   cached once and read cheaply afterwards.
 * - `learned`: terms AI tagging added, most-used first. It changes often, so it goes after the cache point.
 */
export function vocabularyPromptParts(vocab: Vocabulary, learnedPerKind = 150): { known: string; learned: string } {
  const terms = (kind: VocabKind, source: 'seed' | 'ai') =>
    [...vocab.byKind[kind].values()]
      .filter((t) => t.source === source)
      .sort((a, b) => (source === 'seed' ? a.id.localeCompare(b.id) : b.templateCount - a.templateCount || a.id.localeCompare(b.id)))
      .slice(0, source === 'seed' ? undefined : learnedPerKind)
  const occasionList = (list: VocabTerm[]) => list.map((t) => `${t.id}: ${t.label} [${t.occasionGroup ?? '-'}]`).join('; ')
  const idList = (list: VocabTerm[]) => list.map((t) => t.id).join(', ')

  const known = [
    `Known occasions (id: label [group]): ${occasionList(terms('occasion', 'seed'))}`,
    `Known themes: ${idList(terms('theme', 'seed'))}`,
    `Known assets: ${idList(terms('asset', 'seed'))}`,
    `Known styles: ${idList(terms('style', 'seed'))}`,
    `Occasion groups (use one for a new occasion): ${OCCASION_GROUPS.join(', ')}`,
  ].join('\n\n')

  const learnedLines = [
    ['occasions (id: label [group])', occasionList(terms('occasion', 'ai'))],
    ['themes', idList(terms('theme', 'ai'))],
    ['assets', idList(terms('asset', 'ai'))],
    ['styles', idList(terms('style', 'ai'))],
  ].filter(([, list]) => list)
  const learned = learnedLines.length
    ? `Also known (learned from earlier templates):\n${learnedLines.map(([name, list]) => `- ${name}: ${list}`).join('\n')}`
    : ''
  return { known, learned }
}

/** Both parts of the vocabulary as one text (for prompts that are not cached, such as query parsing). */
export function vocabularyPrompt(vocab: Vocabulary): string {
  const { known, learned } = vocabularyPromptParts(vocab)
  return [known, learned].filter(Boolean).join('\n\n')
}
