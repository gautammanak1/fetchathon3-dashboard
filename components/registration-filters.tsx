"use client"

import * as React from "react"
import { FilterIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { activeFilterCount, EMPTY_FILTERS, uniqueValues } from "@/lib/filters"
import type { Filters, Registration } from "@/lib/types"

function FilterGroup({
  title,
  options,
  selected,
  onChange,
}: {
  title: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="grid gap-2">
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">No values yet</p>
        ) : (
          options.map((option) => {
            const checked = selected.includes(option)
            return (
              <label
                key={option}
                className="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => {
                    onChange(
                      value
                        ? [...selected, option]
                        : selected.filter((item) => item !== option),
                    )
                  }}
                />
                <span>{option}</span>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

export function RegistrationFilters({
  rows,
  filters,
  onChange,
}: {
  rows: Registration[]
  filters: Filters
  onChange: (next: Filters) => void
}) {
  const count = activeFilterCount(filters)
  const [open, setOpen] = React.useState(false)

  return (
    <div className="flex flex-col gap-3 px-4 lg:flex-row lg:items-center lg:px-6">
      <div className="relative flex-1">
        <Label htmlFor="roster-search" className="sr-only">
          Search registrations
        </Label>
        <Input
          id="roster-search"
          value={filters.q}
          placeholder="Search name, email, college, team, city..."
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
        />
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline">
            <FilterIcon />
            Filters
            {count > 0 ? (
              <Badge variant="secondary" className="ml-1">
                {count}
              </Badge>
            ) : null}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Open filters</SheetTitle>
            <SheetDescription>
              City, location, builder type, and college come from Notion columns.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-6 px-4 pb-6">
            <FilterGroup
              title="City"
              options={uniqueValues(rows, "metro")}
              selected={filters.metro}
              onChange={(metro) => onChange({ ...filters, metro })}
            />
            <FilterGroup
              title="Location"
              options={uniqueValues(rows, "city")}
              selected={filters.location}
              onChange={(location) => onChange({ ...filters, location })}
            />
            <FilterGroup
              title="Builder type"
              options={uniqueValues(rows, "are_you")}
              selected={filters.builder}
              onChange={(builder) => onChange({ ...filters, builder })}
            />
            <FilterGroup
              title="College / org"
              options={uniqueValues(rows, "organization")}
              selected={filters.college}
              onChange={(college) => onChange({ ...filters, college })}
            />
            <FilterGroup
              title="Role"
              options={uniqueValues(rows, "role")}
              selected={filters.role}
              onChange={(role) => onChange({ ...filters, role })}
            />
            <FilterGroup
              title="Status"
              options={uniqueValues(rows, "status")}
              selected={filters.status}
              onChange={(status) => onChange({ ...filters, status })}
            />
            <FilterGroup
              title="RSVP"
              options={["none", "sent", "confirmed"]}
              selected={filters.rsvp}
              onChange={(rsvp) => onChange({ ...filters, rsvp })}
            />
            <FilterGroup
              title="QR"
              options={["none", "generated", "sent"]}
              selected={filters.qr}
              onChange={(qr) => onChange({ ...filters, qr })}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onChange(EMPTY_FILTERS)}
              >
                <XIcon />
                Clear filters
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
