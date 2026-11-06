import type { CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  Check,
  CircleDollarSign,
  Clock,
  Database,
  FileImage,
  FlaskConical,
  Funnel,
  Hash,
  Info,
  Layers,
  ListChecks,
  Network,
  PanelLeft,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Target,
  TriangleAlert,
  Type,
  Waypoints,
  Zap,
} from 'lucide-react'
import { SearchNav } from '@/components/search/search-nav'
import { FieldMatrix } from './field-matrix'
import { QueryExplorer } from './query-explorer'
import { ScorePlayground } from './score-playground'
import { BigPicture } from './big-picture'
import { CheatSheet } from './cheat-sheet'
import { SECTIONS, c } from './sections'
import { Recap, Story } from './story'
import { TestYourself } from './test-yourself'

/** Preview of template #69509, the example in “What a template knows about itself”. */
const PREVIEW_URL =
  'https://d3km2tj3qc9xg5.cloudfront.net/mapi-1invites-com/original/paw-patrol-themed-5th-birthday-celebration-invitation-template-4sb04274b68851.jpg'

/** Chip "balance" for a few result shares: √share × (1 − share), highest near a third. */
const BALANCE_ROWS: [string, number][] = [0.02, 0.1, 0.33, 0.6, 0.85].map((s) => [
  `keeps ${Math.round(s * 100)}%`,
  Math.sqrt(s) * (1 - s),
])

/** Chip weight per kind, from RANKING.suggestions.groups. */
const KIND_ROWS: [string, number][] = [
  ['Occasion / group', 1.4],
  ['Age', 1.25],
  ['Theme', 1.15],
  ['Boy / girl', 1.1],
  ['Element', 1.0],
  ['Photo, language', 0.9],
  ['Mood', 0.8],
  ['Style', 0.75],
  ['Color', 0.7],
]

function Bars({ rows, max }: { rows: [string, number][]; max: number }) {
  return (
    <div className={c('bars')}>
      {rows.map(([label, value]) => (
        <div key={label} className={c('bar')}>
          <span className={c('lab')}>{label}</span>
          <span className={c('track')}>
            <span className={c('fill')} style={{ display: 'block', width: `${(value / max) * 100}%` }} />
          </span>
          <span className={c('v')}>{value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}

/** Previous / next section links, shown in focus mode. */
function Pager({ id }: { id: string }) {
  const i = SECTIONS.findIndex((s) => s.id === id)
  const prev = SECTIONS[i - 1]
  const next = SECTIONS[i + 1]
  return (
    <div className={c('pager')}>
      <a href={prev ? `#${prev.id}` : '#top'} className={c(prev ? '' : 'disabled')} aria-disabled={!prev}>
        <ArrowLeft className={c('i')} aria-hidden />
        <span>{prev ? prev.title : 'Start'}</span>
      </a>
      <a href={next ? `#${next.id}` : '#top'} className={c(next ? 'nx' : 'nx disabled')} aria-disabled={!next}>
        <span>{next ? next.title : 'End'}</span>
        <ArrowRight className={c('i')} aria-hidden />
      </a>
    </div>
  )
}

/**
 * How search works, for the product team: metadata, query reading, ordering, tags and known gaps.
 * Numbers mirror src/lib/search/ranking.ts and the catalog on 3 Nov 2026; update both together.
 */
export function Explainer() {
  return (
    <>
      <SearchNav active="how" />
      {/* ================= HERO ================= */}
      <header className={c('hero')} id="top">
        <div className={c('eyebrow')}>1invites · template search R&amp;D · how it works</div>
        <h1>Inside 1invites Search</h1>
        <p className={c('lede')}>
          <b>Search is label matching.</b> Templates get labels ahead of time, the search gets the same labels, and we
          compare them. Four verbs to remember: <b>Label → Read → Rank → Suggest</b>. This page follows one real search,
          “pink dinosaur birthday”, through every step.
        </p>

        <div className={c('journey')}>
          <a href="#pipeline" style={{ '--pc': 'var(--p1)' } as CSSProperties}>
            <span className={c('when')}>
              <Clock className={c('i')} aria-hidden />
              Ahead of time
            </span>
            <FileImage className={c('i big')} aria-hidden />
            <h3>1 · Label</h3>
            <p>Give every template labels: occasion, milestone, themes, elements, colors…</p>
          </a>
          <a href="#query" style={{ '--pc': 'var(--p2)' } as CSSProperties}>
            <span className={c('when')}>
              <Zap className={c('i')} aria-hidden />
              Each search
            </span>
            <Search className={c('i big')} aria-hidden />
            <h3>2 · Read</h3>
            <p>Turn the search into the same labels.</p>
          </a>
          <a href="#relevance" style={{ '--pc': 'var(--p3)' } as CSSProperties}>
            <span className={c('when')}>
              <Zap className={c('i')} aria-hidden />
              Each search
            </span>
            <ArrowDownWideNarrow className={c('i big')} aria-hidden />
            <h3>3 · Rank</h3>
            <p>Compare labels, best match first.</p>
          </a>
          <a href="#tags" style={{ '--pc': 'var(--p4)' } as CSSProperties}>
            <span className={c('when')}>
              <Zap className={c('i')} aria-hidden />
              Each search
            </span>
            <Tag className={c('i big')} aria-hidden />
            <h3>4 · Suggest</h3>
            <p>Offer the next label to tap.</p>
          </a>
        </div>

        <div className={c('stats')}>
          <div className={c('stat')}>
            <b>11,253</b>
            <span>templates, all labelled by AI</span>
          </div>
          <div className={c('stat')}>
            <b>320</b>
            <span>occasions (73 built-in, 247 learned)</span>
          </div>
          <div className={c('stat')}>
            <b>1,533</b>
            <span>visible objects (“elements”)</span>
          </div>
          <div className={c('stat')}>
            <b>186</b>
            <span>themes</span>
          </div>
          <div className={c('stat')}>
            <b>63 / 63</b>
            <span>automated search tests pass</span>
          </div>
        </div>

        <div className={c('legend')}>
          <span>Badges used on this page:</span>
          <span className={c('badge b-ahead')}>
            <Clock className={c('i')} aria-hidden />
            Done ahead
          </span>
          <span className={c('badge b-live')}>
            <Zap className={c('i')} aria-hidden />
            Every search
          </span>
          <span className={c('badge b-free')}>Free &amp; instant</span>
          <span className={c('badge b-ai')}>
            <Sparkles className={c('i')} aria-hidden />
            Uses AI (costs credit)
          </span>
        </div>
        <p className={c('small muted')}>
          Start with <b>The whole system</b> just below. Every section ends with a “Following pink dinosaur birthday”
          box, and every part ends with 3 things to remember. Finish with the cheat sheet and the quiz. Turn on{' '}
          <b>Focus mode</b> to read one section at a time.
        </p>
      </header>

      {/* ================= BIG PICTURE ================= */}
      <div className={c('part-head')} style={{ '--pc': 'var(--ink)' } as CSSProperties} data-part-head="0">
        <span className={c('num')}>
          <Network className={c('i')} aria-hidden />
        </span>
        <div>
          <h2>The big picture</h2>
          <p>If you remember only one thing from this page, remember this picture.</p>
        </div>
      </div>

      <section className={c('sec')} id="big-picture" style={{ '--pc': 'var(--ink)' } as CSSProperties} data-part="0">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <Network className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>The whole system on one screen</h3>
            <p className={c('sub')}>One real search and one real template, through all four steps.</p>
          </div>
        </div>
        <div className={c('oneline')}>
          <span className={c('tag')}>In one line</span>
          <span>
            <b>Search is label matching.</b> Templates get labels ahead of time (<b>Label</b>). The search is turned
            into the same labels (<b>Read</b>). We compare the two and put the best match first (<b>Rank</b>). Then we
            offer the next label to tap (<b>Suggest</b>).
          </span>
        </div>
        <BigPicture />
        <Pager id="big-picture" />
      </section>

      {/* ================= PART 1 ================= */}
      <div className={c('part-head')} style={{ '--pc': 'var(--p1)' } as CSSProperties} data-part-head="1">
        <span className={c('num')}>1</span>
        <div>
          <h2>Label: give every template labels</h2>
          <p>Runs ahead of time, not during a search. Search is only as good as these labels.</p>
        </div>
      </div>

      <section className={c('sec')} id="pipeline" style={{ '--pc': 'var(--p1)' } as CSSProperties} data-part="1">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <Layers className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>The metadata pipeline</h3>
            <p className={c('sub')}>Five steps turn a raw template into a searchable record.</p>
          </div>
        </div>
        <div className={c('oneline')}>
          <span className={c('tag')}>In one line</span>
          <span>
            We copy each template from the app, label it with rules, then with AI, clean the labels, and finally turn it
            into a “meaning vector”.
          </span>
        </div>

        <div className={c('flow')}>
          <div className={c('step')}>
            <span className={c('n')}>STEP 1</span>
            <span className={c('ic')}>
              <Database className={c('i')} aria-hidden />
            </span>
            <h4>Copy from app</h4>
            <p>
              Name, original tags, card text, preview, Free/PRO, portrait or landscape, featured, photo frame, created
              date.
            </p>
            <span className={c('badge b-free')}>Free</span>
            <span className={c('cmd')}>search:sync</span>
          </div>
          <div className={c('step')}>
            <span className={c('n')}>STEP 2</span>
            <span className={c('ic')}>
              <ListChecks className={c('i')} aria-hidden />
            </span>
            <h4>Rule labels</h4>
            <p>
              Matches our word lists (“baby shower”, “50th”, “pink”) in the name, text and tags. A quick first pass.
            </p>
            <span className={c('badge b-free')}>Free</span>
            <span className={c('cmd')}>search:enrich-rules</span>
          </div>
          <div className={c('step')}>
            <span className={c('n')}>STEP 3</span>
            <span className={c('ic')}>
              <Sparkles className={c('i')} aria-hidden />
            </span>
            <h4>AI labels</h4>
            <p>
              The AI looks at the <b>cover image</b>, name, card text and old tags and fills every field. It replaces
              the rule labels.
            </p>
            <span className={c('badge b-ai')}>AI · once per template</span>
            <span className={c('cmd')}>search:enrich-ai</span>
          </div>
          <div className={c('step')}>
            <span className={c('n')}>STEP 4</span>
            <span className={c('ic')}>
              <ShieldCheck className={c('i')} aria-hidden />
            </span>
            <h4>Clean-up</h4>
            <p>
              Maps labels to fixed lists and applies house rules (shades to base colors, guests of a baby shower are
              adults…).
            </p>
            <span className={c('badge b-free')}>Free</span>
            <span className={c('cmd')}>inside step 3 + search:fix-data</span>
          </div>
          <div className={c('step')}>
            <span className={c('n')}>STEP 5</span>
            <span className={c('ic')}>
              <Waypoints className={c('i')} aria-hidden />
            </span>
            <h4>Meaning vector</h4>
            <p>
              All labels, a short AI summary and the card text become 1,536 numbers that capture what the template is
              about.
            </p>
            <span className={c('badge b-ai')}>AI · small</span>
            <span className={c('cmd')}>search:embed</span>
          </div>
        </div>

        <div className={c('io')}>
          <div>
            <h4>Goes in</h4>
            <div className={c('chips')}>
              <span className={c('chip')}>
                <FileImage className={c('i')} aria-hidden />
                Cover image
              </span>
              <span className={c('chip')}>Name</span>
              <span className={c('chip')}>Printed text</span>
              <span className={c('chip')}>Old app tags</span>
            </div>
            <p className={c('small muted')}>
              The card’s own image and text win over the old tags, which are often wrong.
            </p>
          </div>
          <div className={c('arrow')}>
            <ArrowRight className={c('i')} style={{ width: '28px', height: '28px' } as CSSProperties} aria-hidden />
          </div>
          <div>
            <h4>Comes out</h4>
            <div className={c('chips')}>
              <span className={c('chip on')}>Occasion</span>
              <span className={c('chip on')}>Also fits</span>
              <span className={c('chip on')}>Milestone</span>
              <span className={c('chip on')}>Gender</span>
              <span className={c('chip on')}>Themes</span>
              <span className={c('chip on')}>Elements</span>
              <span className={c('chip on')}>Colors</span>
              <span className={c('chip on')}>Styles</span>
              <span className={c('chip on')}>Mood</span>
              <span className={c('chip on')}>Type</span>
              <span className={c('chip on')}>Format</span>
              <span className={c('chip on')}>Language</span>
              <span className={c('chip on')}>Quality</span>
              <span className={c('chip on')}>Summary</span>
            </div>
          </div>
        </div>

        <details className={c('more')}>
          <summary>Exact rules</summary>
          <div className={c('body')}>
            <div className={c('grid2')}>
              <div className={c('card')}>
                <h4>
                  <Sparkles className={c('i')} aria-hidden />
                  What the AI returns
                </h4>
                <ul>
                  <li>Occasion, with a confidence from 0 to 1, and up to a few “also fits” occasions</li>
                  <li>
                    Up to <b>3 themes</b> (overall concept) and up to <b>8 elements</b> (visible objects)
                  </li>
                  <li>
                    Milestone printed on the card, gender, audience, format (dinner, brunch…), type (invitation,
                    greeting…)
                  </li>
                  <li>Styles, moods, colors and exact shades, languages, photo frame</li>
                  <li>A quality score from 0 to 1 and a one-to-two sentence summary</li>
                </ul>
              </div>
              <div className={c('card')}>
                <h4>
                  <ShieldCheck className={c('i')} aria-hidden />
                  Clean-up rules
                </h4>
                <ul>
                  <li>Every word is mapped to the shared vocabulary (next sections)</li>
                  <li>
                    Elements suggest themes (basketball → Sports), but a theme is kept only when several elements agree
                  </li>
                  <li>
                    Birthday + milestone 1 becomes the occasion <b>First Birthday</b>
                  </li>
                  <li>Shades map to base colors: lavender also counts as purple</li>
                  <li>Baby shower and gender reveal guests are adults</li>
                  <li>Language is read from the script (Tamil, Bengali, Arabic…)</li>
                </ul>
              </div>
            </div>
            <div className={c('note')}>
              <Info className={c('i')} aria-hidden />
              <span>
                If AI is not available, the rule labels from step 2 are the fallback, including a simple quality score:
                0.5, plus 0.3 if featured, 0.1 for a real name, 0.1 for printed text. Today all 11,253 templates have AI
                labels.
              </span>
            </div>
          </div>
        </details>
        <Story id="pipeline" />
        <Pager id="pipeline" />
      </section>

      <section className={c('sec')} id="fields" style={{ '--pc': 'var(--p1)' } as CSSProperties} data-part="1">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <FileImage className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>What a template knows about itself</h3>
            <p className={c('sub')}>A real record from our data, and how search uses each field.</p>
          </div>
        </div>
        <div className={c('oneline')}>
          <span className={c('tag')}>In one line</span>
          <span>
            Each field has a job: some help <b>find</b> cards, some decide the <b>order</b>, some <b>filter</b>, and
            some feed the <b>tag chips</b>.
          </span>
        </div>

        <div className={c('passport')}>
          <div>
            <Link href="/templates/69509" className={c('preview')} title="Open this template’s details">
              <Image
                src={PREVIEW_URL}
                alt="Paw Patrol Themed 5th Birthday Celebration Invitation template"
                fill
                sizes="220px"
                className={c('preview-img')}
              />
            </Link>
            <p className={c('mock-cap')}>
              Template <span className={c('mono')}>#69509</span>, “Paw Patrol Themed 5th Birthday Celebration
              Invitation”. Click the image for its full details.
            </p>
          </div>
          <div className={c('fieldgrid')}>
            <div className={c('fg')}>
              <span className={c('k')}>
                Occasion <span className={c('src')}>AI · 99% sure</span>
              </span>
              <span className={c('v')}>Kids Birthday</span>
            </div>
            <div className={c('fg')}>
              <span className={c('k')}>
                Also fits <span className={c('src')}>AI</span>
              </span>
              <span className={c('v')}>Birthday</span>
            </div>
            <div className={c('fg')}>
              <span className={c('k')}>
                Occasion group <span className={c('src')}>from occasion</span>
              </span>
              <span className={c('v')}>Birthday</span>
            </div>
            <div className={c('fg')}>
              <span className={c('k')}>
                Milestone <span className={c('src')}>AI</span>
              </span>
              <span className={c('v')}>5</span>
            </div>
            <div className={c('fg')}>
              <span className={c('k')}>
                Themes <span className={c('src')}>AI · max 3</span>
              </span>
              <span className={c('v')}>Paw Patrol</span>
            </div>
            <div className={c('fg')}>
              <span className={c('k')}>
                Elements <span className={c('src')}>AI · max 8</span>
              </span>
              <span className={c('v')}>dog, shield, cloud, fire hydrant</span>
            </div>
            <div className={c('fg')}>
              <span className={c('k')}>
                Styles · Mood <span className={c('src')}>AI</span>
              </span>
              <span className={c('v')}>illustrated, whimsical · fun</span>
            </div>
            <div className={c('fg')}>
              <span className={c('k')}>
                Colors <span className={c('src')}>AI</span>
              </span>
              <span className={c('v')}>blue, red, white, orange</span>
            </div>
            <div className={c('fg')}>
              <span className={c('k')}>
                Gender · Audience <span className={c('src')}>AI</span>
              </span>
              <span className={c('v')}>neutral · kids</span>
            </div>
            <div className={c('fg')}>
              <span className={c('k')}>
                Type · Format <span className={c('src')}>AI</span>
              </span>
              <span className={c('v')}>invitation · party</span>
            </div>
            <div className={c('fg')}>
              <span className={c('k')}>
                Quality <span className={c('src')}>AI</span>
              </span>
              <span className={c('v')}>0.82 of 1</span>
            </div>
            <div className={c('fg')}>
              <span className={c('k')}>
                Original tags <span className={c('src')}>app</span>
              </span>
              <span className={c('v')}>invitation, birthday, 5th, paw patrol, cartoon, celebration</span>
            </div>
          </div>
        </div>

        <FieldMatrix />
        <p className={c('small muted')}>
          <span
            className={c('dot half')}
            style={{ width: '16px', height: '16px', verticalAlign: '-3px' } as CSSProperties}
          ></span>{' '}
          dashed circle = used only indirectly (through the meaning vector, or as a hint).
        </p>
        <Story id="fields" />
        <Pager id="fields" />
      </section>

      <section className={c('sec')} id="vocabulary" style={{ '--pc': 'var(--p1)' } as CSSProperties} data-part="1">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <BookOpen className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>The shared vocabulary</h3>
            <p className={c('sub')}>Why “bumble bee”, “bumblebee” and “bumblebees” are one label.</p>
          </div>
        </div>
        <div className={c('oneline')}>
          <span className={c('tag')}>In one line</span>
          <span>
            Every word the AI returns walks down a 5-step ladder. It joins an existing label if it can, and only becomes
            a new label as a last resort.
          </span>
        </div>

        <div className={c('ladder')}>
          <div className={c('rung')}>
            <span className={c('k')}>1</span>
            <div className={c('c')}>
              <h4>Known word?</h4>
              <p>Already in the vocabulary as a label or spelling.</p>
              <span className={c('chips eg')}>
                <span className={c('chip')}>“baby shower” → Baby Shower</span>
              </span>
            </div>
          </div>
          <div className={c('rung')}>
            <span className={c('k')}>2</span>
            <div className={c('c')}>
              <h4>Known in singular form?</h4>
              <p>Plural or ID form of a known word. Saved as a new spelling.</p>
              <span className={c('chips eg')}>
                <span className={c('chip')}>“balloons” → Balloon</span>
              </span>
            </div>
          </div>
          <div className={c('rung')}>
            <span className={c('k')}>3</span>
            <div className={c('c')}>
              <h4>Near-identical spelling?</h4>
              <p>At least 80% similar, or the same letters without spaces.</p>
              <span className={c('chips eg')}>
                <span className={c('chip')}>“bumble bee” → Bumblebee</span>
              </span>
            </div>
          </div>
          <div className={c('rung')}>
            <span className={c('k')}>4</span>
            <div className={c('c')}>
              <h4>
                Same meaning? <span className={c('badge b-ai')}>AI</span>
              </h4>
              <p>
                The AI compares it with the closest existing labels. One or two letters off is checked here, because
                “moose” is not “mouse”.
              </p>
            </div>
          </div>
          <div className={c('rung new')}>
            <span className={c('k')}>5</span>
            <div className={c('c')}>
              <h4>Create a new label</h4>
              <p>
                Used right away. A new <b>occasion</b> also gets a group and a parent, so search can place it from day
                one.
              </p>
            </div>
          </div>
        </div>

        <h4 style={{ fontSize: '1rem' } as CSSProperties}>How occasions are organised</h4>
        <div className={c('tree')}>
          <div className={c('tcol')}>
            <h4>Group (11 fixed)</h4>
            <div className={c('tnode')}>
              Wedding<small>group, used for chips &amp; group filter</small>
            </div>
            <div className={c('tnode')}>Parties</div>
            <div className={c('tnode')}>Religious &amp; Cultural</div>
          </div>
          <div className={c('tcol')}>
            <h4>Parent occasion</h4>
            <div className={c('tnode')}>
              Wedding<small>a broader occasion</small>
            </div>
            <div className={c('tnode')}>Dinner Party</div>
            <div className={c('tnode')}>Indian Festivals &amp; Ceremonies</div>
          </div>
          <div className={c('tcol')}>
            <h4>Occasion</h4>
            <div className={c('tnode')}>
              Bridesmaid Proposal<small>created by AI · 31 templates</small>
            </div>
            <div className={c('tnode')}>
              Appreciation Dinner<small>created by AI · 21 templates</small>
            </div>
            <div className={c('tnode')}>Vastu Puja</div>
          </div>
        </div>
        <div className={c('grid3')}>
          <div className={c('card')}>
            <h4>
              <Target className={c('i')} aria-hidden />
              Occasion
            </h4>
            <p>
              What the card was <b>made for</b>. Exactly one. Decides ranking.
            </p>
          </div>
          <div className={c('card')}>
            <h4>
              <Layers className={c('i')} aria-hidden />
              Also fits
            </h4>
            <p>
              Other occasions it <b>works for</b> as it is. Ranks just below cards made for that occasion. Can cross
              groups.
            </p>
          </div>
          <div className={c('card')}>
            <h4>
              <Network className={c('i')} aria-hidden />
              Group
            </h4>
            <p>
              The <b>group</b>. Read from the occasion, not stored per card. Used when the search names no occasion.
            </p>
          </div>
        </div>

        <details className={c('more')}>
          <summary>Exact rules</summary>
          <div className={c('body')}>
            <div className={c('scroll-x')}>
              <table>
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th className={c('num')}>Total</th>
                    <th className={c('num')}>Built-in</th>
                    <th className={c('num')}>Learned by AI</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Occasions</td>
                    <td className={c('num')}>320</td>
                    <td className={c('num')}>73</td>
                    <td className={c('num')}>247</td>
                  </tr>
                  <tr>
                    <td>Elements (objects)</td>
                    <td className={c('num')}>1,533</td>
                    <td className={c('num')}>179</td>
                    <td className={c('num')}>1,354</td>
                  </tr>
                  <tr>
                    <td>Themes</td>
                    <td className={c('num')}>186</td>
                    <td className={c('num')}>39</td>
                    <td className={c('num')}>147</td>
                  </tr>
                  <tr>
                    <td>Styles</td>
                    <td className={c('num')}>27</td>
                    <td className={c('num')}>14</td>
                    <td className={c('num')}>13</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul
              className={c('small muted')}
              style={
                {
                  margin: '0',
                  paddingLeft: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                } as CSSProperties
              }
            >
              <li>
                Colors, moods, languages, genders, types and formats are <b>fixed lists</b>. The AI must pick from them.
              </li>
              <li>
                Words reserved for something else are refused as labels: a number is a milestone, “party” alone is too
                broad to be an occasion, a mood word is not a theme, and one word means one kind (“photo” is a style, so
                not also an element).
              </li>
              <li>For a known occasion, the AI’s group and parent are ignored. The stored ones are used.</li>
            </ul>
          </div>
        </details>
        <Story id="vocabulary" />
        <Pager id="vocabulary" />
      </section>

      <section className={c('sec')} id="text-index" style={{ '--pc': 'var(--p1)' } as CSSProperties} data-part="1">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <Type className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>The word index</h3>
            <p className={c('sub')}>How typed words are matched, and why the name counts most.</p>
          </div>
        </div>
        <div className={c('oneline')}>
          <span className={c('tag')}>In one line</span>
          <span>
            Each template has a word index in four layers. A word found in the <b>name</b> counts 10× more than the same
            word in the old app tags.
          </span>
        </div>
        <div className={c('bars')}>
          <div className={c('bar')}>
            <span className={c('lab')}>
              <b>A · Name</b>
              <small>written by the design team</small>
            </span>
            <span className={c('track')}>
              <span className={c('fill')} style={{ width: '100%', display: 'block' } as CSSProperties}></span>
            </span>
            <span className={c('v')}>1.0</span>
          </div>
          <div className={c('bar')}>
            <span className={c('lab')}>
              <b>B · Occasion, themes, elements</b>
              <small>AI labels</small>
            </span>
            <span className={c('track')}>
              <span className={c('fill')} style={{ width: '40%', display: 'block' } as CSSProperties}></span>
            </span>
            <span className={c('v')}>0.4</span>
          </div>
          <div className={c('bar')}>
            <span className={c('lab')}>
              <b>C · Card text, shades, mood</b>
              <small>printed words + AI</small>
            </span>
            <span className={c('track')}>
              <span className={c('fill')} style={{ width: '20%', display: 'block' } as CSSProperties}></span>
            </span>
            <span className={c('v')}>0.2</span>
          </div>
          <div className={c('bar')}>
            <span className={c('lab')}>
              <b>D · Original app tags</b>
              <small>often wrong</small>
            </span>
            <span className={c('track')}>
              <span className={c('fill')} style={{ width: '10%', display: 'block' } as CSSProperties}></span>
            </span>
            <span className={c('v')}>0.1</span>
          </div>
        </div>
        <div className={c('grid2')}>
          <div className={c('card')}>
            <h4>
              <Type className={c('i')} aria-hidden />
              Word match
            </h4>
            <p>
              Exact words, with word stems and accents removed (“cumpleaños” = “cumpleanos”). It runs inside the
              database (PostgreSQL full-text search).
            </p>
          </div>
          <div className={c('card')}>
            <h4>
              <Waypoints className={c('i')} aria-hidden />
              Meaning match
            </h4>
            <p>
              The query also becomes a meaning vector. Designs “close in meaning” are found even with different words:
              “farewell for a colleague” finds an office farewell lunch.
            </p>
          </div>
        </div>
        <Story id="text-index" />
        <Recap part={1} />
        <Pager id="text-index" />
      </section>

      {/* ================= PART 2 ================= */}
      <div className={c('part-head')} style={{ '--pc': 'var(--p2)' } as CSSProperties} data-part-head="2">
        <span className={c('num')}>2</span>
        <div>
          <h2>Read: turn the search into the same labels</h2>
          <p>Runs on every search. Turns typed words into the same labels the templates have.</p>
        </div>
      </div>

      <section className={c('sec')} id="query" style={{ '--pc': 'var(--p2)' } as CSSProperties} data-part="2">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <Search className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>Reading the query</h3>
            <p className={c('sub')}>Rules first, AI only when the rules are unsure.</p>
          </div>
        </div>
        <div className={c('oneline')}>
          <span className={c('tag')}>In one line</span>
          <span>
            A free rule reader handles most searches instantly. Only unclear searches go to the AI, and its answer is
            saved, so each query costs AI at most once.
          </span>
        </div>

        <div className={c('flow')}>
          <div className={c('step')}>
            <span className={c('n')}>1</span>
            <span className={c('ic')}>
              <ShieldCheck className={c('i')} aria-hidden />
            </span>
            <h4>Clean</h4>
            <p>
              Remove pasted chat prefixes, dates and filler (“template”, “invite”). Fix swapped letters: “brithday”.
            </p>
            <span className={c('badge b-free')}>Free</span>
          </div>
          <div className={c('step')}>
            <span className={c('n')}>2</span>
            <span className={c('ic')}>
              <ListChecks className={c('i')} aria-hidden />
            </span>
            <h4>Rule reader</h4>
            <p>Finds occasion, milestone, gender, themes, elements, colors, format, type, language, photo, free.</p>
            <span className={c('badge b-free')}>Free</span>
          </div>
          <div className={c('step')}>
            <span className={c('n')}>3</span>
            <span className={c('ic')}>
              <Check className={c('i')} aria-hidden />
            </span>
            <h4>Sure?</h4>
            <p>
              Sure = it understood something <b>and</b> no word was left over. If sure, stop here.
            </p>
            <span className={c('badge b-free')}>Free</span>
          </div>
          <div className={c('step')}>
            <span className={c('n')}>4</span>
            <span className={c('ic')}>
              <Sparkles className={c('i')} aria-hidden />
            </span>
            <h4>Saved AI answer, or ask AI</h4>
            <p>Look up the saved answer for this exact query. If none, ask the AI and save its answer.</p>
            <span className={c('badge b-ai')}>AI · once per query</span>
          </div>
          <div className={c('step')}>
            <span className={c('n')}>5</span>
            <span className={c('ic')}>
              <Waypoints className={c('i')} aria-hidden />
            </span>
            <h4>Meaning vector</h4>
            <p>The query text also becomes a meaning vector, for the meaning match.</p>
            <span className={c('badge b-ai')}>AI · tiny</span>
          </div>
        </div>

        <h4 style={{ fontSize: '1rem' } as CSSProperties}>Try real searches</h4>
        <QueryExplorer />

        <details className={c('more')}>
          <summary>Exact rules</summary>
          <div className={c('body')}>
            <ul
              className={c('small')}
              style={
                {
                  margin: '0',
                  paddingLeft: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                } as CSSProperties
              }
            >
              <li>
                The rule reader uses the built-in word lists <b>plus</b> every label the AI has learned, so a new
                occasion like “Bridesmaid Proposal” is understood the day it is created.
              </li>
              <li>
                A milestone is read from “5th”, “fifth”, “5 year”, “turning 5”, “birthday 40” and named milestones
                (“golden anniversary” = 50). Dates like “October 31st” are not milestones.
              </li>
              <li>
                The AI often guesses the language a query is <i>written</i> in (“invitación de hombre” → Spanish). We
                keep a language only when the query names it (“in Spanish”) or uses another script.
              </li>
              <li>If the AI fails, search falls back to the rule reading. Search never stops because of AI.</li>
            </ul>
          </div>
        </details>
        <Story id="query" />
        <Pager id="query" />
      </section>

      <section className={c('sec')} id="filter-or-rank" style={{ '--pc': 'var(--p2)' } as CSSProperties} data-part="2">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <Funnel className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>Filter or rank?</h3>
            <p className={c('sub')}>The most important rule in the whole system.</p>
          </div>
        </div>
        <div className={c('oneline')}>
          <span className={c('tag')}>In one line</span>
          <span>
            When the search names an <b>occasion</b>, the other details only change the <b>order</b>, so nearby
            templates stay visible. With <b>no occasion</b>, details become must-haves, or “dinosaur” would list every
            template.
          </span>
        </div>

        <div className={c('grid2')}>
          <div className={c('card rank')}>
            <span className={c('verdict rank')}>Occasion named → details rank</span>
            <h4>“5th wedding anniversary”</h4>
            <p>
              All wedding anniversary templates show. The four 5th ones come first, then the closest milestones (7th,
              3rd…).
            </p>
            <div className={c('chips')}>
              <span className={c('chip on')}>
                <b>Occasion</b> Wedding Anniversary
              </span>
              <span className={c('chip')}>
                <b>Milestone 5</b> <span className={c('k')}>ranks</span>
              </span>
            </div>
          </div>
          <div className={c('card filter')}>
            <span className={c('verdict filter')}>No occasion → details filter</span>
            <h4>“pizza”</h4>
            <p>Only templates with pizza in the design, name or text: 28 of them. Everything else is left out.</p>
            <div className={c('chips')}>
              <span className={c('chip on')}>
                <b>Element</b> pizza <span className={c('k')}>must match</span>
              </span>
            </div>
          </div>
        </div>

        <h4 style={{ fontSize: '1rem' } as CSSProperties}>What removes a card completely</h4>
        <div className={c('ladder')}>
          <div className={c('rung')}>
            <span className={c('k')}>
              <Funnel className={c('i')} aria-hidden />
            </span>
            <div className={c('c')}>
              <h4>Hidden catalogs</h4>
              <p>8 catalogs (255 templates) that are not suitable are never shown, in results or in tag counts.</p>
            </div>
          </div>
          <div className={c('rung')}>
            <span className={c('k')}>
              <Target className={c('i')} aria-hidden />
            </span>
            <div className={c('c')}>
              <h4>Too weak a match</h4>
              <p>
                Relevance below <b>0.2</b> is dropped. A short list beats a wrong one.
              </p>
            </div>
          </div>
          <div className={c('rung')}>
            <span className={c('k')}>
              <Check className={c('i')} aria-hidden />
            </span>
            <div className={c('c')}>
              <h4>Clear occasion</h4>
              <p>
                When the reading is at least <b>90% sure</b> of a specific built-in occasion, only that occasion (with
                its sub-occasions, “also fits” cards and parent occasion) is shown.
              </p>
              <p className={c('eg')}>
                If that occasion has fewer than <b>24</b> templates, the page is topped up with its parent occasion and
                templates close in meaning, placed after the real matches.
              </p>
            </div>
          </div>
          <div className={c('rung')}>
            <span className={c('k')}>
              <SlidersHorizontal className={c('i')} aria-hidden />
            </span>
            <div className={c('c')}>
              <h4>Wrong gender</h4>
              <p>“girl birthday” removes boy templates but keeps neutral ones, because they can be edited.</p>
            </div>
          </div>
          <div className={c('rung')}>
            <span className={c('k')}>
              <ListChecks className={c('i')} aria-hidden />
            </span>
            <div className={c('c')}>
              <h4>No occasion: missing details</h4>
              <p>
                Themes, elements, colors and so on must match. A different printed milestone is removed (“5th” never
                shows a 50th template).
              </p>
            </div>
          </div>
          <div className={c('rung')}>
            <span className={c('k')}>
              <CircleDollarSign className={c('i')} aria-hidden />
            </span>
            <div className={c('c')}>
              <h4>“free” in the search, or a sidebar filter</h4>
              <p>Only free templates, or only what the user picked.</p>
            </div>
          </div>
        </div>

        <details className={c('more')}>
          <summary>Exact rules: the special cases</summary>
          <div className={c('body')}>
            <div className={c('grid2')}>
              <div className={c('card')}>
                <h4>Format as anchor</h4>
                <p>
                  “dinner invitation”, “lunch menu”: with no occasion, a gathering format anchors instead. It must
                  match, and other details rank. “party” alone is too broad to anchor.
                </p>
              </div>
              <div className={c('card')}>
                <h4>Weak occasion + theme</h4>
                <p>
                  “baby boss, party” reads Themed Party at 60%. A guessed (under 90%) or broad occasion (Pool Party,
                  Themed Party) next to a theme or element does not decide. The theme must match, and the occasion only
                  ranks.
                </p>
              </div>
              <div className={c('card')}>
                <h4>Learned occasions are loose</h4>
                <p>
                  Occasions the AI created match by label or wording, never as a strict filter, so a rare one (1
                  template) can’t hide every other match.
                </p>
              </div>
              <div className={c('card')}>
                <h4>Type, photo, language rank</h4>
                <p>
                  “eid wishes” shows greetings first, then other Eid templates, because an invitation is easy to reword.
                </p>
              </div>
            </div>
          </div>
        </details>
        <Story id="filter-or-rank" />
        <Recap part={2} />
        <Pager id="filter-or-rank" />
      </section>

      {/* ================= PART 3 ================= */}
      <div className={c('part-head')} style={{ '--pc': 'var(--p3)' } as CSSProperties} data-part-head="3">
        <span className={c('num')}>3</span>
        <div>
          <h2>Rank: compare labels, best match first</h2>
          <p>Every template that passed gets a relevance, then the sorting ladder decides the order.</p>
        </div>
      </div>

      <section className={c('sec')} id="relevance" style={{ '--pc': 'var(--p3)' } as CSSProperties} data-part="3">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <Target className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>Relevance: how well a template matches</h3>
            <p className={c('sub')}>The 75% part of the final score, opened up.</p>
          </div>
        </div>
        <div className={c('oneline')}>
          <span className={c('tag')}>In one line</span>
          <span>
            Relevance is a number from 0 to 1 made of four matches: <b>40% occasion match</b> +{' '}
            <b>20% attribute match</b> + <b>15% word match</b> + <b>25% meaning match</b>. It is 75% of the final score.
          </span>
        </div>

        <div className={c('mixes')} style={{ gridTemplateColumns: 'minmax(0, 1fr)' } as CSSProperties}>
          <div className={c('mix')}>
            <h4>Final score</h4>
            <div className={c('stack')} aria-label="Relevance 75%, freshness 15%, quality 10%">
              <div style={{ width: '75%', background: 'var(--p3)' } as CSSProperties}>Relevance 75%</div>
              <div style={{ width: '15%', background: 'var(--p1)' } as CSSProperties}>Freshness 15%</div>
              <div style={{ width: '10%', background: 'var(--p2)' } as CSSProperties}>Quality</div>
            </div>
            <p>
              Plus bonuses: +0.08 exact milestone, +0.35 also fits a second named occasion, +0.35 greeting for “… card”.
            </p>
          </div>
          <div className={c('mix')}>
            <h4>Relevance, opened up</h4>
            <div
              className={c('stack')}
              aria-label="Occasion match 40%, attribute match 20%, word match 15%, meaning match 25%"
            >
              <div style={{ width: '40%', background: 'var(--p3)' } as CSSProperties}>Occasion match 40%</div>
              <div style={{ width: '20%', background: 'var(--p4)' } as CSSProperties}>Attributes 20%</div>
              <div style={{ width: '15%', background: 'var(--p1)' } as CSSProperties}>Words 15%</div>
              <div style={{ width: '25%', background: 'var(--p2)' } as CSSProperties}>Meaning 25%</div>
            </div>
          </div>
        </div>

        <h4 style={{ fontSize: '1rem' } as CSSProperties}>What relevance covers</h4>
        <div className={c('scroll-x')}>
          <table>
            <thead>
              <tr>
                <th>Part</th>
                <th className={c('num')}>Share</th>
                <th>Question it answers</th>
                <th>Template fields it reads</th>
                <th>Score from 0 to 1</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={c('fieldname')}>Occasion match</td>
                <td className={c('num')}>40%</td>
                <td>Is the template’s occasion the one searched?</td>
                <td>Occasion, Also fits, occasion confidence</td>
                <td>
                  Own occasion 1.0 · sub- or parent occasion 0.9 · only in Also fits 0.75 · other 0.4, then × (0.6 + 0.4
                  × confidence)
                </td>
              </tr>
              <tr>
                <td className={c('fieldname')}>Attribute match</td>
                <td className={c('num')}>20%</td>
                <td>Of the details asked for, how many does it have?</td>
                <td>Themes, Elements, Gender, Colors, Styles, Moods, Format</td>
                <td>Matched ÷ asked. Nothing asked = 1</td>
              </tr>
              <tr>
                <td className={c('fieldname')}>Word match</td>
                <td className={c('num')}>15%</td>
                <td>Do the typed words appear in its text?</td>
                <td>
                  Name (strongest), occasion words, Themes, Elements, card text, color shades, Moods, original tags
                  (weakest)
                </td>
                <td>Database text score, scaled to about 0 to 1</td>
              </tr>
              <tr>
                <td className={c('fieldname')}>Meaning match</td>
                <td className={c('num')}>25%</td>
                <td>Is it close in meaning to the search?</td>
                <td>Meaning vector: all fields + AI summary + card text</td>
                <td>Best template for this search = 1, anything 0.25 or more below it = 0</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={c('grid2')}>
          <div className={c('card')}>
            <h4>
              <Target className={c('i')} aria-hidden />
              Occasion match
            </h4>
            <Bars
              rows={[
                ['Own occasion', 1],
                ['Sub- or parent occasion', 0.9],
                ['Only in Also fits', 0.75],
                ['Other occasion', 0.4],
              ]}
              max={1}
            />
            <p className={c('small')}>
              Then × (0.6 + 0.4 × AI confidence). A template the AI was only 50% sure about keeps 80% of its occasion
              match.
            </p>
          </div>
          <div className={c('card')}>
            <h4>
              <Info className={c('i')} aria-hidden />
              Not inside relevance
            </h4>
            <ul>
              <li>
                <b>Milestone</b>: decided by the sorting ladder (exact, then closest) and the +0.08 bonus
              </li>
              <li>
                <b>Freshness</b> and <b>Quality score</b>: the other 25% of the final score
              </li>
              <li>
                <b>Type</b>, <b>Language</b>, <b>Photo</b>: decided by the sorting ladder and filters
              </li>
            </ul>
          </div>
          <div className={c('card')}>
            <h4>
              <Waypoints className={c('i')} aria-hidden />
              Meaning match
            </h4>
            <p>
              Scored against <b>this search’s best match</b>, not a fixed bar, because some searches match strongly
              (“dinosaur birthday” peaks at 0.73) and some weakly (“boho” at 0.47). If even the best is below 0.35,
              nothing is close and meaning is ignored (“zxqv blorf”).
            </p>
          </div>
          <div className={c('card')}>
            <h4>
              <SlidersHorizontal className={c('i')} aria-hidden />
              When a part is missing
            </h4>
            <ul>
              <li>
                No occasion searched: the other three are scaled up to 100% (attributes 33%, words 25%, meaning 42%)
              </li>
              <li>Free text that maps to no fields: words 35%, name likeness 15%, meaning 50%</li>
              <li>AI switched off (no meaning): occasion 45%, attributes 25%, words 30%</li>
            </ul>
          </div>
        </div>

        <h4 style={{ fontSize: '1rem' } as CSSProperties}>Worked example: “pink dinosaur birthday”</h4>
        <p className={c('small muted')}>
          A Kids Birthday template with a dinosaur but not pink, AI 99% sure of its occasion, “dinosaur birthday” in its
          name.
        </p>
        <div className={c('scroll-x')}>
          <table>
            <thead>
              <tr>
                <th>Part</th>
                <th>Why</th>
                <th className={c('num')}>Score</th>
                <th className={c('num')}>× share</th>
                <th className={c('num')}>=</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={c('fieldname')}>Occasion match</td>
                <td>Kids Birthday is a sub-occasion of Birthday: 0.9 × (0.6 + 0.4 × 0.99)</td>
                <td className={c('num')}>0.90</td>
                <td className={c('num')}>0.40</td>
                <td className={c('num')}>0.36</td>
              </tr>
              <tr>
                <td className={c('fieldname')}>Attribute match</td>
                <td>Asked dinosaur and pink, has dinosaur only: 1 ÷ 2</td>
                <td className={c('num')}>0.50</td>
                <td className={c('num')}>0.20</td>
                <td className={c('num')}>0.10</td>
              </tr>
              <tr>
                <td className={c('fieldname')}>Word match</td>
                <td>“dinosaur birthday” is in the name (example value)</td>
                <td className={c('num')}>0.60</td>
                <td className={c('num')}>0.15</td>
                <td className={c('num')}>0.09</td>
              </tr>
              <tr>
                <td className={c('fieldname')}>Meaning match</td>
                <td>Close to the best match (example value)</td>
                <td className={c('num')}>0.80</td>
                <td className={c('num')}>0.25</td>
                <td className={c('num')}>0.20</td>
              </tr>
              <tr>
                <td className={c('fieldname')}>Relevance</td>
                <td>Sum of the four</td>
                <td className={c('num')}></td>
                <td className={c('num')}></td>
                <td className={c('num')}>
                  <b>0.75</b>
                </td>
              </tr>
              <tr>
                <td className={c('fieldname')}>In the final score</td>
                <td>0.75 × relevance, then + 15% freshness + 10% quality</td>
                <td className={c('num')}></td>
                <td className={c('num')}>0.75</td>
                <td className={c('num')}>
                  <b>0.56</b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Story id="relevance" />
        <Pager id="relevance" />
      </section>

      <section className={c('sec')} id="order" style={{ '--pc': 'var(--p3)' } as CSSProperties} data-part="3">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <ArrowDownWideNarrow className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>The sorting ladder</h3>
            <p className={c('sub')}>Like sorting a spreadsheet by 9 columns.</p>
          </div>
        </div>
        <div className={c('oneline')}>
          <span className={c('tag')}>In one line</span>
          <span>
            Designs are compared rung by rung. A lower rung only matters when two templates are tied on every rung above
            it.
          </span>
        </div>

        <div className={c('ladder')}>
          <div className={c('rung')}>
            <span className={c('k')}>1</span>
            <div className={c('c')}>
              <h4>Sidebar picks matched</h4>
              <p>Picked 2 themes in the sidebar? Designs with both come before templates with one.</p>
            </div>
          </div>
          <div className={c('rung')}>
            <span className={c('k')}>2</span>
            <div className={c('c')}>
              <h4>Occasion tier</h4>
              <p>
                <b>2</b> = the asked occasion (or its sub-occasions and “also fits”) · <b>1</b> = its parent occasion ·{' '}
                <b>0</b> = other.
              </p>
              <p className={c('eg muted')}>
                “5th wedding anniversary”: wedding anniversary templates before general anniversary templates.
              </p>
            </div>
          </div>
          <div className={c('rung')}>
            <span className={c('k')}>3</span>
            <div className={c('c')}>
              <h4>Asked details matched, elements count double</h4>
              <p>Asked “dinosaur” (element) and “5th”: dinosaur = 2 points, 5th = 1 point.</p>
            </div>
          </div>
          <div className={c('rung')}>
            <span className={c('k')}>4</span>
            <div className={c('c')}>
              <h4>Asked details matched</h4>
              <p>
                Plain count: milestone, theme, element, color, format, type, photo, language, other occasions named.
              </p>
            </div>
          </div>
          <div className={c('rung')}>
            <span className={c('k')}>5</span>
            <div className={c('c')}>
              <h4>Milestone match</h4>
              <p>Exact milestone → another milestone → no milestone printed.</p>
            </div>
          </div>
          <div className={c('rung')}>
            <span className={c('k')}>6</span>
            <div className={c('c')}>
              <h4>Milestone distance</h4>
              <p>Closest number first. For a 50th: 55th and 45th come before 20th.</p>
            </div>
          </div>
          <div className={c('rung')}>
            <span className={c('k')}>7</span>
            <div className={c('c')}>
              <h4>Near-tie score</h4>
              <p>
                Matches within <b>0.04</b> of the best one in their group count as equally good. Among them, newer and
                nicer templates go first.
              </p>
            </div>
          </div>
          <div className={c('rung')}>
            <span className={c('k')}>8</span>
            <div className={c('c')}>
              <h4>Final score</h4>
              <p>Relevance, freshness and quality combined (next section).</p>
            </div>
          </div>
          <div className={c('rung')}>
            <span className={c('k')}>9</span>
            <div className={c('c')}>
              <h4>Newest, then ID</h4>
              <p>A stable last tie-break, so the same search always gives the same order.</p>
            </div>
          </div>
        </div>

        <h4 style={{ fontSize: '1rem' } as CSSProperties}>Worked example: “5th wedding anniversary” (130 results)</h4>
        <div className={c('scroll-x')}>
          <table>
            <thead>
              <tr>
                <th className={c('num')}>#</th>
                <th>Design</th>
                <th>Milestone</th>
                <th>Decided by</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={c('num')}>1–4</td>
                <td>Elegant Floral 5th Anniversary · Greenery and Gold · Heart-Themed Five Year · Outer Space 5th</td>
                <td className={c('num')}>5</td>
                <td>Rung 4: has the asked milestone. Then rung 8 orders the four.</td>
              </tr>
              <tr>
                <td className={c('num')}>5</td>
                <td>Romantic 7th Anniversary Celebration</td>
                <td className={c('num')}>7</td>
                <td>Rung 6: 2 away from 5</td>
              </tr>
              <tr>
                <td className={c('num')}>6</td>
                <td>Elegant Floral 3-Year Anniversary Celebration</td>
                <td className={c('num')}>3</td>
                <td>Rung 6: also 2 away, rung 8 put the 7th first</td>
              </tr>
              <tr>
                <td className={c('num')}>…</td>
                <td>Other wedding anniversaries, then general anniversaries</td>
                <td className={c('num')}>…</td>
                <td>Rung 2: parent occasion comes last</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Story id="order" />
        <Pager id="order" />
      </section>

      <section className={c('sec')} id="score" style={{ '--pc': 'var(--p3)' } as CSSProperties} data-part="3">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <SlidersHorizontal className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>Final score: match, freshness, quality</h3>
            <p className={c('sub')}>Play with it: move the sliders.</p>
          </div>
        </div>
        <div className={c('oneline')}>
          <span className={c('tag')}>In one line</span>
          <span>
            Score = <b>75% relevance</b> + <b>15% freshness</b> + <b>10% quality score</b>, plus small bonuses.
            Freshness halves every 540 days (about 18 months).
          </span>
        </div>

        <ScorePlayground />

        <div className={c('grid3')}>
          <div className={c('card')}>
            <h4>+0.08 exact milestone</h4>
            <p>The template shows the asked number.</p>
          </div>
          <div className={c('card')}>
            <h4>+0.35 second occasion</h4>
            <p>
              “halloween wedding”: a wedding template that also fits Halloween. Bigger than freshness and quality
              together (0.25), so fitting both beats being newer.
            </p>
          </div>
          <div className={c('card')}>
            <h4>+0.35 “card”</h4>
            <p>“thanksgiving card”: greeting cards before invitations for holiday and greeting occasions.</p>
          </div>
        </div>
        <Story id="score" />
        <Recap part={3} />
        <Pager id="score" />
      </section>

      {/* ================= PART 4 ================= */}
      <div className={c('part-head')} style={{ '--pc': 'var(--p4)' } as CSSProperties} data-part-head="4">
        <span className={c('num')}>4</span>
        <div>
          <h2>Suggest: offer the next label to tap</h2>
          <p>The chips above the results. They guess the next step, and tapping one narrows the list.</p>
        </div>
      </div>

      <section className={c('sec')} id="tags" style={{ '--pc': 'var(--p4)' } as CSSProperties} data-part="4">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <Tag className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>Tag chips: which kind to show</h3>
            <p className={c('sub')}>Counted live from the labels. No AI and no click data.</p>
          </div>
        </div>
        <div className={c('oneline')}>
          <span className={c('tag')}>In one line</span>
          <span>
            The clearer the occasion in the search, the more specific the chips: <b>occasion groups</b> →{' '}
            <b>occasions</b> → <b>details</b>.
          </span>
        </div>

        <div className={c('cases')}>
          <div className={c('case')}>
            <span className={c('lt')}>A</span>
            <h4>No occasion named</h4>
            <span className={c('q')}>“dinner invitation”</span>
            <div className={c('chips')}>
              <span className={c('chip on')}>
                Parties <span className={c('ct')}>159</span>
              </span>
              <span className={c('chip on')}>
                Wedding Events <span className={c('ct')}>89</span>
              </span>
              <span className={c('chip on')}>
                Holidays <span className={c('ct')}>84</span>
              </span>
              <span className={c('chip on')}>
                Birthday Events <span className={c('ct')}>39</span>
              </span>
            </div>
            <p>Up to 4 occasion groups, then up to 4 detail chips.</p>
          </div>
          <div className={c('case')}>
            <span className={c('lt')}>B</span>
            <h4>Broad occasion, or a group was tapped</h4>
            <span className={c('q')}>“pizza” → tap Parties</span>
            <div className={c('chips')}>
              <span className={c('chip on')}>Food Party</span>
              <span className={c('chip on')}>Themed Party</span>
              <span className={c('chip on')}>Kitty Party</span>
              <span className={c('chip on')}>Pool &amp; Beach Party</span>
            </div>
            <p>Up to 8 specific occasions, then up to 4 detail chips.</p>
          </div>
          <div className={c('case')}>
            <span className={c('lt')}>C</span>
            <h4>Clear occasion</h4>
            <span className={c('q')}>“kitty party”</span>
            <div className={c('chips')}>
              <span className={c('chip')}>Glamour</span>
              <span className={c('chip')}>Teacup</span>
              <span className={c('chip')}>High Heel</span>
              <span className={c('chip')}>Watercolor</span>
              <span className={c('chip')}>Pink</span>
            </div>
            <p>Detail chips only: milestone, boy/girl, theme, element, photo, language, mood, style, color.</p>
          </div>
        </div>

        <h4 style={{ fontSize: '1rem' } as CSSProperties}>The step-by-step flow</h4>
        <div className={c('tagflow')}>
          <div className={c('tf-row')}>
            <span className={c('lab')}>types “pizza”</span>
            <div className={c('chips')}>
              <span className={c('chip')}>
                Kids Birthday <span className={c('ct')}>14</span>
              </span>
              <span className={c('chip tap')}>
                Parties <span className={c('ct')}>12</span>
              </span>
              <span className={c('chip')}>Basil</span>
              <span className={c('chip')}>Tomato</span>
            </div>
          </div>
          <div className={c('tf-arrow')}>
            <ArrowRight className={c('i')} aria-hidden />
            taps Parties
          </div>
          <div className={c('tf-row')}>
            <span className={c('lab')}>pizza + Parties</span>
            <div className={c('chips')}>
              <span className={c('chip')}>Food Party</span>
              <span className={c('chip')}>Themed Party</span>
              <span className={c('chip tap')}>Kitty Party</span>
              <span className={c('chip')}>Pool &amp; Beach Party</span>
            </div>
          </div>
          <div className={c('tf-arrow')}>
            <ArrowRight className={c('i')} aria-hidden />
            taps Kitty Party
          </div>
          <div className={c('tf-row')}>
            <span className={c('lab')}>narrowed</span>
            <div className={c('chips')}>
              <span className={c('chip')}>With photo</span>
              <span className={c('chip')}>Pink</span>
              <span className={c('chip')}>Floral</span>
            </div>
          </div>
        </div>

        <details className={c('more')}>
          <summary>Exact rules</summary>
          <div className={c('body')}>
            <div className={c('grid2')}>
              <div className={c('card')}>
                <h4>Which templates are counted</h4>
                <ul>
                  <li>
                    Only the <b>best matches</b>: the asked occasion plus every asked detail
                  </li>
                  <li>Fewer than 8 of them? Widen to all templates of the asked occasion</li>
                  <li>
                    With an occasion asked, only that occasion’s templates count. Filler templates never decide the
                    chips
                  </li>
                  <li>No chips at all below 8 results</li>
                </ul>
              </div>
              <div className={c('card')}>
                <h4>Families and occasions</h4>
                <ul>
                  <li>
                    Ordered by <b>fit</b> = √count × average relevance, so the likeliest comes first, not just the
                    biggest
                  </li>
                  <li>
                    A group where one occasion holds <b>90%+</b> of the templates shows that occasion directly
                  </li>
                  <li>Case A needs at least 2 groups, otherwise case B is used</li>
                  <li>Occasions need 5+ templates, or 2+ inside a tapped group</li>
                  <li>A group that shares a name with an occasion reads “Wedding Events”, so it never repeats</li>
                </ul>
              </div>
            </div>
          </div>
        </details>
        <Story id="tags" />
        <Pager id="tags" />
      </section>

      <section className={c('sec')} id="tag-score" style={{ '--pc': 'var(--p4)' } as CSSProperties} data-part="4">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <SlidersHorizontal className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>How each detail chip is scored</h3>
            <p className={c('sub')}>Three gates, then five factors multiplied together.</p>
          </div>
        </div>
        <div className={c('oneline')}>
          <span className={c('tag')}>In one line</span>
          <span>
            A good chip splits the results well, is <b>special to this search</b>, and is a useful kind of chip. Then we
            pick the best 10, a few per kind, without repeats.
          </span>
        </div>

        <div className={c('grid3')}>
          <div className={c('card')}>
            <h4>
              <Check className={c('i')} aria-hidden />
              Not asked yet
            </h4>
            <p>
              “pink birthday” never suggests Pink or Birthday, nor a parent occasion (a kids birthday is already a
              birthday).
            </p>
          </div>
          <div className={c('card')}>
            <h4>
              <Funnel className={c('i')} aria-hidden />
              Narrows usefully
            </h4>
            <p>
              Keeps at least <b>5</b> templates and <b>2%</b> of results, but not more than <b>85%</b>.
            </p>
          </div>
          <div className={c('card')}>
            <h4>
              <Layers className={c('i')} aria-hidden />
              Narrows, not widens
            </h4>
            <p>Once one milestone is picked, no second milestone: two milestones in a filter widen the list.</p>
          </div>
        </div>

        <div className={c('formula')} aria-label="Chip score formula">
          <span>chip score =</span>
          <span className={c('term')}>balance</span>
          <span className={c('op')}>×</span>
          <span className={c('term')}>√ special-here</span>
          <span className={c('op')}>×</span>
          <span className={c('term')}>kind weight</span>
          <span className={c('op')}>×</span>
          <span className={c('term')}>family boost</span>
          <span className={c('op')}>×</span>
          <span className={c('term')}>fit boost</span>
        </div>

        <div className={c('grid2')}>
          <div className={c('card')}>
            <h4>Balance: does it split well?</h4>
            <p>√share × (1 − share). Peaks when a chip keeps about a third of the results.</p>
            <Bars rows={BALANCE_ROWS} max={0.385} />
          </div>
          <div className={c('card')}>
            <h4>Kind weight</h4>
            <Bars rows={KIND_ROWS} max={1.4} />
          </div>
        </div>
        <div className={c('grid3')}>
          <div className={c('card')}>
            <h4>Special here</h4>
            <p>
              How much more common the value is in these results than in the whole catalog, capped at 6×. “Dinosaurs”
              scores high for a kids birthday, “Greenery” low.
            </p>
          </div>
          <div className={c('card')}>
            <h4>Sub-occasion boost ×1.5</h4>
            <p>A sub-occasion of the searched occasion: “First Birthday” under Birthday.</p>
          </div>
          <div className={c('card')}>
            <h4>Fit boost ×0.5–1</h4>
            <p>Occasions whose templates match the search words better rank higher: pizza → Food Party.</p>
          </div>
        </div>
        <div className={c('note')}>
          <Info className={c('i')} aria-hidden />
          <span>
            Final pick: best score first, at most 10 chips, a cap per kind (3 milestones, 3 themes, 2 colors…), and no
            two chips that say the same thing (“Bear” next to “Teddy Bear”, “1st” next to “First Birthday”). Photo frame
            and typography are never chips.
          </span>
        </div>
        <Story id="tag-score" />
        <Pager id="tag-score" />
      </section>

      <section className={c('sec')} id="sidebar" style={{ '--pc': 'var(--p4)' } as CSSProperties} data-part="4">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <PanelLeft className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>Sidebar filters</h3>
            <p className={c('sub')}>The full list of options, with counts.</p>
          </div>
        </div>
        <div className={c('oneline')}>
          <span className={c('tag')}>In one line</span>
          <span>
            Inside one filter group, choices are <b>OR</b> (pink or gold). Across groups they are <b>AND</b> (pink and
            floral). Each group’s counts ignore its own picks, so options don’t vanish when you pick one.
          </span>
        </div>
        <div className={c('grid2')}>
          <div className={c('card')}>
            <h4>
              <Layers className={c('i')} aria-hidden />
              Groups available
            </h4>
            <div className={c('chips')}>
              <span className={c('chip')}>Occasion group</span>
              <span className={c('chip')}>Occasion</span>
              <span className={c('chip')}>Milestone</span>
              <span className={c('chip')}>Themes</span>
              <span className={c('chip')}>Elements</span>
              <span className={c('chip')}>Styles</span>
              <span className={c('chip')}>Mood</span>
              <span className={c('chip')}>Colors</span>
              <span className={c('chip')}>Type</span>
              <span className={c('chip')}>Gender</span>
              <span className={c('chip')}>Language</span>
              <span className={c('chip')}>Photo</span>
              <span className={c('chip')}>Free / PRO</span>
              <span className={c('chip')}>Orientation</span>
            </div>
          </div>
          <div className={c('card')}>
            <h4>
              <Tag className={c('i')} aria-hidden />
              Chips vs sidebar
            </h4>
            <ul>
              <li>
                Chips: <b>up to 10 guesses</b>, counted from the best matches
              </li>
              <li>
                Sidebar: <b>every option</b>, counted from all results
              </li>
              <li>Tapping a chip sets the same filter as the sidebar</li>
            </ul>
          </div>
        </div>
        <Story id="sidebar" />
        <Recap part={4} />
        <Pager id="sidebar" />
      </section>

      {/* ================= PART 5 ================= */}
      <div className={c('part-head')} style={{ '--pc': 'var(--p5)' } as CSSProperties} data-part-head="5">
        <span className={c('num')}>5</span>
        <div>
          <h2>Keep improving</h2>
          <p>How we measure search, what is still weak, and every number in one table.</p>
        </div>
      </div>

      <section className={c('sec')} id="quality" style={{ '--pc': 'var(--p5)' } as CSSProperties} data-part="5">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <RefreshCw className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>The quality loop</h3>
            <p className={c('sub')}>Real queries in, measured results out, fixes back in.</p>
          </div>
        </div>
        <div className={c('oneline')}>
          <span className={c('tag')}>In one line</span>
          <span>
            We replay 1,562 real user searches against both the live app and our new search, compare them side by side,
            fix the cause, and replay again as a new phase.
          </span>
        </div>
        <div className={c('flow')} style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' } as CSSProperties}>
          <div className={c('step')}>
            <span className={c('ic')}>
              <Search className={c('i')} aria-hidden />
            </span>
            <h4>Search reports</h4>
            <p>Each real query is captured live vs new, per phase. Phase 3: 1,562 queries.</p>
          </div>
          <div className={c('step')}>
            <span className={c('ic')}>
              <TriangleAlert className={c('i')} aria-hidden />
            </span>
            <h4>Spot problems</h4>
            <p>Thin results (129 queries under 40), failed queries, odd tags.</p>
          </div>
          <div className={c('step')}>
            <span className={c('ic')}>
              <FileImage className={c('i')} aria-hidden />
            </span>
            <h4>Find the cause</h4>
            <p>
              The template details page shows every label, so we see if it’s a <b>wrong label</b> or a <b>wrong rule</b>
              .
            </p>
          </div>
          <div className={c('step')}>
            <span className={c('ic')}>
              <FlaskConical className={c('i')} aria-hidden />
            </span>
            <h4>Lock it in</h4>
            <p>Each fix becomes an automated test. 63 of 63 pass today.</p>
          </div>
        </div>
        <div className={c('note')}>
          <Info className={c('i')} aria-hidden />
          <span>
            Most thin results come from <b>missing templates</b> (resumes, logos, name tags, regional ceremonies), not
            from search. Our local copy is also behind live: <b>1,123</b> newer live templates are not tagged locally
            yet.
          </span>
        </div>
        <Pager id="quality" />
      </section>

      <section className={c('sec')} id="gaps" style={{ '--pc': 'var(--p5)' } as CSSProperties} data-part="5">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <TriangleAlert className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>Known gaps</h3>
            <p className={c('sub')}>What we know is not right yet.</p>
          </div>
        </div>
        <div className={c('oneline')}>
          <span className={c('tag')}>In one line</span>
          <span>A short, honest list of weak spots, each with a planned fix.</span>
        </div>
        <div className={c('gaps')}>
          <div className={c('gap')}>
            <TriangleAlert className={c('i')} aria-hidden />
            <div>
              <h4>“pregnancy” finds 3 templates</h4>
              <p>
                It isn’t linked to Baby Shower, Gender Reveal or Pregnancy Announcement. Plan: make it a broad search
                over those three.
              </p>
            </div>
            <span className={c('badge b-warn')}>Planned</span>
          </div>
          <div className={c('gap')}>
            <TriangleAlert className={c('i')} aria-hidden />
            <div>
              <h4>“2 yrs old paw patrol” finds 0</h4>
              <p>
                “N years old” isn’t read as a birthday, so the milestone becomes a must-have. Plan: read it as a
                birthday, so the milestone only ranks.
              </p>
            </div>
            <span className={c('badge b-warn')}>Planned</span>
          </div>
          <div className={c('gap')}>
            <TriangleAlert className={c('i')} aria-hidden />
            <div>
              <h4>Annaprashan spellings disagree (9 to 24)</h4>
              <p>The same occasion is split across two labels. Plan: one occasion with every spelling.</p>
            </div>
            <span className={c('badge b-warn')}>Planned</span>
          </div>
          <div className={c('gap')}>
            <TriangleAlert className={c('i')} aria-hidden />
            <div>
              <h4>Theme counts the same as milestone</h4>
              <p>
                Milestone text is easy to edit, a design is not. Proposal: an asked theme counts double, like elements.
              </p>
            </div>
            <span className={c('badge b-warn')}>Proposal</span>
          </div>
          <div className={c('gap')}>
            <TriangleAlert className={c('i')} aria-hidden />
            <div>
              <h4>A number alone (“75th”) returns about 3,000</h4>
              <p>With no occasion, every template without a printed milestone passes.</p>
            </div>
            <span className={c('badge b-warn')}>To do</span>
          </div>
          <div className={c('gap')}>
            <TriangleAlert className={c('i')} aria-hidden />
            <div>
              <h4>Audience is not used</h4>
              <p>Saved on every template (kids, adults, couple…) but only feeds the meaning vector.</p>
            </div>
            <span className={c('badge b-warn')}>Parked</span>
          </div>
        </div>
        <Pager id="gaps" />
      </section>

      <section className={c('sec')} id="numbers" style={{ '--pc': 'var(--p5)' } as CSSProperties} data-part="5">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <Hash className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>Every number, in one place</h3>
            <p className={c('sub')}>All of these live in one settings file, so they are easy to tune.</p>
          </div>
        </div>
        <div className={c('oneline')}>
          <span className={c('tag')}>In one line</span>
          <span>
            Changing a number here changes search everywhere. Each change is checked against the 63 tests and the search
            reports.
          </span>
        </div>
        <div className={c('scroll-x')}>
          <table>
            <thead>
              <tr>
                <th>Setting</th>
                <th className={c('num')}>Value</th>
                <th>What it does</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Score weights</td>
                <td className={c('num')}>0.75 / 0.15 / 0.10</td>
                <td>Relevance / freshness / quality</td>
              </tr>
              <tr>
                <td>Freshness half-life</td>
                <td className={c('num')}>540 days</td>
                <td>A template 18 months old has half the freshness</td>
              </tr>
              <tr>
                <td>Exact milestone bonus</td>
                <td className={c('num')}>+0.08</td>
                <td>Design shows the asked number</td>
              </tr>
              <tr>
                <td>Second-occasion bonus</td>
                <td className={c('num')}>+0.35</td>
                <td>Fits another occasion named in the search</td>
              </tr>
              <tr>
                <td>“card” greeting bonus</td>
                <td className={c('num')}>+0.35</td>
                <td>Greeting cards first for “… card”</td>
              </tr>
              <tr>
                <td>Near-tie band</td>
                <td className={c('num')}>0.04</td>
                <td>Matches this close count as equal</td>
              </tr>
              <tr>
                <td>Minimum relevance</td>
                <td className={c('num')}>0.20</td>
                <td>Below this, a template is dropped</td>
              </tr>
              <tr>
                <td>Strict occasion confidence</td>
                <td className={c('num')}>0.90</td>
                <td>Sure enough to show only that occasion</td>
              </tr>
              <tr>
                <td>Also-fits occasion score</td>
                <td className={c('num')}>0.75</td>
                <td>vs 1.0 for the template’s own occasion</td>
              </tr>
              <tr>
                <td>Thin occasion top-up</td>
                <td className={c('num')}>24</td>
                <td>Fewer templates than this → fill the page</td>
              </tr>
              <tr>
                <td>Relevance mix (structured)</td>
                <td className={c('num')}>40 / 20 / 15 / 25</td>
                <td>Occasion / details / words / meaning, in %</td>
              </tr>
              <tr>
                <td>Relevance mix (free text)</td>
                <td className={c('num')}>35 / 15 / 50</td>
                <td>Words / name likeness / meaning, in %</td>
              </tr>
              <tr>
                <td>Meaning window</td>
                <td className={c('num')}>0.25</td>
                <td>Best match = 1, this far below = 0</td>
              </tr>
              <tr>
                <td>Meaning minimum</td>
                <td className={c('num')}>0.35</td>
                <td>Best match below this → meaning ignored</td>
              </tr>
              <tr>
                <td>Element priority</td>
                <td className={c('num')}>+1</td>
                <td>An asked element counts as 2 details</td>
              </tr>
              <tr>
                <td>Page size</td>
                <td className={c('num')}>24</td>
                <td>Designs per page</td>
              </tr>
              <tr>
                <td>Chips: max</td>
                <td className={c('num')}>10</td>
                <td>Occasion chips: up to 8</td>
              </tr>
              <tr>
                <td>Chips: min results</td>
                <td className={c('num')}>8</td>
                <td>No chips below this</td>
              </tr>
              <tr>
                <td>Chips: min templates</td>
                <td className={c('num')}>5 (2 in a group)</td>
                <td>A chip must keep this many</td>
              </tr>
              <tr>
                <td>Chips: share range</td>
                <td className={c('num')}>2%–85%</td>
                <td>Too small or too big is useless</td>
              </tr>
              <tr>
                <td>Chips: special-here cap</td>
                <td className={c('num')}>6×</td>
                <td>Limits rare-value boost</td>
              </tr>
              <tr>
                <td>Chips: one-occasion group</td>
                <td className={c('num')}>90%</td>
                <td>Show the occasion instead of the group</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Pager id="numbers" />
      </section>

      <section className={c('sec')} id="glossary" style={{ '--pc': 'var(--p5)' } as CSSProperties} data-part="5">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <BookOpen className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>Glossary</h3>
            <p className={c('sub')}>Terms used on this page.</p>
          </div>
        </div>
        <div className={c('oneline')}>
          <span className={c('tag')}>In one line</span>
          <span>Plain meanings for the technical words.</span>
        </div>
        <dl className={c('gloss')}>
          <div>
            <dt>Template</dt>
            <dd>One invitation or card in the 1invites catalog.</dd>
          </div>
          <div>
            <dt>Occasion (occasion)</dt>
            <dd>What a template is for: Kids Birthday, Kitty Party, Wedding Anniversary.</dd>
          </div>
          <div>
            <dt>Element (asset)</dt>
            <dd>A visible object in the design: dog, balloon, teacup.</dd>
          </div>
          <div>
            <dt>Theme</dt>
            <dd>The overall concept: Safari, Paw Patrol, Floral.</dd>
          </div>
          <div>
            <dt>Vocabulary</dt>
            <dd>The shared list of labels and their spellings, so different words for one thing match.</dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>How sure the AI or rules are about an occasion, from 0 to 1.</dd>
          </div>
          <div>
            <dt>Meaning vector (embedding)</dt>
            <dd>
              A list of 1,536 numbers describing what a text is about. Similar meanings give close vectors. Made with
              OpenAI’s text-embedding-3-large.
            </dd>
          </div>
          <div>
            <dt>Cosine similarity</dt>
            <dd>How close two meaning vectors are: 1 = same meaning.</dd>
          </div>
          <div>
            <dt>Word index</dt>
            <dd>PostgreSQL full-text search. Fast exact-word matching with weights per layer.</dd>
          </div>
          <div>
            <dt>Relevance</dt>
            <dd>0 to 1: how well one template matches this search.</dd>
          </div>
          <div>
            <dt>Tier</dt>
            <dd>Occasion closeness: asked occasion, its parent, or other.</dd>
          </div>
          <div>
            <dt>Anchor</dt>
            <dd>
              The part of the search that decides which templates belong (usually the occasion). The rest only ranks.
            </dd>
          </div>
          <div>
            <dt>Chip / tag</dt>
            <dd>A one-tap suggestion above the results.</dd>
          </div>
          <div>
            <dt>Facet</dt>
            <dd>A sidebar filter group with counts per option.</dd>
          </div>
          <div>
            <dt>Mastra</dt>
            <dd>The framework that runs our AI steps (labelling and query reading).</dd>
          </div>
          <div>
            <dt>Phase</dt>
            <dd>One full replay of the real search queries, to compare before and after a change.</dd>
          </div>
        </dl>
        <Recap part={5} />
        <Pager id="glossary" />
      </section>

      {/* ================= REMEMBER ================= */}
      <div className={c('part-head')} style={{ '--pc': 'var(--ink)' } as CSSProperties} data-part-head="6">
        <span className={c('num')}>
          <Bookmark className={c('i')} aria-hidden />
        </span>
        <div>
          <h2>Remember it</h2>
          <p>Everything above in ten lines, then check yourself.</p>
        </div>
      </div>

      <section className={c('sec')} id="cheat-sheet" style={{ '--pc': 'var(--ink)' } as CSSProperties} data-part="6">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <ListChecks className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>The whole system in 10 lines</h3>
            <p className={c('sub')}>Read this one again tomorrow. It is the whole page.</p>
          </div>
        </div>
        <CheatSheet />
        <Pager id="cheat-sheet" />
      </section>

      <section className={c('sec')} id="test-yourself" style={{ '--pc': 'var(--ink)' } as CSSProperties} data-part="6">
        <div className={c('sec-head')}>
          <div className={c('sec-icon')}>
            <Check className={c('i')} aria-hidden />
          </div>
          <div>
            <h3>Test yourself</h3>
            <p className={c('sub')}>Eight questions. Recalling an answer before you look is what makes it stick.</p>
          </div>
        </div>
        <TestYourself />
        <Pager id="test-yourself" />
      </section>

      <footer>
        Built from the R&amp;D search code and data on 3 Nov 2026. Numbers come from the ranking settings and the local
        catalog copy (11,253 templates).
      </footer>
    </>
  )
}
