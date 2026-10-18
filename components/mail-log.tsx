"use client"

import * as React from "react"
import { DownloadIcon, SearchIcon } from "lucide-react"

import { DashboardShell } from "@/components/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useRoster } from "@/hooks/use-roster"
import { downloadCsv } from "@/lib/csv"
import { cn } from "cn"
import type { Registration } from "@/lib/types"

type Choice = "all" | "sent" | "none" | "confirmed" | "generated"

const EMPTY = {
  registration: "all" as Choice,
  rsvp: "all" as Choice,
  reject: "all" as Choice,
  qr: "all" as Choice,
  venue: "all",
  q: "",
}

function labelFor(kind: "registration" | "rsvp" | "qr" | "reject", value: string) {
  if (kind === "registration") return value === "sent" ? "Sent" : "Not sent"
  if (kind === "reject") return value === "sent" ? "Sent" : "Not sent"
  if (kind === "rsvp") {
    if (value === "confirmed") return "Confirmed"
    if (value === "sent") return "Mailed"
    return "Not mailed"
  }
  if (value === "sent") return "Sent"
  if (value === "generated") return "Generated"
  return "Not sent"
}

function pillClass(value: string) {
  if (value === "confirmed" || value === "sent") {
    return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
  }
  if (value === "generated") {
    return "bg-amber-400/20 text-amber-900 dark:text-amber-100"
  }
  return "bg-rose-500/10 text-rose-800 dark:text-rose-200"
}

function LabeledPill({
  label,
  kind,
  value,
}: {
  label: string
  kind: "registration" | "rsvp" | "qr" | "reject"
  value: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <StatusPill kind={kind} value={value} />
    </span>
  )
}

function StatusPill({
  kind,
  value,
}: {
  kind: "registration" | "rsvp" | "qr" | "reject"
  value: string
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        pillClass(value),
      )}
    >
      {labelFor(kind, value)}
    </span>
  )
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      className="rounded-full"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export function MailLogPage() {
  const { data, loading, error } = useRoster()
  const [filters, setFilters] = React.useState(EMPTY)
  const rows = data?.registrations ?? []

  const venues = React.useMemo(() => {
    return [...new Set(rows.map((row) => row.city).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    )
  }, [rows])

  const visible = React.useMemo(() => {
    const query = filters.q.trim().toLowerCase()
    return rows.filter((row) => {
      if (filters.venue !== "all" && row.city !== filters.venue) return false
      if (filters.registration !== "all" && row.registration_mail_status !== filters.registration) {
        return false
      }
      if (filters.rsvp !== "all" && row.rsvp_status !== filters.rsvp) return false
      if (filters.reject !== "all" && row.reject_status !== filters.reject) return false
      if (filters.qr !== "all" && row.qr_status !== filters.qr) return false
      if (!query) return true
      const blob = [row.name, row.email, row.team_id_display, row.city, row.organization]
        .join(" ")
        .toLowerCase()
      return blob.includes(query)
    })
  }, [filters, rows])

  const counts = React.useMemo(() => {
    const base = rows.filter((row) => filters.venue === "all" || row.city === filters.venue)
    const tally = (pick: (row: Registration) => boolean) => base.filter(pick).length
    return {
      people: base.length,
      registrationSent: tally((row) => row.registration_mail_status === "sent"),
      registrationNone: tally((row) => row.registration_mail_status !== "sent"),
      rsvpConfirmed: tally((row) => row.rsvp_status === "confirmed"),
      rsvpSent: tally((row) => row.rsvp_status === "sent"),
      rsvpNone: tally((row) => row.rsvp_status === "none"),
      rejectSent: tally((row) => row.reject_status === "sent"),
      rejectNone: tally((row) => row.reject_status !== "sent"),
      qrSent: tally((row) => row.qr_status === "sent"),
      qrGenerated: tally((row) => row.qr_status === "generated"),
      qrNone: tally((row) => row.qr_status === "none"),
    }
  }, [filters.venue, rows])

  function setChoice(key: "registration" | "rsvp" | "reject" | "qr", value: Choice) {
    setFilters((current) => ({
      ...current,
      [key]: current[key] === value ? "all" : value,
    }))
  }

  return (
    <DashboardShell title="Mail log">
      <div className="grid gap-4 px-4 lg:px-6">
        <p className="max-w-2xl text-sm text-muted-foreground">
          People come from Notion. Who was mailed, who confirmed, and who got a reject mail is stored in Supabase.
        </p>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FilterCard
                title="Registration"
                active={filters.registration}
                onPick={(value) => setChoice("registration", value)}
                items={[
                  { value: "sent", label: "Sent", count: counts.registrationSent },
                  { value: "none", label: "Not sent", count: counts.registrationNone },
                ]}
              />
              <FilterCard
                title="RSVP"
                active={filters.rsvp}
                onPick={(value) => setChoice("rsvp", value)}
                items={[
                  { value: "confirmed", label: "Confirmed", count: counts.rsvpConfirmed },
                  { value: "sent", label: "Mailed, waiting", count: counts.rsvpSent },
                  { value: "none", label: "Not mailed", count: counts.rsvpNone },
                ]}
              />
              <FilterCard
                title="Reject"
                active={filters.reject}
                onPick={(value) => setChoice("reject", value)}
                items={[
                  { value: "sent", label: "Sent", count: counts.rejectSent },
                  { value: "none", label: "Not sent", count: counts.rejectNone },
                ]}
              />
              <FilterCard
                title="QR"
                active={filters.qr}
                onPick={(value) => setChoice("qr", value)}
                items={[
                  { value: "sent", label: "Sent", count: counts.qrSent },
                  { value: "generated", label: "Generated", count: counts.qrGenerated },
                  { value: "none", label: "Not sent", count: counts.qrNone },
                ]}
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="relative max-w-md">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.q}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, q: event.target.value }))
                  }
                  placeholder="Search name, email, or team"
                  className="pl-8"
                  aria-label="Search people"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={filters.venue === "all"}
                  onClick={() => setFilters((current) => ({ ...current, venue: "all" }))}
                >
                  All venues
                </Chip>
                {venues.map((venue) => (
                  <Chip
                    key={venue}
                    active={filters.venue === venue}
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        venue: current.venue === venue ? "all" : venue,
                      }))
                    }
                  >
                    {venue}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Showing {visible.length} of {counts.people}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={visible.length === 0}
                  onClick={() =>
                    downloadCsv(
                      "fetchathon-mail-log.csv",
                      visible.map((row) => ({
                        name: row.name,
                        email: row.email,
                        team: row.team_id_display,
                        location: row.city,
                        organization: row.organization,
                        registration: row.registration_mail_status,
                        rsvp: row.rsvp_status,
                        reject: row.reject_status,
                        qr: row.qr_status,
                      })),
                    )
                  }
                >
                  <DownloadIcon />
                  Export CSV
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters(EMPTY)}
                >
                  Clear filters
                </Button>
              </div>
            </div>

            <div
              key={`${filters.registration}-${filters.rsvp}-${filters.reject}-${filters.qr}-${filters.venue}-${filters.q}`}
              className="rise overflow-hidden rounded-2xl border bg-card"
            >
              {visible.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No one matches these filters.
                </p>
              ) : (
                <ul>
                  {visible.map((row) => (
                    <li
                      key={row.id}
                      className="grid gap-2 border-b px-4 py-3 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{row.name || "Untitled"}</p>
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.team_id_display || "No team"} · {row.city || "No venue"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <LabeledPill label="Reg" kind="registration" value={row.registration_mail_status} />
                        <LabeledPill label="RSVP" kind="rsvp" value={row.rsvp_status} />
                        <LabeledPill label="Reject" kind="reject" value={row.reject_status} />
                        <LabeledPill label="QR" kind="qr" value={row.qr_status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  )
}

function FilterCard({
  title,
  items,
  active,
  onPick,
}: {
  title: string
  active: Choice
  onPick: (value: Choice) => void
  items: Array<{ value: Choice; label: string; count: number }>
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-xs">
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-3 grid gap-2">
        {items.map((item) => {
          const on = active === item.value
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onPick(item.value)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                on ? "bg-primary text-primary-foreground" : "bg-muted/70 hover:bg-accent",
              )}
            >
              <span className="whitespace-nowrap">{item.label}</span>
              <span className="shrink-0 text-xl font-semibold tabular-nums">{item.count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
