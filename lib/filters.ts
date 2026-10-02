import { VENUE_OPTIONS } from "@/lib/fields"
import type { Filters, Registration } from "@/lib/types"

export const LOCATION_FILTERS = VENUE_OPTIONS.map((venue) => venue.label)
export const CITY_FILTERS = [...new Set(VENUE_OPTIONS.map((venue) => venue.metro))]
export const COLLEGE_FILTERS = ["Masters' Union"]

export const EMPTY_FILTERS: Filters = {
  q: "",
  metro: [],
  location: [],
  builder: [],
  college: [],
  role: [],
  status: [],
  rsvp: [],
  qr: [],
}

function includesAny(haystack: string, selected: string[]) {
  if (selected.length === 0) return true
  const value = haystack.trim().toLowerCase()
  return selected.some((item) => item.toLowerCase() === value)
}

export function filterRegistrations(rows: Registration[], filters: Filters) {
  const query = filters.q.trim().toLowerCase()
  return rows.filter((row) => {
    if (query) {
      const blob = [
        row.name,
        row.email,
        row.phone,
        row.organization,
        row.city,
        row.metro,
        row.team_id_display,
        row.address,
        row.skills.join(" "),
      ]
        .join(" ")
        .toLowerCase()
      if (!blob.includes(query)) return false
    }
    return (
      includesAny(row.metro, filters.metro) &&
      includesAny(row.city, filters.location) &&
      includesAny(row.are_you, filters.builder) &&
      includesAny(row.organization, filters.college) &&
      includesAny(row.role, filters.role) &&
      includesAny(row.status, filters.status) &&
      includesAny(row.rsvp_status, filters.rsvp) &&
      includesAny(row.qr_status, filters.qr)
    )
  })
}

export function uniqueValues(
  rows: Registration[],
  key: keyof Registration,
  known: string[] = [],
) {
  const fromRows = rows
    .map((row) => {
      const value = row[key]
      return typeof value === "string" ? value.trim() : ""
    })
    .filter(Boolean)
  const extras = [...new Set(fromRows)]
    .filter((value) => !known.some((item) => item.toLowerCase() === value.toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
  return [...known, ...extras]
}

export function activeFilterCount(filters: Filters) {
  return (
    (filters.q.trim() ? 1 : 0) +
    filters.metro.length +
    filters.location.length +
    filters.builder.length +
    filters.college.length +
    filters.role.length +
    filters.status.length +
    filters.rsvp.length +
    filters.qr.length
  )
}
