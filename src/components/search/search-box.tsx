'use client'

import { SearchIcon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

export function SearchBox({ initialQuery, debug }: { initialQuery: string; debug: boolean }) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [pending, startTransition] = useTransition()

  function go(q: string) {
    const sp = new URLSearchParams()
    if (q.trim()) sp.set('q', q.trim())
    if (debug) sp.set('debug', '1')
    const qs = sp.toString()
    // A new query starts fresh: filters from the previous search are dropped.
    startTransition(() => router.push(qs ? `/search?${qs}` : '/search'))
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          go(query)
        }}
      >
        <div className="relative flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates, e.g. butterfly birthday invitation"
            aria-label="Search templates"
            className="h-11 pr-9 pl-9 text-base"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              title="Clear search"
              className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
        <Button type="submit" size="lg" className="h-11" disabled={pending}>
          {pending ? <Spinner /> : 'Search'}
        </Button>
      </form>
    </div>
  )
}
