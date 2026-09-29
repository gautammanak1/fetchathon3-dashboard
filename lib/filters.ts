import type { Filters, Registration } from "@/lib/types"

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

export function uniqueValues(rows: Registration[], key: keyof Registration) {
  return [
    ...new Set(
      rows
        .map((row) => {
          const value = row[key]
          return typeof value === "string" ? value : ""
        })
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b))
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
