'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { c } from './sections'

const QUESTIONS: { step: string; color: string; q: string; a: string }[] = [
  {
    step: 'Read',
    color: 'var(--p2)',
    q: 'Why does “dinosaur” show only dinosaur templates, but “dinosaur birthday” shows every birthday template?',
    a: 'With no occasion, details must match. When an occasion is named it anchors the search, and details like dinosaur only move matching templates to the top.',
  },
  {
    step: 'Rank',
    color: 'var(--p3)',
    q: 'What three parts make the final score, and how much does each count?',
    a: '75% relevance, 15% freshness, 10% quality score. Bonuses are added on top.',
  },
  {
    step: 'Rank',
    color: 'var(--p3)',
    q: 'Someone searches “50th birthday”. Why does a 55th template come before a 20th one?',
    a: 'Milestone distance: closest number first. 55 is 5 away from 50, and 20 is 30 away.',
  },
  {
    step: 'Read',
    color: 'var(--p2)',
    q: 'When does the AI read the search, and how often for the same search?',
    a: 'Only when the free rule reader is unsure: it understood nothing, or some words were left over. The AI answer is saved, so each search costs AI at most once.',
  },
  {
    step: 'Suggest',
    color: 'var(--p4)',
    q: 'Why does “pizza” offer Parties as a chip, but “kitty party” offers Teacup and Pink?',
    a: '“pizza” names no occasion, so chips start broad (occasion groups and occasions). “kitty party” names a clear occasion, so chips go straight to details inside it.',
  },
  {
    step: 'Rank',
    color: 'var(--p3)',
    q: 'A template has the right occasion, but the AI was only 50% sure when labelling it. What changes?',
    a: 'Its occasion match is multiplied by 0.6 + 0.4 × 0.5 = 0.8, so it ranks a bit lower than a template the AI was sure about.',
  },
  {
    step: 'Label',
    color: 'var(--p1)',
    q: 'A word appears in a template’s name and in its old app tags. Which counts more?',
    a: 'The name: weight 1.0, against 0.1 for the old tags. The old tags are often wrong.',
  },
  {
    step: 'Rank',
    color: 'var(--p3)',
    q: 'Why was our dinosaur template #2 for “pink dinosaur birthday”, not #1?',
    a: 'It tied with One-a-Saurus on every rung of the ladder and their relevance counted as equal. One-a-Saurus has a slightly better quality score (0.88 vs 0.87).',
  },
]

/** Questions with hidden answers: answering from memory first is what makes it stick. */
export function TestYourself() {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const allOpen = open.size === QUESTIONS.length
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  return (
    <div className={c('quiz')}>
      <div className={c('quiz-bar')}>
        <span className={c('small muted')}>
          Answer in your head first, then check. {open.size} of {QUESTIONS.length} answers shown.
        </span>
        <button
          type="button"
          className={c('mf')}
          onClick={() => setOpen(allOpen ? new Set() : new Set(QUESTIONS.map((_, i) => i)))}
        >
          {allOpen ? 'Hide all answers' : 'Show all answers'}
        </button>
      </div>
      <ol className={c('quiz-list')}>
        {QUESTIONS.map((item, i) => {
          const shown = open.has(i)
          return (
            <li key={item.q} className={c('quiz-item')} style={{ '--pc': item.color } as CSSProperties}>
              <span className={c('quiz-step')}>{item.step}</span>
              <p className={c('quiz-q')}>{item.q}</p>
              {shown && <p className={c('quiz-a')}>{item.a}</p>}
              <button type="button" className={c('quiz-btn')} aria-expanded={shown} onClick={() => toggle(i)}>
                {shown ? <EyeOff className={c('i')} aria-hidden /> : <Eye className={c('i')} aria-hidden />}
                {shown ? 'Hide answer' : 'Show answer'}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
