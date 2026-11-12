"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"

type SavedRow = {
  email: string
  name: string
  city: string
  github: string
  downloadedAt: string
}

type MissingRow = {
  email: string
  name: string
  city: string
  github: string
}

function matches(query: string, row: { email: string; name: string; city: string; github?: string }) {
  const text = query.trim().toLowerCase()
  if (!text) return true
  return [row.name, row.email, row.city, row.github || ""].some((value) => value.toLowerCase().includes(text))
}

function when(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
}

export function CertificateBoard({
  registered,
  saved,
  missing,
  savedRows,
  missingRows,
}: {
  registered: number
  saved: number
  missing: number
  savedRows: SavedRow[]
  missingRows: MissingRow[]
}) {
  const [query, setQuery] = React.useState("")
  const savedList = savedRows.filter((row) => matches(query, row))
  const missingList = missingRows.filter((row) => matches(query, row))

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Registered</p>
          <p className="text-2xl">{registered}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Saved</p>
          <p className="text-2xl">{saved}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Not saved</p>
          <p className="text-2xl">{missing}</p>
        </div>
      </div>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, city" />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="grid gap-3">
          <h2 className="text-sm">Saved ({savedList.length})</h2>
          <div className="grid max-h-[32rem] gap-2 overflow-auto">
            {savedList.map((row) => (
              <div key={row.email} className="rounded-lg border px-3 py-2 text-sm">
                <p>{row.name}</p>
                <p className="text-muted-foreground">{row.email}</p>
                <p className="text-muted-foreground">{row.github} · {when(row.downloadedAt)}</p>
              </div>
            ))}
            {savedList.length === 0 ? <p className="text-sm text-muted-foreground">No one has saved a certificate yet.</p> : null}
          </div>
        </section>
        <section className="grid gap-3">
          <h2 className="text-sm">Not saved ({missingList.length})</h2>
          <div className="grid max-h-[32rem] gap-2 overflow-auto">
            {missingList.map((row) => (
              <div key={row.email} className="rounded-lg border px-3 py-2 text-sm">
                <p>{row.name}</p>
                <p className="text-muted-foreground">{row.email}{row.github ? ` · ${row.github}` : ""}{row.city ? ` · ${row.city}` : ""}</p>
              </div>
            ))}
            {missingList.length === 0 ? <p className="text-sm text-muted-foreground">Everyone registered has saved a certificate.</p> : null}
          </div>
        </section>
      </div>
    </div>
  )
}
