import { CheckIcon } from 'lucide-react'
import Link from 'next/link'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { cn } from '@/lib/utils'
import type { FacetValue, SearchResponse } from '@/lib/search/types'
import { activeFilterCount, NO_FILTERS, searchHref, tagHref, toggle, type SearchState } from '@/lib/search/url'

const COLOR_SWATCH: Record<string, string> = {
  pink: '#f472b6',
  red: '#ef4444',
  burgundy: '#7f1d1d',
  orange: '#fb923c',
  yellow: '#facc15',
  gold: '#d4a017',
  green: '#22c55e',
  teal: '#14b8a6',
  blue: '#3b82f6',
  navy: '#1e3a8a',
  purple: '#a855f7',
  black: '#111827',
  white: '#ffffff',
  silver: '#9ca3af',
  brown: '#92400e',
  rose_gold: '#e8a598',
  pastel: '#fbcfe8',
  multicolor: 'conic-gradient(#ef4444,#facc15,#22c55e,#3b82f6,#a855f7,#ef4444)',
}

/** One collapsible filter group. `selected` is how many of its values are chosen (shown next to the title). */
function Section({
  id,
  title,
  selected = 0,
  children,
}: {
  id: string
  title: string
  selected?: number
  children: React.ReactNode
}) {
  return (
    <AccordionItem value={id}>
      <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
        <span className="flex items-center gap-1.5">
          {title}
          {selected > 0 && (
            <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[11px] leading-4 tabular-nums">
              {selected}
            </span>
          )}
        </span>
      </AccordionTrigger>
      <AccordionContent className="flex flex-col gap-1.5 pb-3">{children}</AccordionContent>
    </AccordionItem>
  )
}

/** A two-way choice (Free / PRO) shown as a toggle, always visible, in place of a collapsible group. */
function ToggleRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-3">
      <span className="text-sm font-semibold">{title}</span>
      <div role="group" aria-label={title} className="bg-muted flex rounded-md p-0.5">
        {children}
      </div>
    </div>
  )
}

/** One side of a ToggleRow; tapping the chosen side again turns the filter off. */
function ToggleOption({
  href,
  active,
  label,
  count,
}: {
  href: string
  active: boolean
  label: string
  count?: number
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-pressed={active}
      title={count !== undefined ? `${count} templates` : undefined}
      className={cn(
        'rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </Link>
  )
}

function Option({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1 text-sm',
        active && 'bg-accent font-medium',
      )}
    >
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded border',
          active ? 'bg-primary border-primary text-primary-foreground' : 'border-input',
        )}
      >
        {active && <CheckIcon className="size-3" />}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-muted-foreground text-xs tabular-nums">{count}</span>}
    </Link>
  )
}

function withSelected(values: FacetValue[], selected: string[] = [], limit = 12) {
  // Always show selected values, even when they have no results under the other filters.
  const top = values.slice(0, limit)
  for (const id of selected) if (!top.some((v) => v.id === id)) top.push({ id, label: id, count: 0 })
  return top
}

export function FilterSidebar({ state, response }: { state: SearchState; response: SearchResponse }) {
  const { filters } = state
  const { facets } = response

  // How many values are chosen per group; those groups start open, with Category, so choices stay visible.
  const selected: Record<string, number> = {
    category: filters.occasions?.length ?? 0,
    gender: filters.genders?.length ?? 0,
    type: filters.docTypes?.length ?? 0,
    theme: filters.themes?.length ?? 0,
    elements: filters.assets?.length ?? 0,
    style: filters.styles?.length ?? 0,
    mood: filters.moods?.length ?? 0,
    color: filters.colors?.length ?? 0,
    age: filters.milestones?.length ?? 0,
    language: filters.languages?.length ?? 0,
  }
  const open = ['category', ...Object.keys(selected).filter((k) => k !== 'category' && selected[k] > 0)]

  return (
    <div className="flex flex-col gap-2">
      {activeFilterCount(filters) > 0 && (
        <Link
          href={searchHref(state, { filters: NO_FILTERS })}
          scroll={false}
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          Clear all filters
        </Link>
      )}

      <Accordion type="multiple" defaultValue={open}>
        <Section id="category" title="Category" selected={selected.category}>
          {withSelected(facets.occasion, filters.occasions, 15).map((o) => (
            <Option
              key={o.id}
              label={o.label}
              count={o.count}
              active={!!filters.occasions?.includes(o.id)}
              href={searchHref(state, {
                filters: { occasions: toggle(filters.occasions, o.id) },
              })}
            />
          ))}
          {facets.occasion.length === 0 && <p className="text-muted-foreground px-2 text-sm">No categories</p>}
        </Section>

        {facets.gender.length > 0 && (
          <Section id="gender" title="Gender" selected={selected.gender}>
            {withSelected(facets.gender, filters.genders).map((o) => (
              <Option
                key={o.id}
                label={o.label}
                count={o.count}
                active={!!filters.genders?.includes(o.id)}
                href={searchHref(state, {
                  filters: { genders: toggle(filters.genders, o.id) },
                })}
              />
            ))}
          </Section>
        )}

        <ToggleRow title="Price">
          {facets.price.map((o) => (
            <ToggleOption
              key={o.id}
              label={o.label}
              count={filters.price && filters.price !== o.id ? undefined : o.count}
              active={filters.price === o.id}
              href={searchHref(state, {
                filters: {
                  price: filters.price === o.id ? undefined : (o.id as 'free' | 'premium'),
                },
              })}
            />
          ))}
        </ToggleRow>

        {facets.docType.length > 0 && (
          <Section id="type" title="Type" selected={selected.type}>
            {withSelected(facets.docType, filters.docTypes).map((o) => (
              <Option
                key={o.id}
                label={o.label}
                count={o.count}
                active={!!filters.docTypes?.includes(o.id)}
                href={searchHref(state, {
                  filters: { docTypes: toggle(filters.docTypes, o.id) },
                })}
              />
            ))}
          </Section>
        )}

        {facets.themes.length > 0 && (
          <Section id="theme" title="Theme" selected={selected.theme}>
            {withSelected(facets.themes, filters.themes).map((o) => (
              <Option
                key={o.id}
                label={o.label}
                count={o.count}
                active={!!filters.themes?.includes(o.id)}
                href={searchHref(state, {
                  filters: { themes: toggle(filters.themes, o.id) },
                })}
              />
            ))}
          </Section>
        )}

        {facets.assets.length > 0 && (
          <Section id="elements" title="Elements" selected={selected.elements}>
            {withSelected(facets.assets, filters.assets, 15).map((o) => (
              <Option
                key={o.id}
                label={o.label}
                count={o.count}
                active={!!filters.assets?.includes(o.id)}
                href={searchHref(state, {
                  filters: { assets: toggle(filters.assets, o.id) },
                })}
              />
            ))}
          </Section>
        )}

        {facets.styles.length > 0 && (
          <Section id="style" title="Style" selected={selected.style}>
            {withSelected(facets.styles, filters.styles, 10).map((o) => (
              <Option
                key={o.id}
                label={o.label}
                count={o.count}
                active={!!filters.styles?.includes(o.id)}
                href={searchHref(state, {
                  filters: { styles: toggle(filters.styles, o.id) },
                })}
              />
            ))}
          </Section>
        )}

        {facets.moods.length > 0 && (
          <Section id="mood" title="Mood" selected={selected.mood}>
            {withSelected(facets.moods, filters.moods).map((o) => (
              <Option
                key={o.id}
                label={o.label}
                count={o.count}
                active={!!filters.moods?.includes(o.id)}
                href={searchHref(state, {
                  filters: { moods: toggle(filters.moods, o.id) },
                })}
              />
            ))}
          </Section>
        )}

        {facets.colors.length > 0 && (
          <Section id="color" title="Color" selected={selected.color}>
            <div className="flex flex-wrap gap-2 px-1">
              {withSelected(facets.colors, filters.colors, 18).map((o) => {
                const active = !!filters.colors?.includes(o.id)
                return (
                  <Link
                    key={o.id}
                    href={searchHref(state, {
                      filters: { colors: toggle(filters.colors, o.id) },
                    })}
                    scroll={false}
                    title={`${o.label} (${o.count})`}
                    aria-label={`${o.label}, ${o.count} templates`}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'size-7 rounded-full border shadow-sm transition-transform hover:scale-110',
                      active && 'ring-primary ring-2 ring-offset-2',
                    )}
                    style={{ background: COLOR_SWATCH[o.id] ?? '#ccc' }}
                  />
                )
              })}
            </div>
          </Section>
        )}

        {facets.milestones.length > 0 && (
          <Section id="age" title="Age / years" selected={selected.age}>
            {withSelected(facets.milestones, filters.milestones?.map(String), 10).map((o) => (
              <Option
                key={o.id}
                label={o.label}
                count={o.count}
                active={!!filters.milestones?.includes(Number(o.id))}
                href={tagHref(state, 'milestones', o.id, !filters.milestones?.includes(Number(o.id)))}
              />
            ))}
          </Section>
        )}

        <ToggleRow title="Photo">
          {facets.photo.map((o) => (
            <ToggleOption
              key={o.id}
              label={o.label}
              count={filters.photo && filters.photo !== o.id ? undefined : o.count}
              active={filters.photo === o.id}
              href={searchHref(state, {
                filters: {
                  photo: filters.photo === o.id ? undefined : (o.id as 'with' | 'without'),
                },
              })}
            />
          ))}
        </ToggleRow>

        {/* Most templates are English; the group is shown once there is a choice to make. */}
        {(facets.languages.length > 1 || !!filters.languages?.length) && (
          <Section id="language" title="Language" selected={selected.language}>
            {withSelected(facets.languages, filters.languages).map((o) => (
              <Option
                key={o.id}
                label={o.label}
                count={o.count}
                active={!!filters.languages?.includes(o.id)}
                href={searchHref(state, {
                  filters: { languages: toggle(filters.languages, o.id) },
                })}
              />
            ))}
          </Section>
        )}

        <ToggleRow title="Orientation">
          {facets.orientation.map((o) => (
            <ToggleOption
              key={o.id}
              label={o.label}
              count={filters.orientation && filters.orientation !== o.id ? undefined : o.count}
              active={filters.orientation === o.id}
              href={searchHref(state, {
                filters: {
                  orientation: filters.orientation === o.id ? undefined : (o.id as 'portrait' | 'landscape'),
                },
              })}
            />
          ))}
        </ToggleRow>
      </Accordion>
    </div>
  )
}
