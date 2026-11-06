'use client'

import { Eye, EyeOff } from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { PARTS, SECTIONS, c } from './sections'

const isSection = (id: string) => SECTIONS.some((s) => s.id === id)

/**
 * Side menu, current-section highlight and focus mode (one section at a time) around the explainer content.
 * The content itself is rendered on the server and passed in as children.
 */
export function ExplainerShell({ children, className }: { children: ReactNode; className?: string }) {
  const mainRef = useRef<HTMLElement>(null)
  const [focus, setFocus] = useState(false)
  const [current, setCurrent] = useState(SECTIONS[0].id)

  // While scrolling the full page, the section in view is the current one (also after opening a #section link).
  useEffect(() => {
    if (focus || !mainRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setCurrent(entry.target.id)
      },
      { rootMargin: '-35% 0px -60% 0px' },
    )
    mainRef.current.querySelectorAll('section[id]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [focus])

  // Mark the current section and its part heading; focus mode shows only those.
  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    const part = String(SECTIONS.find((s) => s.id === current)?.part ?? '')
    main
      .querySelectorAll<HTMLElement>('section[id]')
      .forEach((el) => el.classList.toggle(c('is-active'), el.id === current))
    main
      .querySelectorAll<HTMLElement>('[data-part-head]')
      .forEach((el) => el.classList.toggle(c('is-active'), el.dataset.partHead === part))
  }, [current])

  const go = (id: string) => {
    setCurrent(id)
    window.scrollTo({ top: 0 })
    try {
      history.replaceState(null, '', `#${id}`)
    } catch {}
  }

  const toggleFocus = () => {
    const next = !focus
    setFocus(next)
    if (next) window.scrollTo({ top: 0 })
    else requestAnimationFrame(() => document.getElementById(current)?.scrollIntoView())
  }

  // In focus mode, links to a section switch the shown section instead of scrolling.
  const onClick = (event: React.MouseEvent) => {
    if (!focus) return
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
    const id = link?.getAttribute('href')?.slice(1) ?? ''
    if (!isSection(id)) return
    event.preventDefault()
    go(id)
  }

  const currentPart = SECTIONS.find((s) => s.id === current)?.part ?? 0

  return (
    <div className={`${c('hiw')} ${className ?? ''}`} data-focus={focus ? 'on' : 'off'} onClick={onClick}>
      <div className={c('frame')}>
        <aside className={c('rail')}>
          <div className={c('rail-brand')}>
            <b>Inside 1invites Search</b>
            <span>How templates are found, ordered and tagged</span>
          </div>
          <button
            className={c('focus-toggle')}
            type="button"
            aria-pressed={focus}
            title="Show one section at a time"
            onClick={toggleFocus}
          >
            {focus ? <EyeOff className={c('i')} aria-hidden /> : <Eye className={c('i')} aria-hidden />}
            <span className={c('lbl')}>{focus ? 'Show all' : 'Focus mode'}</span>
          </button>
          <YouAreHere part={currentPart} />
          <nav className={c('nav')} aria-label="Sections">
            {PARTS.map((part) => (
              <div key={part.n} className={c('nav-part')} style={{ '--pc': part.color } as CSSProperties}>
                <div className={c('nav-part-title')}>{part.verb ? `${part.n} · ${part.label}` : part.label}</div>
                {SECTIONS.filter((s) => s.part === part.n).map((s) => (
                  <a key={s.id} href={`#${s.id}`} className={c(s.id === current ? 'is-current' : '')}>
                    {s.nav}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </aside>
        <main ref={mainRef} className={c('main')}>
          {children}
        </main>
      </div>
    </div>
  )
}

const STEPS = PARTS.filter((p) => p.verb)

/** The four verbs, with the one this section belongs to lit up. */
function YouAreHere({ part }: { part: number }) {
  const step = STEPS.find((p) => p.n === part)
  return (
    <div className={c('mm')}>
      <span className={c('mm-title')}>You are here</span>
      <div className={c('mm-flow')}>
        {STEPS.map((p, i) => (
          <Fragment key={p.n}>
            {i > 0 && <span className={c('mm-arrow')}>→</span>}
            <a
              href={`#${SECTIONS.find((s) => s.part === p.n)?.id}`}
              className={c(p.n === part ? 'mm-step on' : 'mm-step')}
              style={{ '--pc': p.color } as CSSProperties}
              aria-current={p.n === part ? 'step' : undefined}
            >
              {p.label}
            </a>
          </Fragment>
        ))}
      </div>
      <p className={c('mm-note')}>{step ? step.verb : 'Search is label matching.'}</p>
    </div>
  )
}
