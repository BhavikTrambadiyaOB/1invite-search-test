import { parseQuery } from './parse-query'
import { ordinal } from './text'
import {
  COLOR_BY_ID,
  DOC_TYPE_BY_ID,
  FORMAT_BY_ID,
  GENDER_BY_ID,
  LANGUAGE_BY_ID,
  MOOD_BY_ID,
} from './taxonomy'
import { parseSearchParams, searchHref } from './url'
import type { SearchFilters, SearchIntent } from './types'
import { getVocabulary, labelFor, learnedTerms, type Vocabulary } from './vocabulary'

/** A label read from the query, shown as a chip in the report view. */
export type QueryTag = {
  key: string
  group: string
  value: string
  label: string
}

/**
 * The tags a query is understood as (occasion, age, theme, style…). Rules only: the report must render
 * without calling the AI or either search.
 */
export function queryTagsFromIntent(intent: SearchIntent, vocab: Vocabulary): QueryTag[] {
  const tags: QueryTag[] = []
  const add = (group: string, value: string, label: string) => {
    const key = `${group}:${value}`
    if (!tags.some((tag) => tag.key === key)) tags.push({ key, group, value, label })
  }

  if (intent.occasion) add('occasions', intent.occasion, labelFor(vocab, 'occasion', intent.occasion))
  for (const occasion of intent.alsoOccasions) add('occasions', occasion, labelFor(vocab, 'occasion', occasion))
  if (intent.milestone) add('milestones', String(intent.milestone), ordinal(intent.milestone))
  if (intent.format) add('format', intent.format, FORMAT_BY_ID.get(intent.format)?.label ?? intent.format)
  if (intent.gender) add('genders', intent.gender, GENDER_BY_ID.get(intent.gender)?.label ?? intent.gender)
  for (const theme of intent.themes) add('themes', theme, labelFor(vocab, 'theme', theme))
  for (const asset of intent.assets) add('assets', asset, labelFor(vocab, 'asset', asset))
  for (const color of intent.colors) add('colors', color, COLOR_BY_ID.get(color)?.label ?? color)
  for (const style of intent.styles) add('styles', style, labelFor(vocab, 'style', style))
  for (const mood of intent.moods) add('moods', mood, MOOD_BY_ID.get(mood)?.label ?? mood)
  if (intent.language) add('languages', intent.language, LANGUAGE_BY_ID.get(intent.language)?.label ?? intent.language)
  if (intent.hasPhoto) add('photo', 'with', 'With photo')
  if (intent.docType) add('docTypes', intent.docType, DOC_TYPE_BY_ID.get(intent.docType)?.label ?? intent.docType)
  if (intent.isFree === true) add('price', 'free', 'Free')
  if (intent.isFree === false) add('price', 'premium', 'PRO')

  return tags
}

/** The tags a stored report query is understood as, without AI or a search run. */
export async function queryTags(query: string): Promise<QueryTag[]> {
  const vocab = await getVocabulary()
  return queryTagsFromIntent(parseQuery(query, learnedTerms(vocab)), vocab)
}

/** Opens the query in search and applies the selected tag as an explicit filter when supported. */
export function queryTagFilterHref(query: string, tag: QueryTag) {
  const filters: Partial<SearchFilters> = {}

  switch (tag.group) {
    case 'occasions':
      filters.occasions = [tag.value]
      break
    case 'milestones': {
      const milestone = Number(tag.value)
      if (Number.isInteger(milestone) && milestone > 0 && milestone <= 200) {
        filters.milestones = [milestone]
      }
      break
    }
    case 'format':
      break
    case 'genders':
      filters.genders = [tag.value]
      break
    case 'themes':
      filters.themes = [tag.value]
      break
    case 'assets':
      filters.assets = [tag.value]
      break
    case 'colors':
      filters.colors = [tag.value]
      break
    case 'styles':
      filters.styles = [tag.value]
      break
    case 'moods':
      filters.moods = [tag.value]
      break
    case 'languages':
      filters.languages = [tag.value]
      break
    case 'photo':
      filters.photo = tag.value === 'with' ? 'with' : 'without'
      break
    case 'docTypes':
      filters.docTypes = [tag.value]
      break
    case 'price':
      if (tag.value === 'free' || tag.value === 'premium') filters.price = tag.value
      break
  }

  return searchHref(parseSearchParams({ q: query }), { filters, debug: true })
}

/** Opens the full query in debug mode so its search filters can be adjusted. */
export function querySearchHref(query: string) {
  return searchHref(parseSearchParams({ q: query }), { debug: true })
}
