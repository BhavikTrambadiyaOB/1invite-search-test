/**
 * "without", "no", "not", "non", "except", "avoid"…: what the person does NOT want. Read before the query itself,
 * so the excluded part is never searched for ("1st birthday no photo" used to ask for a photo).
 *
 * Only the understood thing right after the negation word is excluded: a photo, PRO or free, an RSVP line, a joint
 * card (twins), a printed age (year, age) or one theme, element, color or style tag. When the next word is anything
 * else (an occasion, "card", an unknown word), the words stay as they are: in Gujarati and Hindi "no" means "of"
 * ("mara bhai no birthday", "happy birthday no card").
 */
import { parseQuery } from './parse-query'
import { JOINT_WORDS } from './taxonomy'
import { normalizeText } from './text'
import type { SearchExclusions } from './types'
import type { LearnedVocabulary } from './vocabulary'

/** Negation words, longest first ("with out" before "with"). */
const NEGATIONS = [
  ['do', 'not', 'want'], ['dont', 'want'], ['don', 't', 'want'], ['do', 'not', 'need'], ['dont', 'need'],
  ['with', 'out'], ['w', 'o'],
  ['without'], ['no'], ['not'], ['non'], ['except'], ['excluding'], ['exclude'], ['avoid'], ['minus'], ['skip'],
]
/** Words that may sit between the negation and the thing ("not in pro", "not so simple", "without any balloons"). */
const FILLERS = new Set(['a', 'an', 'the', 'any', 'in', 'so', 'too', 'very', 'of', 'much', 'more', 'with', 'my'])
/** Words before the negation that only lead into it ("which is not pro", "but not twins", "with no year"). */
const LEAD_INS = new Set(['which', 'that', 'is', 'are', 'has', 'have', 'does', 'but', 'with', 'and'])
/** A word after the thing that only repeats it ("not pro one"). */
const TRAILERS = new Set(['one', 'ones', 'version', 'versions', 'option', 'options'])

const PHOTO_WORDS = new Set(['photo', 'photos', 'picture', 'pictures', 'pic', 'pics', 'image', 'images', 'photograph', 'photographs'])
const PRO_WORDS = new Set(['pro', 'premium', 'paid'])
const AGE_WORDS = new Set(['year', 'years', 'age', 'ages', 'number', 'numbers', 'milestone'])
const RSVP_WORDS = new Set(['rsvp', 'rsvps', 'reply', 'replies'])
/** Wording printed on cards, not a part to leave out: "no gifts please", "no host dinner", "no boys allowed". */
const CARD_WORDING = new Set(['gift', 'gifts', 'present', 'presents', 'host', 'boys', 'girls', 'parents', 'kids', 'children', 'shoes', 'phones', 'drama', 'plus'])

export function emptyExclusions(): SearchExclusions {
  return { photo: false, pro: false, free: false, rsvp: false, joint: false, printedAge: false, themes: [], assets: [], colors: [], styles: [] }
}

export function hasExclusions(e: SearchExclusions | null | undefined): e is SearchExclusions {
  return !!e && (e.photo || e.pro || e.free || e.rsvp || e.joint || e.printedAge ||
    e.themes.length + e.assets.length + e.colors.length + e.styles.length > 0)
}

/** What one fragment after a negation word means, or null when it is not something search can leave out. */
function readTarget(words: string[], learned?: LearnedVocabulary): Partial<SearchExclusions> | null {
  if (words.length === 1) {
    const [w] = words
    if (PHOTO_WORDS.has(w)) return { photo: true }
    if (PRO_WORDS.has(w)) return { pro: true }
    if (w === 'free') return { free: true }
    if (RSVP_WORDS.has(w)) return { rsvp: true }
    if (JOINT_WORDS.includes(w)) return { joint: true }
    if (AGE_WORDS.has(w)) return { printedAge: true }
  }
  if (words.join(' ') === 'r s v p') return { rsvp: true }
  // One understood design tag and nothing else: "balloons", "pink", "hot air balloon", "simple".
  const read = parseQuery(words.join(' '), learned)
  const tags = read.themes.length + read.assets.length + read.colors.length + read.styles.length
  const anythingElse = read.occasion || read.alsoOccasions.length || read.milestone || read.format || read.docType ||
    read.gender || read.audience || read.language || read.hasPhoto || read.moods.length || read.keywords.length
  if (tags !== 1 || anythingElse) return null
  return { themes: read.themes, assets: read.assets, colors: read.colors, styles: read.styles }
}

function startsWith(words: string[], at: number, phrase: string[]) {
  return phrase.every((w, i) => words[at + i] === w)
}

/**
 * Splits a query into what is wanted (`rest`, searched as usual) and what is not (`exclude`). `rest` is the query
 * unchanged when nothing could be excluded.
 */
export function readNegations(query: string, learned?: LearnedVocabulary): { rest: string; exclude: SearchExclusions | null } {
  const words = normalizeText(query).split(' ').filter(Boolean)
  const exclude = emptyExclusions()
  const drop = new Set<number>()
  // "rsvp free", "rsvpless", "rsvp-less": no reply line either.
  for (let i = 0; i < words.length; i++) {
    if (words[i] === 'rsvpless' || (RSVP_WORDS.has(words[i]) && (words[i + 1] === 'free' || words[i + 1] === 'less'))) {
      exclude.rsvp = true
      drop.add(i)
      if (words[i] !== 'rsvpless') drop.add(i + 1)
    }
  }
  for (let i = 0; i < words.length; i++) {
    if (drop.has(i)) continue
    const neg = NEGATIONS.find((n) => startsWith(words, i, n))
    if (!neg) continue
    let at = i + neg.length
    while (at < words.length && FILLERS.has(words[at])) at++
    if (CARD_WORDING.has(words[at])) continue
    // The longest fragment (up to 3 words) that names one thing: "hot air balloon" before "hot".
    let found: { length: number; target: Partial<SearchExclusions> } | null = null
    for (let length = Math.min(3, words.length - at); length >= 1 && !found; length--) {
      const target = readTarget(words.slice(at, at + length), learned)
      if (target) found = { length, target }
    }
    if (!found) continue
    for (const [key, value] of Object.entries(found.target) as [keyof SearchExclusions, unknown][]) {
      if (Array.isArray(value)) (exclude[key] as string[]).push(...value.filter((v) => !(exclude[key] as string[]).includes(v)))
      else if (value === true) (exclude[key] as boolean) = true
    }
    let end = at + found.length
    if (TRAILERS.has(words[end])) end++
    let start = i
    while (start > 0 && LEAD_INS.has(words[start - 1]) && !drop.has(start - 1)) start--
    for (let k = start; k < end; k++) drop.add(k)
    i = end - 1
  }
  if (!hasExclusions(exclude)) return { rest: query, exclude: null }
  return { rest: words.filter((_, k) => !drop.has(k)).join(' '), exclude }
}
