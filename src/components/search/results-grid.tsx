'use client'

import Image from 'next/image'
import Link from 'next/link'
import { XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import type { SearchResultItem } from '@/lib/search/types'
import { useTrack } from './search-session'

/** Closing a preview this fast counts as a bounce (the result did not fit). */
const BOUNCE_MS = 5000

function Preview({ item, className, sizes }: { item: SearchResultItem; className?: string; sizes: string }) {
  if (!item.previewUrl) {
    return <div className={cn('bg-muted text-muted-foreground flex items-center justify-center text-xs', className)}>No preview</div>
  }
  return (
    <div className={cn('bg-muted relative overflow-hidden', className)}>
      <Image src={item.previewUrl} alt={item.name} fill sizes={sizes} className="object-contain" />
    </div>
  )
}

/** Shared preview body for the desktop modal and the mobile drawer. */
function PreviewDetails({
  item,
  onDetails,
}: {
  item: SearchResultItem
  onDetails: () => void
}) {
  return (
    <>
      <Preview
        item={item}
        sizes="(min-width: 640px) 640px, 100vw"
        className={cn('w-full rounded-md', item.isPortrait === false ? 'aspect-[4/3]' : 'aspect-[5/7] max-h-[60vh]')}
      />
      {item.themes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.themes.map((t) => (
            <Badge key={t} variant="outline">
              {t.replace(/_/g, ' ')}
            </Badge>
          ))}
        </div>
      )}
      <div>
        <Button size="lg" variant="outline" className="w-full" asChild onClick={onDetails}>
          <Link href={`/templates/${item.id}`} scroll={false}>
            See the details
          </Link>
        </Button>
      </div>
    </>
  )
}

export function ResultsGrid({ results, offset, debug }: { results: SearchResultItem[]; offset: number; debug: boolean }) {
  const track = useTrack()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [selected, setSelected] = useState<{ item: SearchResultItem; position: number } | null>(null)
  const continuedRef = useRef(false)

  // Closing a preview quickly without opening its details counts as a bounce.
  useEffect(() => {
    if (!selected) return
    const openedAt = Date.now()
    continuedRef.current = false
    return () => {
      if (!continuedRef.current && Date.now() - openedAt < BOUNCE_MS) track(selected.item.id, 'bounce', selected.position)
    }
  }, [selected, track])

  function openPreview(item: SearchResultItem, position: number) {
    setSelected({ item, position })
    track(item.id, 'click', position)
  }

  function closePreview() {
    setSelected(null)
  }

  function seeDetails() {
    // Opening the details shows interest, so closing the preview is not a bounce.
    continuedRef.current = true
    setSelected(null)
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {results.map((item, i) => {
          const position = offset + i + 1
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openPreview(item, position)}
                className="group focus-visible:ring-ring flex w-full flex-col gap-2 rounded-lg text-left outline-none focus-visible:ring-2"
              >
                <div className="relative">
                  <Preview
                    item={item}
                    sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 28vw, (min-width: 640px) 45vw, 50vw"
                    className={cn(
                      'w-full rounded-lg border transition-shadow group-hover:shadow-md',
                      item.isPortrait === false ? 'aspect-[4/3]' : 'aspect-[5/7]',
                    )}
                  />
                  <Badge variant={item.isFree ? 'secondary' : 'default'} className="absolute top-2 left-2">
                    {item.isFree ? 'Free' : 'PRO'}
                  </Badge>
                </div>
                <div className="flex flex-col gap-0.5 px-0.5">
                  <span className="line-clamp-2 text-sm font-medium">{item.name}</span>
                  {item.occasionLabel && <span className="text-muted-foreground text-xs">{item.occasionLabel}</span>}
                  {debug && (
                    <span className="text-muted-foreground font-mono text-[11px] leading-tight">
                      #{position} score {item.score} · rel {item.debug.relevance} · fresh {item.debug.freshness} · qual{' '}
                      {item.debug.quality}
                      {item.debug.milestoneBonus > 0 ? ` · milestone +${item.debug.milestoneBonus}` : ''} · {item.createdAt.slice(0, 10)}
                    </span>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      <Dialog open={isDesktop && !!selected} onOpenChange={(open) => !open && closePreview()}>
        {selected && (
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selected.item.name}</DialogTitle>
              <DialogDescription>
                {[selected.item.occasionLabel, selected.item.isFree ? 'Free' : 'PRO'].filter(Boolean).join(' · ')}
              </DialogDescription>
            </DialogHeader>
            <PreviewDetails item={selected.item} onDetails={seeDetails} />
          </DialogContent>
        )}
      </Dialog>

      <Drawer open={!isDesktop && !!selected} onOpenChange={(open) => !open && closePreview()}>
        {selected && (
          <DrawerContent className="max-h-[92dvh]">
            <DrawerHeader className="relative pr-12 text-left">
              <DrawerTitle>{selected.item.name}</DrawerTitle>
              <DrawerDescription>
                {[selected.item.occasionLabel, selected.item.isFree ? 'Free' : 'PRO'].filter(Boolean).join(' · ')}
              </DrawerDescription>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="absolute top-2 right-2" aria-label="Close preview">
                  <XIcon />
                </Button>
              </DrawerClose>
            </DrawerHeader>
            <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-6">
              <PreviewDetails item={selected.item} onDetails={seeDetails} />
            </div>
          </DrawerContent>
        )}
      </Drawer>
    </>
  )
}
