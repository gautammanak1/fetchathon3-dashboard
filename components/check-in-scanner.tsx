"use client"

import * as React from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CheckInRecord } from "@/lib/checkin-store"
import type { CheckInMember, DoorPerson } from "@/lib/checkin"

type ScanResult = {
  already: boolean
  teamId: string
  venue: string
  notion: "updated" | "skipped" | "failed"
  members: CheckInMember[]
  note: string
}

type Summary = {
  people: number
  teams: number
  recent: CheckInRecord[]
  expected?: DoorPerson[]
  sent?: number
  arrived?: number
  waiting?: number
}

function formatWhen(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  })
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-normal tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function beep(ok: boolean) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = ok ? 880 : 240
    gain.gain.value = 0.04
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
    osc.onended = () => void ctx.close()
  } catch {
    return
  }
}

export function CheckInScanner({
  endpoint = "/api/check-in",
  peopleLabel = "People joined",
  teamsLabel = "Teams joined",
  title = "Scan venue QR",
  description = "Point the camera at the team pass. Everyone on that pass is marked joined.",
  submitLabel = "Mark joined",
  recentTitle = "Recent check-ins",
  recentDescription = "People marked joined from a scanned pass.",
  recentEmpty = "No one has joined yet.",
  alreadyLabel = "Already joined",
  freshLabel = "Checked in",
  joinedLabel = "Joined",
  manualPlaceholder = "Or paste the pass link",
  manualLabel = "Pass link",
  showRoster = false,
}: {
  endpoint?: string
  peopleLabel?: string
  teamsLabel?: string
  title?: string
  description?: string
  submitLabel?: string
  recentTitle?: string
  recentDescription?: string
  recentEmpty?: string
  alreadyLabel?: string
  freshLabel?: string
  joinedLabel?: string
  manualPlaceholder?: string
  manualLabel?: string
  showRoster?: boolean
} = {}) {
  const regionId = React.useId().replace(/:/g, "")
  const scannerRef = React.useRef<import("html5-qrcode").Html5Qrcode | null>(null)
  const locking = React.useRef(false)
  const [cameraOn, setCameraOn] = React.useState(false)
  const [cameraError, setCameraError] = React.useState<string | null>(null)
  const [manual, setManual] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<ScanResult | null>(null)
  const [summary, setSummary] = React.useState<Summary | null>(null)
  const [query, setQuery] = React.useState("")
  const [presence, setPresence] = React.useState<"all" | "here" | "waiting">("all")
  const [venue, setVenue] = React.useState("")
  const [page, setPage] = React.useState(0)

  const loadSummary = React.useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" })
    const payload = (await response.json()) as Summary & { error?: string }
    if (!response.ok) {
      toast.error(payload.error || "Could not load check-ins")
      return
    }
    setSummary(payload)
  }, [endpoint])

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSummary()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadSummary])

  React.useEffect(() => {
    setPage(0)
  }, [query, presence, venue])

  const stopCamera = React.useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    setCameraOn(false)
    if (!scanner) return
    try {
      if (scanner.isScanning) await scanner.stop()
      scanner.clear()
    } catch {
      return
    }
  }, [])

  React.useEffect(() => {
    return () => {
      void stopCamera()
    }
  }, [stopCamera])

  const submitScan = React.useCallback(
    async (scan: string) => {
      setBusy(true)
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scan }),
        })
        const payload = (await response.json()) as ScanResult & { error?: string }
        if (!response.ok) {
          beep(false)
          toast.error(payload.error || "Check-in failed")
          setResult(null)
          return
        }
        beep(!payload.already)
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(payload.already ? [40, 40, 40] : 80)
        }
        setResult(payload)
        toast.success(payload.note)
        await loadSummary()
      } finally {
        setBusy(false)
      }
    },
    [endpoint, loadSummary],
  )

  const startCamera = React.useCallback(async () => {
    setCameraError(null)
    setResult(null)
    await stopCamera()
    const { Html5Qrcode } = await import("html5-qrcode")
    const scanner = new Html5Qrcode(regionId, { verbose: false })
    scannerRef.current = scanner
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          if (locking.current) return
          locking.current = true
          void (async () => {
            await stopCamera()
            await submitScan(decoded)
            locking.current = false
          })()
        },
        () => undefined,
      )
      setCameraOn(true)
    } catch (error) {
      scannerRef.current = null
      setCameraOn(false)
      const message =
        error instanceof Error ? error.message : "Camera could not start"
      setCameraError(message)
    }
  }, [regionId, stopCamera, submitScan])

  const undo = async (id: string) => {
    setBusy(true)
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undoId: id }),
      })
      const payload = (await response.json()) as { error?: string; note?: string }
      if (!response.ok) {
        toast.error(payload.error || "Could not undo check-in")
        return
      }
      toast.success(payload.note || "Removed from check-in")
      setResult((current) =>
        current
          ? {
              ...current,
              already: false,
              members: current.members.map((member) =>
                member.id === id
                  ? { ...member, checked_in_at: null, newly: false }
                  : member,
              ),
            }
          : current,
      )
      await loadSummary()
    } finally {
      setBusy(false)
    }
  }

  const roster = summary?.expected || []
  const venues = [...new Set(roster.map((person) => person.venue).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  )
  const needle = query.trim().toLowerCase()
  const filtered = roster.filter((person) => {
    if (presence === "here" && !person.checked_in_at) return false
    if (presence === "waiting" && person.checked_in_at) return false
    if (venue && person.venue !== venue) return false
    if (!needle) return true
    return [person.name, person.email, person.team, person.venue, person.role, person.organization]
      .join(" ")
      .toLowerCase()
      .includes(needle)
  })
  const pageSize = 12
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize)

  const scanner = (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div
          className={`relative overflow-hidden rounded-lg ${
            cameraOn ? "bg-black" : "border bg-muted/30"
          }`}
        >
          <div id={regionId} className="min-h-52 w-full" />
          {cameraOn ? null : (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Camera is off. Start it to scan a pass.
            </div>
          )}
        </div>
        {cameraError ? <p className="text-sm text-destructive">{cameraError}</p> : null}
        <div className="flex flex-wrap gap-2">
          {cameraOn ? (
            <Button variant="outline" onClick={() => void stopCamera()} disabled={busy}>
              Stop camera
            </Button>
          ) : (
            <Button onClick={() => void startCamera()} disabled={busy}>
              Start camera
            </Button>
          )}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const scan = manual.trim()
            if (!scan) return
            void submitScan(scan).then(() => setManual(""))
          }}
        >
          <Input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder={manualPlaceholder}
            aria-label={manualLabel}
          />
          <Button type="submit" variant="outline" disabled={busy || !manual.trim()}>
            {submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  )

  const scanResult = result ? (
    <Card>
      <CardHeader>
        <CardDescription>{result.already ? alreadyLabel : freshLabel}</CardDescription>
        <CardTitle className="font-mono text-xl font-normal">{result.teamId}</CardTitle>
        {result.venue ? <p className="text-sm text-muted-foreground">{result.venue}</p> : null}
      </CardHeader>
      <CardContent className="grid gap-2">
        {result.members.map((member) => (
          <div
            key={member.id}
            className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
          >
            <div>
              <p>{member.name}</p>
              <p className="text-sm text-muted-foreground">
                {member.role}
                {member.organization ? ` · ${member.organization}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {member.newly ? <Badge>New</Badge> : null}
              {member.checked_in_at ? <Badge variant="secondary">{joinedLabel}</Badge> : (
                <Badge variant="outline">Waiting</Badge>
              )}
              {member.checked_in_at ? (
                <Button variant="ghost" size="xs" disabled={busy} onClick={() => void undo(member.id)}>
                  Undo
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        <Button onClick={() => void startCamera()} disabled={busy || cameraOn}>
          Scan next
        </Button>
      </CardContent>
    </Card>
  ) : null

  return (
    <div className="grid gap-4 px-4 lg:px-6">
      <div className={`grid gap-3 ${showRoster ? "grid-cols-2 lg:grid-cols-4" : "max-w-xl grid-cols-2"}`}>
        {showRoster ? (
          <>
            <Stat label="QR sent" value={summary?.sent ?? "—"} />
            <Stat label="Checked in" value={summary?.arrived ?? "—"} />
            <Stat label="Not here yet" value={summary?.waiting ?? "—"} />
            <Stat label="Teams here" value={summary?.teams ?? "—"} />
          </>
        ) : (
          <>
            <Stat label={peopleLabel} value={summary?.people ?? "—"} />
            <Stat label={teamsLabel} value={summary?.teams ?? "—"} />
          </>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,24rem)_1fr]">
        {scanner}
        {showRoster ? (
          scanResult || (
            <Card>
              <CardHeader>
                <CardTitle className="font-normal">Door list</CardTitle>
                <CardDescription>
                  Everyone who was sent a team QR is listed below. Scan a pass to mark that team joined.
                </CardDescription>
              </CardHeader>
            </Card>
          )
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="font-normal">{recentTitle}</CardTitle>
              <CardDescription>{recentDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {summary && summary.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">{recentEmpty}</p>
              ) : (
                <div className="max-h-[32rem] overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Venue</TableHead>
                        <TableHead>When</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(summary?.recent || []).map((item) => (
                        <TableRow key={item.registration_id}>
                          <TableCell>
                            <p>{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.role}</p>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {item.team_id_display || item.team_key || "—"}
                          </TableCell>
                          <TableCell>{item.venue || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatWhen(item.checked_in_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {showRoster ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-normal">People with a QR</CardTitle>
            <CardDescription>
              {presence === "waiting"
                ? `${filtered.length} people were sent a QR and have not arrived.`
                : presence === "here"
                  ? `${filtered.length} people are checked in.`
                  : `${filtered.length} people were sent a team QR.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, or team"
                aria-label="Search check-in list"
                className="max-w-sm"
              />
              {(
                [
                  ["all", "All"],
                  ["here", "Checked in"],
                  ["waiting", "Not here yet"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={presence === value ? "default" : "outline"}
                  onClick={() => setPresence(value)}
                >
                  {label}
                </Button>
              ))}
              <select
                className="h-8 rounded-lg border bg-background px-2 text-sm"
                value={venue}
                aria-label="Venue"
                onChange={(event) => setVenue(event.target.value)}
              >
                <option value="">All venues</option>
                {venues.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        {roster.length === 0
                          ? "No one has been sent a team QR yet."
                          : "No one matches this filter."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    visible.map((person) => (
                      <TableRow key={person.id}>
                        <TableCell>
                          <p>{person.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {person.role}
                            {person.organization ? ` · ${person.organization}` : ""}
                          </p>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{person.team || "—"}</TableCell>
                        <TableCell>{person.venue || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={person.checked_in_at ? "secondary" : "outline"}>
                            {person.checked_in_at ? "Checked in" : "Not here yet"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {person.checked_in_at ? formatWhen(person.checked_in_at) : "—"}
                        </TableCell>
                        <TableCell>
                          {person.checked_in_at ? (
                            <Button
                              variant="ghost"
                              size="xs"
                              disabled={busy}
                              onClick={() => void undo(person.id)}
                            >
                              Undo
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <p>
                Page {safePage + 1} of {pageCount}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage === 0}
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
