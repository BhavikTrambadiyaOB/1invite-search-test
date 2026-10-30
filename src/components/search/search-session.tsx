'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import type { SearchFilters, SearchIntent } from '@/lib/search/types'

export type SearchLogPayload = {
  query: string
  filters: SearchFilters
  page: number
  intent: SearchIntent
  resultCount: number
  /** Results that fit the occasion and every asked detail. */
  exactCount: number
  topScore: number | null
  /** Parts of the query reading the user removed from the "Showing" tags. */
  ignored: string[]
}

export type EventType = 'click' | 'open' | 'bounce'

type Track = (templateId: number, type: EventType, position?: number) => void

const SearchSessionContext = createContext<Track>(() => {})

const SESSION_KEY = 'template-search-session'
const SESSION_IDLE_MS = 30 * 60 * 1000

/** Anonymous id that links searches made in one sitting (new after 30 idle minutes). */
function getSessionId() {
  try {
    const now = Date.now()
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as { id: string; at: number } | null
    const id = saved && now - saved.at < SESSION_IDLE_MS ? saved.id : crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, at: now }))
    return id
  } catch {
    return 'no-storage'
  }
}

/**
 * Logs the search once it is actually shown (not on prefetch or server re-render),
 * and records clicks, opens and quick bounces on its results.
 */
export function SearchSession({ payload, children }: { payload: SearchLogPayload; children: React.ReactNode }) {
  const key = useMemo(() => JSON.stringify(payload), [payload])
  const searchIdRef = useRef<Promise<number | null> | null>(null)
  const loggedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (loggedKeyRef.current === key) return // React dev mode runs effects twice.
    loggedKeyRef.current = key
    searchIdRef.current = fetch('/api/search/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, sessionId: getSessionId() }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { id?: number } | null) => data?.id ?? null)
      .catch(() => null)
  }, [key, payload])

  const track = useCallback<Track>((templateId, type, position) => {
    const pending = searchIdRef.current
    if (!pending) return
    void pending.then((searchId) => {
      if (!searchId) return
      void fetch('/api/search/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ searchId, templateId, type, position }),
        keepalive: true,
      }).catch(() => {})
    })
  }, [])

  return <SearchSessionContext.Provider value={track}>{children}</SearchSessionContext.Provider>
}

export function useTrack() {
  return useContext(SearchSessionContext)
}
