'use client'

import { ExternalLinkIcon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'

/**
 * Shows template details over the search results. Closing goes back in history,
 * so the search underneath keeps its query, filters, page and scroll position.
 * Desktop uses a modal; small screens use a bottom drawer.
 */
export function DetailsModal({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  function close() {
    router.back()
  }

  if (isDesktop) {
    return (
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-6xl">
          <div className="flex items-center justify-between gap-4 pr-8">
            <DialogTitle className="text-muted-foreground text-sm font-normal">Template details</DialogTitle>
            <OpenAsPage />
          </div>
          <DialogDescription className="sr-only">Everything known about this template.</DialogDescription>
          {children}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open onOpenChange={(open) => !open && close()}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader className="flex flex-row items-center justify-between gap-3 border-b px-4 py-3 text-left">
          <DrawerTitle className="text-muted-foreground text-sm font-normal">Template details</DrawerTitle>
          <div className="flex items-center gap-1">
            <OpenAsPage />
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" aria-label="Close template details">
                <XIcon />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        <DrawerDescription className="sr-only">Everything known about this template.</DrawerDescription>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-6">{children}</div>
      </DrawerContent>
    </Drawer>
  )
}

function OpenAsPage() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-sm"
    >
      Open as page <ExternalLinkIcon className="size-3.5" />
    </button>
  )
}
