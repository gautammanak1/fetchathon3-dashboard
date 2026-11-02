"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import type { FeedbackEntry } from "@/lib/feedback-types"
import { cn } from "cn"

const RATINGS: Record<number, string> = {
  1: "Poor",
  2: "Weak",
  3: "Okay",
  4: "Good",
  5: "Great",
}

const AGAIN: Record<string, string> = {
  yes: "Yes",
  maybe: "Maybe",
  no: "No",
}

function when(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  })
}

function haystack(row: FeedbackEntry) {
  return [
    row.name,
    row.email,
    row.teamId,
    row.city,
    row.role,
    row.problems,
    row.techFeedback,
    row.asi1Feedback,
    row.wentWell,
    row.fixNext,
    row.anythingElse,
    row.problemAreas.join(" "),
  ]
    .join(" ")
    .toLowerCase()
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <section className="grid gap-1">
      <h3 className="text-sm text-muted-foreground">{label}</h3>
      <p className="whitespace-pre-wrap text-sm leading-6">{text.trim() || "—"}</p>
    </section>
  )
}

export function FeedbackInbox({ rows }: { rows: FeedbackEntry[] }) {
  const [query, setQuery] = React.useState("")
  const [selectedId, setSelectedId] = React.useState(rows[0]?.id || "")
  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) => haystack(row).includes(needle))
  }, [query, rows])
  const selected = visible.find((row) => row.id === selectedId) || visible[0] || null

  return (
    <div className="grid gap-4 px-4 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "response" : "responses"}
        </p>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email, city, or what they wrote"
          className="max-w-sm"
        />
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {rows.length === 0 ? "No feedback yet." : "Nothing matches that search."}
        </p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="grid max-h-[70vh] gap-2 overflow-auto">
            {visible.map((row) => {
              const active = selected?.id === row.id
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={cn(
                    "grid gap-1 rounded-lg border px-3 py-2 text-left",
                    active ? "border-foreground bg-muted" : "border-border bg-background",
                  )}
                >
                  <span className="truncate text-sm">{row.name || row.email || "No name"}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[row.city, row.role, when(row.createdAt)].filter(Boolean).join(" · ")}
                  </span>
                </button>
              )
            })}
          </div>
          {selected ? (
            <article className="grid gap-4 rounded-lg border border-border p-4">
              <div className="grid gap-1">
                <h2 className="text-lg">{selected.name || "No name"}</h2>
                <p className="text-sm text-muted-foreground">
                  {[selected.email, selected.teamId, when(selected.createdAt)].filter(Boolean).join(" · ")}
                </p>
                <p className="text-sm">
                  {[
                    selected.city,
                    selected.role,
                    selected.rating ? `${selected.rating} ${RATINGS[selected.rating]}` : "",
                    selected.useAgain ? `Build again: ${AGAIN[selected.useAgain] || selected.useAgain}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {selected.problemAreas.length ? (
                  <p className="text-sm text-muted-foreground">{selected.problemAreas.join(", ")}</p>
                ) : null}
              </div>
              <Block label="What problem did they hit?" text={selected.problems} />
              <Block label="Tech feedback" text={selected.techFeedback} />
              <Block label="ASI:One feedback" text={selected.asi1Feedback} />
              <Block label="What worked?" text={selected.wentWell} />
              <Block label="What should we fix next?" text={selected.fixNext} />
              <Block label="Anything else" text={selected.anythingElse} />
            </article>
          ) : null}
        </div>
      )}
    </div>
  )
}
