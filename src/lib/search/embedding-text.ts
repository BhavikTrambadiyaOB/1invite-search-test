import { COLOR_BY_ID, DOC_TYPE_BY_ID, GENDER_BY_ID, LANGUAGE_BY_ID, MOOD_BY_ID } from './taxonomy'
import { ordinal } from './text'
import { labelFor, type Vocabulary } from './vocabulary'

/** The template fields that go into its embedding. */
export type EmbeddingSource = {
  name: string
  occasion: string | null
  extraOccasions: string[]
  milestone: number | null
  docType: string | null
  gender: string | null
  audience: string | null
  themes: string[]
  assets: string[]
  styles: string[]
  moods: string[]
  colors: string[]
  colorShades: string[]
  languages: string[]
  hasPhoto: boolean
  summary: string
  cardText: string
}

// Words in every template name that say nothing about the design.
const NAME_FILLER = /\b(invitation|invite|template|card|design|announcement|greetings?)\b/gi

// Card text lines that are placeholders users replace: addresses, phone numbers, dates, times, RSVP lines.
const PLACEHOLDER_LINE =
  /\d{3}|\d{1,2}\s*[:/.]\s*\d{2}|\d\s*(am|pm)\b|\b(rsvp|regrets|address|road|rd|street|ave|avenue|blvd|lane|suite|usa|india|anytown|am|pm|p\.m|a\.m|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|www|http|\.com|@)\b/i

// Sample names printed on templates ("Sophia Robinson", "John Doe"); they are replaced by users.
const SAMPLE_NAMES =
  /\b(john|doe|jane|sophia|robinson|richard|joseph|hanger|arieta|benson|sara|sarah|sue|vaneer|barb|dwyer|cliff|bellum|olivia|emma|liam|noah|smith|james)\b('s)?/gi

/** The card's own wording ("Let's par-tea", "Oh what a year!") without names, addresses and dates. */
function meaningfulCardText(cardText: string): string {
  return cardText
    .split('|')
    .map((line) => line.replace(SAMPLE_NAMES, ' ').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 2 && !PLACEHOLDER_LINE.test(line))
    .join('. ')
    .slice(0, 400)
}

/**
 * The text embedded for a template: what the design is for, what it shows and how it feels, in plain words.
 * Tags give the facts, the AI summary adds the visual description, and the card's own wording adds
 * phrases people search for ("little pumpkin", "oh baby"). Placeholders (names, addresses) are left out.
 */
export function embeddingText(t: EmbeddingSource, vocab: Vocabulary): string {
  const label = (kind: 'occasion' | 'theme' | 'asset' | 'style', id: string) => labelFor(vocab, kind, id)
  const list = (values: string[]) => [...new Set(values.filter(Boolean))].join(', ')
  const parts: string[] = []

  const name = t.name.replace(NAME_FILLER, ' ').replace(/\s+/g, ' ').trim()
  if (name) parts.push(name)

  const occasions = [t.occasion, ...t.extraOccasions].filter((o): o is string => !!o).map((o) => label('occasion', o))
  if (occasions.length) parts.push(`Occasion: ${list(occasions)}`)
  // Only when it is not an invitation (most cards are), so "eid greeting" and "graduation announcement" match.
  if (t.docType && t.docType !== 'invitation') parts.push(`Card type: ${DOC_TYPE_BY_ID.get(t.docType)?.label ?? t.docType}`)
  // Age or years on its own, in both forms people type: "8th birthday" and "8 year old" / "25 years".
  if (t.milestone) parts.push(`Milestone: ${ordinal(t.milestone)} (${t.milestone} ${t.milestone === 1 ? 'year' : 'years'})`)

  const forWho = [
    t.gender && t.gender !== 'neutral' ? GENDER_BY_ID.get(t.gender)?.label : null,
    t.audience,
  ].filter((v): v is string => !!v)
  if (forWho.length) parts.push(`For: ${list(forWho)}`)

  if (t.themes.length) parts.push(`Themes: ${list(t.themes.map((x) => label('theme', x)))}`)
  if (t.assets.length) parts.push(`Shows: ${list(t.assets.map((x) => label('asset', x)))}`)
  if (t.styles.length) parts.push(`Style: ${list(t.styles.map((x) => label('style', x)))}`)
  if (t.moods.length) parts.push(`Mood: ${list(t.moods.map((x) => MOOD_BY_ID.get(x)?.label ?? x))}`)

  const colors = [...t.colorShades, ...t.colors.map((c) => COLOR_BY_ID.get(c)?.label ?? c)]
  if (colors.length) parts.push(`Colors: ${list(colors)}`)

  const otherLanguages = t.languages.filter((l) => l !== 'english').map((l) => LANGUAGE_BY_ID.get(l)?.label ?? l)
  if (otherLanguages.length) parts.push(`Language: ${list(otherLanguages)}`)
  if (t.hasPhoto) parts.push('With a photo')

  if (t.summary) parts.push(t.summary)
  const words = meaningfulCardText(t.cardText)
  if (words) parts.push(`Card says: ${words}`)

  return parts.join('. ').replace(/\.\./g, '.')
}
