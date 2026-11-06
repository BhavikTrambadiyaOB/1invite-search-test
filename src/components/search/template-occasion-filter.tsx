'use client'

import { CheckIcon, ChevronsUpDownIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { FacetValue } from '@/lib/search/types'

export function TemplateOccasionFilter({
  options,
  selected,
}: {
  options: FacetValue[]
  selected: string[]
}) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState(selected)
  const selectedOptions = options.filter((option) => values.includes(option.id))
  const summary =
    selectedOptions.length === 0
      ? 'All occasions'
      : selectedOptions.length <= 2
        ? selectedOptions.map((option) => option.label).join(', ')
        : `${selectedOptions.length} occasions selected`

  function toggle(value: string) {
    setValues((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    )
  }

  return (
    <>
      {values.map((id) => <input key={id} type="hidden" name="occasion" value={id} />)}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{summary}</span>
            <ChevronsUpDownIcon className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder="Search occasions..." />
            <CommandList>
              <CommandEmpty>No occasion found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  return (
                    <CommandItem
                      key={option.id}
                      value={`${option.label} ${option.id}`}
                      onSelect={() => toggle(option.id)}
                    >
                      <span className="flex size-4 items-center justify-center rounded border">
                        {values.includes(option.id) && <CheckIcon />}
                      </span>
                      <span className="flex-1">{option.label}</span>
                      <span className="text-muted-foreground text-xs tabular-nums">{option.count.toLocaleString()}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
            {values.length > 0 && (
              <div className="border-t p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setValues([])}
                >
                  <XIcon data-icon="inline-start" />
                  Clear occasions
                </Button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </>
  )
}
