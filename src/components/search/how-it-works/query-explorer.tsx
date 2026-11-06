'use client'

import { ArrowDownWideNarrow, Search, Tag } from 'lucide-react'
import { useState } from 'react'
import { c } from './sections'

type Example = {
  q: string
  total: number
  exact: number
  /** The occasion or format decides which templates belong; other details only rank. */
  anchor: boolean
  read: [string, string, string?][]
  top: [string, string][]
  tags: [string, number][]
  why: string
}

/** Real searches captured on 3 Nov 2026 with the meaning match off (rules and labels only). */
const EXAMPLES: Example[] = [
  {
    q: '5th wedding anniversary',
    total: 130,
    exact: 4,
    anchor: true,
    read: [
      ['Occasion', 'Wedding Anniversary', 'sure'],
      ['Age', '5'],
    ],
    top: [
      ['Elegant Floral 5th Anniversary Celebration', '5'],
      ['Elegant Greenery and Gold Wedding Anniversary', '5'],
      ['Heart-Themed Five Year Wedding Anniversary', '5'],
      ['Outer Space Theme 5th Anniversary Celebration', '5'],
      ['Romantic 7th Anniversary Celebration', '7'],
      ['Elegant Floral 3-Year Anniversary Celebration', '3'],
    ],
    tags: [
      ['Romantic', 23],
      ['Heart', 21],
      ['Floral Border', 38],
      ['Glamour', 15],
      ['Greenery', 55],
      ['With photo', 40],
      ['Gold', 50],
    ],
    why: 'Clear occasion, so case C: detail chips only. Counted from wedding anniversary templates. Milestone chips are skipped because a milestone was asked.',
  },
  {
    q: 'pink dinosaur birthday',
    total: 2988,
    exact: 16,
    anchor: true,
    read: [
      ['Occasion', 'Birthday', 'sure'],
      ['Element', 'dinosaur'],
      ['Color', 'pink'],
    ],
    top: [
      ['One-a-Saurus Dinosaur Birthday', '1'],
      ['Dinosaur and Bow-Themed Third Birthday Party', '3'],
      ['Unicorns and Dinosaurs Themed Birthday', '7'],
      ['Jump Into 12 Kids Birthday', '12'],
      ['Princess Dinosaur Birthday Party', '4'],
      ['Dinosaur Theme Girl Birthday Party', '1'],
    ],
    tags: [
      ['Girl', 7],
      ['Pastel', 7],
      ['Whimsical & Cute', 9],
      ['Dinosaurs', 13],
      ['Floral & Botanical', 5],
      ['Purple', 5],
      ['Sun', 5],
    ],
    why: 'All birthday templates stay (2,988), but the 16 with both a dinosaur and pink come first. Chips are counted from those 16 best matches.',
  },
  {
    q: 'pizza',
    total: 28,
    exact: 28,
    anchor: false,
    read: [['Element', 'pizza']],
    top: [
      ['Baseball Themed Pizza Birthday Celebration', '6'],
      ['Pizza and Pasta Themed 40th Birthday', '40'],
      ['Pizza Themed Anniversary Celebration', '25'],
      ["Children's Pizza Party 9th Birthday", '9'],
      ['Bowling and Pizza Birthday Party', '9'],
      ['Pizza Party Birthday Celebration', '6'],
    ],
    tags: [
      ['Kids Birthday', 14],
      ['Parties', 12],
      ['Basil', 6],
      ['Popcorn', 5],
      ['Tomato', 5],
      ['Multicolor', 7],
    ],
    why: 'No occasion, so pizza must match: 28 templates. Only one occasion group qualified, so it shows occasions (case B) plus the Parties group to explore.',
  },
  {
    q: 'girl 1st birthday',
    total: 1099,
    exact: 374,
    anchor: true,
    read: [
      ['Occasion', 'First Birthday', 'sure'],
      ['Age', '1'],
      ['Gender', 'girl'],
    ],
    top: [
      ['Fairy Tale First Birthday Celebration', '1'],
      ['Fairy and Butterfly-Themed First Birthday', '1'],
      ['Twins Girl Baptism and 1st Birthday', '1'],
      ['Big Pink Bow First Birthday Celebration', '1'],
      ['Tropical Pool First Birthday Party', '1'],
      ['Once Upon a Time 1st Birthday', '1'],
    ],
    tags: [
      ['Woodland', 36],
      ['Safari & Jungle', 27],
      ['Balloon', 71],
      ['Bear', 26],
      ['Farm & Barnyard', 19],
      ['Pastel', 63],
      ['With photo', 61],
    ],
    why: '“birthday” + milestone 1 becomes the occasion First Birthday. Boy templates are removed, neutral ones stay. Gender chips are skipped because a gender was asked.',
  },
  {
    q: 'dinner invitation',
    total: 390,
    exact: 390,
    anchor: true,
    read: [['Format', 'dinner']],
    top: [
      ['Floral Dinner Party Gathering', '–'],
      ['Sunday Dinner Under the Stars', '–'],
      ['Spring Group Dinner Gathering', '–'],
      ['Poinsettia Themed Holiday Dinner Party', '–'],
      ['Floral Spring Dinner Party', '–'],
      ['Chic Mall and Dinner Night Celebration', '–'],
    ],
    tags: [
      ['Parties', 159],
      ['Wedding Events', 89],
      ['Holidays', 84],
      ['Birthday Events', 39],
      ['Autumn & Fall', 34],
      ['Cozy', 92],
      ['Fork', 29],
      ['Food & Sweets', 52],
    ],
    why: 'No occasion, but “dinner” is a gathering format, so it anchors. The search names no occasion, so case A: occasion groups first, then 4 detail chips.',
  },
  {
    q: 'kitty party',
    total: 123,
    exact: 110,
    anchor: true,
    read: [['Occasion', 'Kitty Party', '50% sure']],
    top: [
      ['Gemini Starry Night Kitty Party', '–'],
      ['Carnival Themed Kitty Party', '–'],
      ['Fun-Filled Kitty Party with Sunflowers', '–'],
      ['Summer Poolside Kitty Party', '–'],
      ['Ice Cream Kitty Party Celebration', '–'],
      ['Cheetah Print Themed Kitty Party', '–'],
    ],
    tags: [
      ['Glamour', 25],
      ['Teacup', 14],
      ['Tea', 8],
      ['High Heel', 11],
      ['Cup', 10],
      ['Watercolor', 37],
      ['Pink', 63],
    ],
    why: 'Under 90% sure, so the occasion is not a strict filter: 110 kitty party templates plus 13 that only mention it. The user typed the occasion name, so chips stay inside it.',
  },
]

/** Pick a real search and see how it was understood, what came first and which tags were offered. */
export function QueryExplorer() {
  const [index, setIndex] = useState(1)
  const x = EXAMPLES[index]
  return (
    <div className={c('qx')}>
      <div className={c('qpick')} role="group" aria-label="Example searches">
        {EXAMPLES.map((e, i) => (
          <button key={e.q} className={c('qbtn')} type="button" aria-pressed={i === index} onClick={() => setIndex(i)}>
            <Search className={c('i')} aria-hidden />
            {e.q}
          </button>
        ))}
      </div>
      <div className={c('qpanel')}>
        <div className={c('qbox')}>
          <h4>
            <Search className={c('i')} aria-hidden />
            Understood as
          </h4>
          <div className={c('chips')}>
            {x.read.map(([kind, value, note]) => (
              <span key={kind} className={c('chip on')}>
                <span className={c('k')}>{kind}</span>
                <b>{value}</b>
                {note && <span className={c('k')}>{note}</span>}
              </span>
            ))}
          </div>
          <div className={c('mode')}>
            {x.anchor ? (
              <>
                <span className={c('pill anchor')}>ANCHORED</span>
                <span>The occasion or format decides which templates belong. Other details only change the order.</span>
              </>
            ) : (
              <>
                <span className={c('pill must')}>MUST MATCH</span>
                <span>No occasion or format, so every detail must match.</span>
              </>
            )}
          </div>
          <div className={c('counts')}>
            <div>
              <b>{x.total.toLocaleString('en-US')}</b>
              <span>results</span>
            </div>
            <div>
              <b>{x.exact.toLocaleString('en-US')}</b>
              <span>match everything asked</span>
            </div>
          </div>
        </div>
        <div className={c('qbox')}>
          <h4>
            <ArrowDownWideNarrow className={c('i')} aria-hidden />
            Top results
          </h4>
          <ol className={c('res')}>
            {x.top.map(([name, age]) => (
              <li key={name}>
                <span>{name}</span>
                <span className={c('meta')}>milestone {age}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className={c('qbox')}>
        <h4>
          <Tag className={c('i')} aria-hidden />
          Suggested tags
        </h4>
        <div className={c('chips')}>
          {x.tags.map(([label, count]) => (
            <span key={label} className={c('chip')}>
              {label} <span className={c('ct')}>{count}</span>
            </span>
          ))}
        </div>
        <p className={c('why')}>{x.why}</p>
      </div>
      <p className={c('small muted')}>
        Captured from our search on 3 Nov 2026 with the meaning match switched off, so it reflects rules and labels
        only.
      </p>
    </div>
  )
}
