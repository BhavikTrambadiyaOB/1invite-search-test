/**
 * Detects the languages printed on a template (no AI): non-Latin scripts by their letters,
 * Latin-script languages by common words. Returns language ids from LANGUAGES, main one first.
 */
import { normalizeText } from './text'

const SCRIPTS: [string, RegExp][] = [
  ['hindi', /[ऀ-ॿ]/], // Devanagari (Hindi, Sanskrit, Marathi)
  ['gujarati', /[઀-૿]/],
  ['urdu', /[؀-ۿ]/], // Arabic script (Urdu, Arabic)
  ['other', /[ঀ-৿਀-੿஀-௿ఀ-౿ഀ-ൿ一-鿿぀-ヿ가-힯Ѐ-ӿ]/],
]

// Common words that are rare in English text. Words shared with English ("a", "me") are left out.
const WORDS: Record<string, string[]> = {
  spanish: ['el', 'los', 'las', 'y', 'con', 'para', 'nuestra', 'nuestro', 'invitamos', 'cumpleanos', 'fiesta', 'boda', 'bautizo', 'anos', 'fecha', 'hora', 'lugar', 'tu', 'mis', 'celebrar', 'acompananos', 'su', 'del', 'estas', 'invitado', 'recuerdo', 'hija', 'hijo', 'xv'],
  portuguese: ['da', 'do', 'com', 'nosso', 'nossa', 'convite', 'aniversario', 'festa', 'casamento', 'voce', 'convidamos', 'batizado', 'cha', 'em', 'nao'],
  french: ['le', 'les', 'et', 'du', 'avec', 'pour', 'notre', 'nous', 'vous', 'anniversaire', 'fete', 'mariage', 'ans', 'bapteme', 'soiree', 'est', 'sont', 'faire'],
  german: ['und', 'der', 'die', 'das', 'mit', 'fur', 'zum', 'zur', 'einladung', 'geburtstag', 'hochzeit', 'feier', 'jahre', 'wir', 'euch', 'sie', 'ist'],
  italian: ['il', 'di', 'con', 'per', 'nostro', 'nostra', 'invito', 'compleanno', 'festa', 'matrimonio', 'anni', 'battesimo', 'ti', 'vi', 'sei'],
}
// Placeholder Latin text is not a language.
const LOREM = /\blorem ipsum\b|\bdolor sit amet\b/g
const ENGLISH = new Set(['the', 'and', 'to', 'of', 'you', 'your', 'our', 'join', 'us', 'are', 'invited', 'birthday', 'party', 'please', 'at', 'for', 'with', 'celebrate', 'rsvp', 'wedding', 'on', 'is', 'in', 'happy', 'day', 'love'])
const SETS = Object.entries(WORDS).map(([id, words]) => [id, new Set(words)] as const)

/** A Latin-script language needs this many of its words, and more than English has. */
const MIN_WORDS = 3

export function detectLanguages(name: string, cardText: string): string[] {
  const raw = `${name} ${cardText}`
  const found: string[] = []

  const latin = normalizeText(cardText || name).replace(LOREM, ' ')
  const tokens = latin.split(' ').filter(Boolean)
  const english = tokens.filter((t) => ENGLISH.has(t)).length
  let best: string | null = null
  let bestHits = 0
  for (const [id, words] of SETS) {
    const hits = tokens.filter((t) => words.has(t)).length
    if (hits > bestHits) [best, bestHits] = [id, hits]
  }
  if (best && bestHits >= MIN_WORDS && bestHits > english) found.push(best)
  else if (/[a-z]/.test(latin)) found.push('english')
  if (best && !found.includes(best) && bestHits >= MIN_WORDS && bestHits * 2 >= english) found.push(best) // bilingual card

  for (const [id, re] of SCRIPTS) if (re.test(raw) && !found.includes(id)) found.push(id)
  return found
}
