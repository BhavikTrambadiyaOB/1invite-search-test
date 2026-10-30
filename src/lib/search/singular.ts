import pluralize from 'pluralize'
import { normalizeText } from './text'

// Words the library gets wrong or that must stay as they are.
// Plural words in titles stay plural too ("Star Wars", "The Incredibles").
for (const word of ['texas', 'dallas', 'adidas', 'physics', 'thanks', 'gatsby', 'christmas', 'easter', 'diwali', 'oasis', 'axis', 'sushi', 'confetti', 'bowling', 'sweets', 'wars', 'incredibles', 'avengers', 'muppets', 'smurfs', 'teletubbies', 'tunes', 'gras']) {
  pluralize.addUncountableRule(word)
}
pluralize.addIrregularRule('cookie', 'cookies')
pluralize.addIrregularRule('smore', 'smores')

/** Singular form of one normalized word. Leaves short words and non-plurals alone. */
export function singularWord(word: string): string {
  if (word.length <= 3 || /\d/.test(word) || !pluralize.isPlural(word)) return word
  return pluralize.singular(word)
}

/**
 * Normalized singular phrase. Only the last word changes, since it carries the plural
 * in English compounds: "hockey sticks" → "hockey stick", "christmas trees" → "christmas tree".
 */
export function singularPhrase(text: string): string {
  const words = normalizeText(text).split(' ').filter(Boolean)
  if (words.length === 0) return ''
  words[words.length - 1] = singularWord(words[words.length - 1])
  return words.join(' ')
}

/** Plural of a normalized phrase (last word), used to register both forms as aliases. */
export function pluralPhrase(text: string): string {
  const words = normalizeText(text).split(' ').filter(Boolean)
  if (words.length === 0) return ''
  const last = words[words.length - 1]
  if (last.length <= 2 || /\d/.test(last)) return words.join(' ')
  words[words.length - 1] = pluralize.plural(last)
  return words.join(' ')
}

/** Database id for a term: singular, snake_case. "Hockey Sticks" → hockey_stick. */
export function termId(text: string): string {
  return singularPhrase(text).replace(/ /g, '_').slice(0, 60)
}

/** Display label from an id or phrase: hockey_stick → "Hockey Stick". */
export function termLabel(text: string): string {
  return singularPhrase(text.replace(/_/g, ' '))
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}
