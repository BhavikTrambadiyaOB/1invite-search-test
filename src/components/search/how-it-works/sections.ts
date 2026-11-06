import styles from './how-it-works.module.css'

/** Joins class names from the page's CSS module ("sec is-active" → hashed names). */
export function c(names: string): string {
  return names
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] ?? name)
    .join(' ')
}

export type Part = { n: number; label: string; color: string; verb?: string }

/** Parts 1–4 are the four verbs to remember: Label → Read → Rank → Suggest. */
export const PARTS: Part[] = [
  { n: 0, label: 'Big picture', color: 'var(--ink)' },
  { n: 1, label: 'Label', color: 'var(--p1)', verb: 'Give every template labels' },
  { n: 2, label: 'Read', color: 'var(--p2)', verb: 'Turn the search into the same labels' },
  { n: 3, label: 'Rank', color: 'var(--p3)', verb: 'Compare labels, best match first' },
  { n: 4, label: 'Suggest', color: 'var(--p4)', verb: 'Offer the next label to tap' },
  { n: 5, label: 'Improve', color: 'var(--p5)' },
  { n: 6, label: 'Remember', color: 'var(--ink)' },
]

/** Every section in reading order: the side menu, focus mode and the previous/next links use this list. */
export const SECTIONS: { id: string; nav: string; title: string; part: number }[] = [
  { id: 'big-picture', nav: 'The whole system', title: 'The whole system on one screen', part: 0 },
  { id: 'pipeline', nav: 'Metadata pipeline', title: 'The metadata pipeline', part: 1 },
  { id: 'fields', nav: 'Template fields', title: 'What a template knows about itself', part: 1 },
  { id: 'vocabulary', nav: 'Vocabulary', title: 'The shared vocabulary', part: 1 },
  { id: 'text-index', nav: 'Word index', title: 'The word index', part: 1 },
  { id: 'query', nav: 'Reading the query', title: 'Reading the query', part: 2 },
  { id: 'filter-or-rank', nav: 'Filter or rank', title: 'Filter or rank?', part: 2 },
  { id: 'relevance', nav: 'Relevance', title: 'Relevance: how well a template matches', part: 3 },
  { id: 'order', nav: 'Sorting ladder', title: 'The sorting ladder', part: 3 },
  { id: 'score', nav: 'Final score', title: 'Final score: match, freshness, quality', part: 3 },
  { id: 'tags', nav: 'Tag chips', title: 'Tag chips: which kind to show', part: 4 },
  { id: 'tag-score', nav: 'Tag scoring', title: 'How each detail chip is scored', part: 4 },
  { id: 'sidebar', nav: 'Sidebar filters', title: 'Sidebar filters', part: 4 },
  { id: 'quality', nav: 'Quality loop', title: 'The quality loop', part: 5 },
  { id: 'gaps', nav: 'Known gaps', title: 'Known gaps', part: 5 },
  { id: 'numbers', nav: 'All numbers', title: 'Every number, in one place', part: 5 },
  { id: 'glossary', nav: 'Glossary', title: 'Glossary', part: 5 },
  { id: 'cheat-sheet', nav: 'Cheat sheet', title: 'The whole system in 10 lines', part: 6 },
  { id: 'test-yourself', nav: 'Test yourself', title: 'Test yourself', part: 6 },
]
