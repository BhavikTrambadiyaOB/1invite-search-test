'use client'

import { ArrowDownWideNarrow, Check, Funnel, Search, Tag } from 'lucide-react'
import { useState } from 'react'
import { c } from './sections'

type Use = 'find' | 'order' | 'filter' | 'tags'
/** y = used directly, h = only indirectly (meaning vector or a hint), '' = not used. */
type Mark = 'y' | 'h' | ''

const USES: { id: Use; label: string; Icon: typeof Search }[] = [
  { id: 'find', label: 'Find', Icon: Search },
  { id: 'order', label: 'Order', Icon: ArrowDownWideNarrow },
  { id: 'filter', label: 'Filter', Icon: Funnel },
  { id: 'tags', label: 'Tags', Icon: Tag },
]

const FIELDS: [string, string, Mark, Mark, Mark, Mark, string][] = [
  [
    'Occasion',
    'AI + confidence',
    'y',
    'y',
    'y',
    'y',
    '“birthday” shows birthday templates first; strict when 90%+ sure',
  ],
  ['Also fits', 'AI', 'y', 'y', 'y', 'y', 'A 4th-birthday template also shows for Kids Birthday'],
  ['Occasion group', 'From the occasion', '', '', 'y', 'y', 'Parties / Wedding Events chips and group filter'],
  ['Milestone', 'AI or rules', '', 'y', 'y', 'y', 'Exact milestone first, then closest; milestone chips'],
  ['Format', 'AI', 'y', 'y', 'y', 'y', '“dinner invitation” anchors on dinners; “Birthday Dinner” chip'],
  ['Type', 'AI', '', 'y', 'y', '', '“eid wishes” puts greetings first'],
  ['Gender', 'AI (from design, not names)', '', 'y', 'y', 'y', '“girl” removes boy templates, keeps neutral'],
  ['Audience', 'AI', 'h', '', '', '', 'Only inside the meaning vector today'],
  ['Language', 'Script + AI', '', 'y', 'y', 'y', '“spanish invitation” puts Spanish templates first'],
  ['Photo frame', 'App + AI', '', 'y', 'y', 'y', '“photo invitation” puts photo templates first'],
  ['Quality', 'AI (0–1)', '', 'y', '', '', '10% of the final score'],
  ['Themes', 'AI · max 3', 'y', 'y', 'y', 'y', '“safari” matches; theme chips'],
  ['Elements', 'AI · max 8', 'y', 'y', 'y', 'y', '“firetruck” matches and counts double'],
  ['Styles', 'AI', '', 'y', 'y', 'y', '“rustic” gets a small boost'],
  ['Mood', 'AI', 'y', 'y', 'y', 'y', '“fun”, “elegant” boost and chips'],
  ['Colors + shades', 'AI', 'y', 'y', 'y', 'y', '“pink” puts pink templates first'],
  ['Name', 'App', 'y', 'y', '', '', 'Strongest word layer (A)'],
  ['Card text', 'App', 'y', 'y', '', '', 'Word layer C + meaning vector'],
  ['Summary', 'AI', 'h', 'h', '', '', 'Only inside the meaning vector'],
  ['Original tags', 'App', 'h', 'h', '', '', 'Weakest word layer (D), a hint for AI'],
  ['Created date', 'App', '', 'y', '', '', 'Freshness, 15% of the score'],
  ['Free / PRO, orientation', 'App', '', '', 'y', '', '“free” in the search, sidebar filters'],
]

function Cell({ mark }: { mark: Mark }) {
  if (mark === 'y')
    return (
      <td className={c('c')}>
        <span className={c('dot')}>
          <Check className={c('i')} aria-label="yes" />
        </span>
      </td>
    )
  if (mark === 'h')
    return (
      <td className={c('c')}>
        <span className={c('dot half')} aria-label="indirectly" />
      </td>
    )
  return (
    <td className={c('c')}>
      <span className={c('nodot')} aria-label="no">
        –
      </span>
    </td>
  )
}

/** Which template field is used to find, order, filter or suggest tags. Tapping a use highlights its fields. */
export function FieldMatrix() {
  const [use, setUse] = useState<Use | null>(null)
  return (
    <>
      <div className={c('matrix-filters')} role="group" aria-label="Highlight fields by use">
        {USES.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={c('mf')}
            type="button"
            aria-pressed={use === id}
            onClick={() => setUse(use === id ? null : id)}
          >
            <Icon className={c('i')} aria-hidden />
            {label}
          </button>
        ))}
        <span className={c('small muted')} style={{ alignSelf: 'center' }}>
          Tap a use to highlight its fields.
        </span>
      </div>
      <div className={c('scroll-x')}>
        <table className={c('matrix')}>
          <thead>
            <tr>
              <th>Field</th>
              <th>Set by</th>
              {USES.map((u) => (
                <th key={u.id} className={c('c')}>
                  {u.label}
                </th>
              ))}
              <th>Example of use</th>
            </tr>
          </thead>
          <tbody>
            {FIELDS.map(([name, setBy, find, order, filter, tags, example]) => {
              const marks: Record<Use, Mark> = { find, order, filter, tags }
              return (
                <tr key={name} className={c(use && marks[use] !== 'y' ? 'dim' : '')}>
                  <td className={c('fieldname')}>{name}</td>
                  <td className={c('setby')}>{setBy}</td>
                  <Cell mark={find} />
                  <Cell mark={order} />
                  <Cell mark={filter} />
                  <Cell mark={tags} />
                  <td className={c('small')}>{example}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
