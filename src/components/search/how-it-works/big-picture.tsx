import Image from 'next/image'
import { ArrowDown, Check, RefreshCw, Search } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { EXAMPLE } from './example'
import { c } from './sections'

const t = EXAMPLE.template

function Lane({
  n,
  verb,
  when,
  color,
  href,
  children,
}: {
  n: number
  verb: string
  when: string
  color: string
  href: string
  children: ReactNode
}) {
  return (
    <div className={c('bp-box')} style={{ '--pc': color } as CSSProperties}>
      <a href={href} className={c('bp-head')}>
        <span className={c('bp-n')}>{n}</span>
        <span className={c('bp-verb')}>{verb}</span>
        <span className={c('bp-when')}>{when}</span>
      </a>
      {children}
    </div>
  )
}

function Label({ k, v, on }: { k: string; v: string; on?: boolean }) {
  return (
    <span className={c(on ? 'chip on' : 'chip')}>
      <span className={c('k')}>{k}</span>
      <b>{v}</b>
    </span>
  )
}

/** The whole system in one picture: two lanes of labels meet at Rank, and Suggest feeds back into Read. */
export function BigPicture() {
  return (
    <div className={c('bp')}>
      <div className={c('bp-lanes')}>
        <Lane n={1} verb="Label" when="ahead of time, once per template" color="var(--p1)" href="#pipeline">
          <div className={c('bp-template')}>
            <span className={c('bp-thumb')}>
              <Image src={t.previewUrl} alt={`${t.name} template`} fill sizes="72px" className={c('preview-img')} />
            </span>
            <span className={c('small')}>
              <b>Template #{t.id}</b>
              <br />
              {t.name}
            </span>
          </div>
          <ArrowDown className={c('i bp-down')} aria-hidden />
          <div className={c('chips')}>
            <Label k="Occasion" v={t.occasion} on />
            <Label k="Also fits" v={t.alsoFits} />
            <Label k="Milestone" v={String(t.milestone)} />
            <Label k="Gender" v={t.gender} />
            <Label k="Theme" v={t.themes.join(', ')} />
            <Label k="Elements" v={`${t.elements.slice(0, 3).join(', ')}…`} on />
            <Label k="Colors" v={`${t.colors.slice(0, 3).join(', ')}…`} on />
            <Label k="Quality" v={String(t.quality)} />
          </div>
        </Lane>
        <Lane n={2} verb="Read" when="every search, instantly" color="var(--p2)" href="#query">
          <div className={c('bp-query')}>
            <Search className={c('i')} aria-hidden />
            {EXAMPLE.query}
          </div>
          <ArrowDown className={c('i bp-down')} aria-hidden />
          <div className={c('chips')}>
            <Label k="Occasion" v="Birthday" on />
            <Label k="Element" v="dinosaur" on />
            <Label k="Color" v="pink" on />
          </div>
          <p className={c('small muted')}>Same kinds of labels as the template. That is the whole trick.</p>
        </Lane>
      </div>

      <svg className={c('bp-merge')} viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden>
        <path d="M25 0 L50 10 M75 0 L50 10" />
      </svg>

      <Lane n={3} verb="Rank" when="compare the two sets of labels" color="var(--p3)" href="#relevance">
        <div className={c('scroll-x')}>
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Search asks</th>
                <th>Template has</th>
                <th>Match</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={c('fieldname')}>Occasion</td>
                <td>Birthday</td>
                <td>Kids Birthday (a kind of Birthday)</td>
                <td>
                  <Check className={c('i ok')} aria-label="yes" /> 0.90
                </td>
              </tr>
              <tr>
                <td className={c('fieldname')}>Element</td>
                <td>dinosaur</td>
                <td>dinosaur</td>
                <td>
                  <Check className={c('i ok')} aria-label="yes" />
                </td>
              </tr>
              <tr>
                <td className={c('fieldname')}>Color</td>
                <td>pink</td>
                <td>pink</td>
                <td>
                  <Check className={c('i ok')} aria-label="yes" />
                </td>
              </tr>
              <tr>
                <td className={c('fieldname')}>Words</td>
                <td>pink dinosaur birthday</td>
                <td>“Dinosaur … Birthday” in its name</td>
                <td>
                  <Check className={c('i ok')} aria-label="yes" /> 1.0
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className={c('bp-result')}>
          <div>
            <b>{t.relevance.toFixed(2)}</b>
            <span>relevance</span>
          </div>
          <span className={c('bp-arrow')}>→</span>
          <div>
            <b>{t.score.toFixed(2)}</b>
            <span>final score</span>
          </div>
          <span className={c('bp-arrow')}>→</span>
          <div>
            <b>#{EXAMPLE.rank}</b>
            <span>of {EXAMPLE.total.toLocaleString('en-US')}</span>
          </div>
        </div>
      </Lane>

      <ArrowDown className={c('i bp-center-arrow')} aria-hidden />

      <Lane n={4} verb="Suggest" when="offer the next label to tap" color="var(--p4)" href="#tags">
        <div className={c('chips')}>
          {EXAMPLE.tags.slice(0, 5).map(([label, count]) => (
            <span key={label} className={c('chip')}>
              {label} <span className={c('ct')}>{count}</span>
            </span>
          ))}
        </div>
        <p className={c('bp-loop')}>
          <RefreshCw className={c('i')} aria-hidden />
          <span>
            Each chip is a label that many of the best matches share. Tapping one adds it to the search, and the loop
            starts again at <b>Read</b>.
          </span>
        </p>
      </Lane>
    </div>
  )
}
