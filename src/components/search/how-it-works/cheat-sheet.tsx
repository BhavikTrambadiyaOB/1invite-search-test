import type { CSSProperties } from 'react'
import { c } from './sections'

const LINES: { verb: string; color: string; text: string }[] = [
  {
    verb: 'Label',
    color: 'var(--p1)',
    text: 'Every template gets labels once, ahead of time: AI reads its image, name and printed text.',
  },
  {
    verb: 'Label',
    color: 'var(--p1)',
    text: 'All labels come from one shared vocabulary, so “bumble bee” and “bumblebee” are one label.',
  },
  {
    verb: 'Read',
    color: 'var(--p2)',
    text: 'The search becomes the same labels: free rules first, AI only when unsure, saved per search.',
  },
  {
    verb: 'Read',
    color: 'var(--p2)',
    text: 'An occasion in the search anchors it: other details only change the order. No occasion: every detail must match.',
  },
  {
    verb: 'Rank',
    color: 'var(--p3)',
    text: 'The sorting ladder decides first: occasion closeness → asked details matched (elements count double) → closest milestone.',
  },
  {
    verb: 'Rank',
    color: 'var(--p3)',
    text: 'The score breaks ties: 75% relevance + 15% freshness + 10% quality score.',
  },
  {
    verb: 'Rank',
    color: 'var(--p3)',
    text: 'Relevance = 40% occasion match + 20% attribute match + 15% word match + 25% meaning match.',
  },
  {
    verb: 'Suggest',
    color: 'var(--p4)',
    text: 'Chips go from broad to specific: occasion groups → occasions → details.',
  },
  {
    verb: 'Suggest',
    color: 'var(--p4)',
    text: 'Chips are counted from the best matches; a good chip keeps 2–85% of them and was not asked already.',
  },
  {
    verb: 'Improve',
    color: 'var(--p5)',
    text: '1,562 real searches are replayed after each change, and every number lives in ranking.ts.',
  },
]

/** The whole system in ten lines, grouped by the four verbs. */
export function CheatSheet() {
  return (
    <ol className={c('cheat')}>
      {LINES.map((line) => (
        <li key={line.text} style={{ '--pc': line.color } as CSSProperties}>
          <span className={c('cheat-verb')}>{line.verb}</span>
          <span>{line.text}</span>
        </li>
      ))}
    </ol>
  )
}
