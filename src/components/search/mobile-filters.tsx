'use client'

import { SlidersHorizontalIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'

/** Bottom filter drawer for small screens. The filter list itself is rendered on the server. */
export function MobileFilters({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 shrink-0 lg:hidden">
          <SlidersHorizontalIcon />
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader className="flex flex-row items-center justify-between border-b px-4 py-3 text-left">
          <DrawerTitle>Filters</DrawerTitle>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close filters">
              <XIcon />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <DrawerDescription className="sr-only">Filter search results.</DrawerDescription>
        {/* Close the drawer when a filter link is tapped. */}
        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-6"
          onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}
        >
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
