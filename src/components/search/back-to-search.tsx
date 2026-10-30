'use client'

import { ArrowLeftIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

/**
 * Back to the search the user came from (same query, filters and page).
 * Opened directly (shared link, new tab), there is no search to return to, so it goes to /search.
 */
export function BackToSearch() {
  const router = useRouter()
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        const cameFromHere = document.referrer && new URL(document.referrer).origin === window.location.origin
        if (cameFromHere && window.history.length > 1) router.back()
        else router.push('/search')
      }}
      className="text-muted-foreground -ml-2 w-fit gap-1"
    >
      <ArrowLeftIcon />
      Back to results
    </Button>
  )
}
