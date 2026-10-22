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
import type { CheckInRecord } from "@/lib/checkin-store"
import type { CheckInMember } from "@/lib/checkin"

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

  return (
    <div className="grid gap-4 px-4 lg:grid-cols-[minmax(0,28rem)_1fr] lg:px-6">
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Card size="sm">
            <CardHeader>
              <CardDescription>{peopleLabel}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {summary?.people ?? "—"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>{teamsLabel}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {summary?.teams ?? "—"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="relative overflow-hidden rounded-xl bg-black">
              <div id={regionId} className="min-h-64 w-full" />
              {cameraOn ? null : (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/70">
                  Camera is off. Start it to scan a pass.
                </div>
              )}
            </div>
            {cameraError ? (
              <p className="text-sm text-destructive">{cameraError}</p>
            ) : null}
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
              className="grid gap-2"
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
                placeholder="Or paste the pass link"
                aria-label="Pass link"
              />
              <Button type="submit" variant="outline" disabled={busy || !manual.trim()}>
                {submitLabel}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid content-start gap-4">
        {result ? (
          <Card>
            <CardHeader>
              <CardDescription>
                {result.already ? alreadyLabel : freshLabel}
              </CardDescription>
              <CardTitle className="font-mono text-xl">{result.teamId}</CardTitle>
              {result.venue ? (
                <p className="text-sm text-muted-foreground">{result.venue}</p>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-3">
              {result.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-start justify-between gap-3 rounded-lg border px-3 py-3"
                >
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {member.role}
                      {member.organization ? ` · ${member.organization}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.checked_in_at
                        ? `${joinedLabel} ${formatWhen(member.checked_in_at)}`
                        : `Not ${joinedLabel.toLowerCase()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.newly ? <Badge>New</Badge> : null}
                    {member.checked_in_at ? (
                      <Badge variant={member.newly ? "secondary" : "outline"}>
                        {joinedLabel}
                      </Badge>
                    ) : null}
                    {member.checked_in_at ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={busy}
                        onClick={() => void undo(member.id)}
                      >
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
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{recentTitle}</CardTitle>
            <CardDescription>{recentDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {summary && summary.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">{recentEmpty}</p>
            ) : (
              <ul className="grid gap-2">
                {(summary?.recent || []).map((item) => (
                  <li
                    key={item.registration_id}
                    className="flex items-baseline justify-between gap-3 border-b py-2 last:border-b-0"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.team_id_display || item.team_key}
                        {item.venue ? ` · ${item.venue}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {formatWhen(item.checked_in_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
