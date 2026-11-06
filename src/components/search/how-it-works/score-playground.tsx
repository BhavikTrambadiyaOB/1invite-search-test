'use client'

import { useState } from 'react'
import { RANKING } from '@/lib/search/ranking'
import { c } from './sections'

const { weights, freshnessHalfLifeDays: HALF_LIFE, milestoneBonus, alsoOccasionBonus } = RANKING
/** Highest possible score with both bonuses, so bars share one scale. */
const MAX_SCORE = 1 + milestoneBonus + alsoOccasionBonus
const freshness = (days: number) => Math.pow(0.5, days / HALF_LIFE)

/** Sliders for one template's relevance, age and quality, showing its final score and the freshness curve. */
export function ScorePlayground() {
  const [relevance, setRelevance] = useState(0.8)
  const [days, setDays] = useState(180)
  const [quality, setQuality] = useState(0.82)
  const [exactAge, setExactAge] = useState(true)
  const [alsoFits, setAlsoFits] = useState(false)

  const fresh = freshness(days)
  const bonus = (exactAge ? milestoneBonus : 0) + (alsoFits ? alsoOccasionBonus : 0)
  const parts = [
    { value: relevance * weights.relevance, color: 'var(--p3)' },
    { value: fresh * weights.freshness, color: 'var(--p1)' },
    { value: quality * weights.quality, color: 'var(--p2)' },
    { value: bonus, color: 'var(--p4)' },
  ]
  const total = parts.reduce((sum, p) => sum + p.value, 0)

  return (
    <>
      <div className={c('play')}>
        <div className={c('ctl')}>
          <label htmlFor="hiw-relevance">
            <span className={c('row')}>
              <span>Relevance</span>
              <output>{relevance.toFixed(2)}</output>
            </span>
            <input
              id="hiw-relevance"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={relevance}
              onChange={(e) => setRelevance(Number(e.target.value))}
            />
          </label>
          <label htmlFor="hiw-age">
            <span className={c('row')}>
              <span>Template age</span>
              <output>{days} days</output>
            </span>
            <input
              id="hiw-age"
              type="range"
              min={0}
              max={2000}
              step={10}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </label>
          <label htmlFor="hiw-quality">
            <span className={c('row')}>
              <span>Quality (set by AI)</span>
              <output>{quality.toFixed(2)}</output>
            </span>
            <input
              id="hiw-quality"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
            />
          </label>
          <label className={c('check')} htmlFor="hiw-exact">
            <input id="hiw-exact" type="checkbox" checked={exactAge} onChange={(e) => setExactAge(e.target.checked)} />
            <span>Exact asked milestone (+{milestoneBonus})</span>
          </label>
          <label className={c('check')} htmlFor="hiw-also">
            <input id="hiw-also" type="checkbox" checked={alsoFits} onChange={(e) => setAlsoFits(e.target.checked)} />
            <span>Also fits a second named occasion (+{alsoOccasionBonus})</span>
          </label>
        </div>
        <div className={c('result')}>
          <span className={c('eyebrow')}>Score</span>
          <span className={c('total')}>{total.toFixed(2)}</span>
          <div className={c('stack')} aria-label="Score parts">
            {parts.map((p, i) =>
              p.value > 0.0001 ? (
                <div
                  key={i}
                  style={{ width: `${(p.value / MAX_SCORE) * 100}%`, background: p.color }}
                  title={p.value.toFixed(3)}
                >
                  {p.value / MAX_SCORE > 0.08 ? p.value.toFixed(2) : ''}
                </div>
              ) : null,
            )}
            <div style={{ flex: 1, background: 'var(--surface-2)' }} />
          </div>
          <div className={c('stack-legend')}>
            <span>
              <i style={{ background: 'var(--p3)' }} />
              Relevance × {weights.relevance}
            </span>
            <span>
              <i style={{ background: 'var(--p1)' }} />
              Freshness × {weights.freshness}
            </span>
            <span>
              <i style={{ background: 'var(--p2)' }} />
              Quality × {weights.quality}
            </span>
            <span>
              <i style={{ background: 'var(--p4)' }} />
              Bonus
            </span>
          </div>
          <span className={c('eq')}>
            {weights.relevance} × {relevance.toFixed(2)} + {weights.freshness} × {fresh.toFixed(2)} (freshness) +{' '}
            {weights.quality} × {quality.toFixed(2)} + {bonus.toFixed(2)} = {total.toFixed(3)}
          </span>
        </div>
      </div>
      <div>
        <h4 style={{ fontSize: '1rem', marginBottom: 8 }}>Freshness over time</h4>
        <FreshnessChart days={days} />
      </div>
    </>
  )
}

function FreshnessChart({ days }: { days: number }) {
  const W = 640,
    H = 210,
    L = 44,
    R = 16,
    T = 12,
    B = 34,
    MAX_DAYS = 2000
  const x = (d: number) => L + (d / MAX_DAYS) * (W - L - R)
  const y = (v: number) => T + (1 - v) * (H - T - B)
  const points: string[] = []
  for (let d = 0; d <= MAX_DAYS; d += 20) points.push(`${x(d).toFixed(1)},${y(freshness(d)).toFixed(1)}`)
  const area = `M${x(0)},${y(0)} L${points.join(' L')} L${x(MAX_DAYS)},${y(0)} Z`
  const shown = Math.min(days, MAX_DAYS)
  return (
    <svg
      className={c('chart')}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Freshness falls by half every ${HALF_LIFE} days`}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line className={c('grid')} x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end">
            {v.toFixed(2)}
          </text>
        </g>
      ))}
      {[0, HALF_LIFE, HALF_LIFE * 2, HALF_LIFE * 3].map((d) => (
        <text key={d} x={x(d)} y={H - 12} textAnchor="middle">
          {d === 0 ? 'new' : `${d} d`}
        </text>
      ))}
      <text x={x(HALF_LIFE)} y={y(0.5) - 10} textAnchor="start">
        ½ at {HALF_LIFE} days
      </text>
      <path className={c('area')} d={area} />
      <polyline className={c('curve')} points={points.join(' ')} />
      <circle className={c('mark')} cx={x(HALF_LIFE)} cy={y(0.5)} r={4} />
      <circle className={c('mark')} cx={x(shown)} cy={y(freshness(shown))} r={7} />
    </svg>
  )
}
