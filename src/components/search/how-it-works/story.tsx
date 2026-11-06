import { Bookmark, Footprints } from 'lucide-react'
import type { ReactNode } from 'react'
import { EXAMPLE } from './example'
import { PARTS, c } from './sections'

const t = EXAMPLE.template

/** What happens to the example search at each section. */
const STORY: Record<string, ReactNode> = {
  pipeline: (
    <>
      Template <b>#{t.id}</b> went through these five steps once, long before anyone searched. It was copied from the
      app, labelled by rules, then labelled by AI from its image, cleaned up, and turned into a meaning vector.
    </>
  ),
  fields: (
    <>
      Its labels: Occasion <b>{t.occasion}</b> ({Math.round(t.confidence * 100)}% sure), Also fits <b>{t.alsoFits}</b>,
      Milestone <b>{t.milestone}</b>, Gender <b>{t.gender}</b>, Theme <b>{t.themes.join(', ')}</b>, Elements{' '}
      <b>{t.elements.join(', ')}</b>, Colors <b>{t.colors.join(', ')}</b>, Quality score <b>{t.quality}</b>.
    </>
  ),
  vocabulary: (
    <>
      Every word the AI gave (dinosaur, bow, party hat…) was mapped to an existing label. So this template shares the
      label <b>dinosaur</b> with every other dinosaur template, and one search finds them all. Kids Birthday sits under{' '}
      <b>Birthday</b> in the occasion tree.
    </>
  ),
  'text-index': (
    <>
      Its name contains “Dinosaur” and “Birthday” in layer A, the strongest. So the typed words match at full strength:
      word match <b>1.0</b>.
    </>
  ),
  query: (
    <>
      The rule reader understands all three words, so no AI is needed: Occasion <b>Birthday</b> (sure), Element{' '}
      <b>dinosaur</b>, Color <b>pink</b>. No word is left over, so the reading counts as sure.
    </>
  ),
  'filter-or-rank': (
    <>
      An occasion is named and sure, so it <b>anchors</b> the search. All {EXAMPLE.total.toLocaleString('en-US')}{' '}
      birthday templates stay; dinosaur and pink only change the order. {EXAMPLE.bothDetails} templates have both, and
      ours is one of them.
    </>
  ),
  relevance: (
    <>
      Occasion match <b>0.90</b> (Kids Birthday is a kind of Birthday, 99% sure), attribute match <b>1.0</b> (dinosaur ✓
      pink ✓), word match <b>1.0</b>. Relevance <b>{t.relevance}</b>. This run had the meaning match off, so the mix was
      45% occasion, 25% attributes, 30% words.
    </>
  ),
  order: (
    <>
      It ties with #1, <b>{EXAMPLE.first.name}</b>, on every rung down to 6: both are in the birthday family, both have
      dinosaur and pink, and no milestone was asked. Rung 7, the near-tie score, decides.
    </>
  ),
  score: (
    <>
      0.75 × {t.relevance} + 0.15 × {t.freshness} + 0.10 × {t.quality} = <b>{t.score.toFixed(3)}</b>. Their relevance
      counts as equal (within 0.04), and {EXAMPLE.first.name} has quality score {EXAMPLE.first.quality} vs our{' '}
      {t.quality}. So ours is <b>#{EXAMPLE.rank}</b>, by a hair.
    </>
  ),
  tags: (
    <>
      The occasion is clear, so this is case C: detail chips, counted from the {EXAMPLE.bothDetails} best matches.{' '}
      {EXAMPLE.tags.map(([label, count]) => `${label} ${count}`).join(' · ')}.
    </>
  ),
  'tag-score': (
    <>
      <b>Girl</b> keeps 7 of 16 (44%), a good split. <b>Dinosaurs</b> is offered even though “dinosaur” was asked: the
      search asked for the <i>element</i> dinosaur, and the <i>theme</i> Dinosaurs is a different label.
    </>
  ),
  sidebar: (
    <>
      Tapping <b>Girl</b> sets the same Gender filter as the sidebar. Our template is labelled girl, so it stays in the
      list.
    </>
  ),
}

/** "Following pink dinosaur birthday" box at the end of a section. */
export function Story({ id }: { id: string }) {
  const body = STORY[id]
  if (!body) return null
  return (
    <div className={c('story')}>
      <div className={c('story-head')}>
        <Footprints className={c('i')} aria-hidden />
        Following “{EXAMPLE.query}” · template #{t.id}
      </div>
      <p>{body}</p>
    </div>
  )
}

const RECAPS: Record<number, string[]> = {
  1: [
    'Every template gets labels once, ahead of time, mostly by AI looking at its image.',
    'All labels come from one shared vocabulary, so different words for one thing become one label.',
    'For word matching the name counts most and the old app tags count least.',
  ],
  2: [
    'The search becomes the same kinds of labels: free rules first, AI only when unsure.',
    'Occasion named → other details only change the order. No occasion → every detail must match.',
    'Templates are removed only for clear reasons: hidden catalog, weak match, wrong occasion when sure, wrong gender.',
  ],
  3: [
    'The sorting ladder decides first: occasion closeness, asked details matched, closest milestone.',
    'The score breaks ties: 75% relevance + 15% freshness + 10% quality.',
    'Relevance = 40% occasion + 20% attributes + 15% words + 25% meaning.',
  ],
  4: [
    'Chips go from broad to specific: occasion groups → occasions → details.',
    'They are counted from the best matches only, not from every result.',
    'A good chip keeps 2–85% of them, is special to this search, and was not asked already.',
  ],
  5: [
    '1,562 real searches are replayed after each change, live vs new.',
    'Most thin results are missing templates, not search mistakes.',
    'Every number lives in one settings file, ranking.ts.',
  ],
}

/** "Remember 3 things" at the end of a part. */
export function Recap({ part }: { part: number }) {
  const info = PARTS.find((p) => p.n === part)
  const lines = RECAPS[part]
  if (!info || !lines) return null
  return (
    <div className={c('recap')}>
      <div className={c('recap-head')}>
        <Bookmark className={c('i')} aria-hidden />
        Remember 3 things about <b>{info.label}</b>
      </div>
      <ul>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}
