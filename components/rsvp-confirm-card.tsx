"use client"

import * as React from "react"

import { FetchathonLogo } from "@/components/fetchathon-logo"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function RsvpConfirmCard({
  token,
  teamId,
  venue,
  note,
  imageUrl,
  members,
  already,
  later = false,
}: {
  token: string
  teamId: string
  venue: string
  note: string
  imageUrl?: string | null
  members: Array<{ name: string; role: string }>
  already: boolean
  later?: boolean
}) {
  const [done, setDone] = React.useState(already)
  const [message, setMessage] = React.useState(
    already ? "This team is already confirmed." : "",
  )
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/rsvp/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const payload = (await response.json()) as { error?: string; note?: string; already?: boolean }
      if (!response.ok) {
        setError(payload.error || "Could not confirm")
        return
      }
      setDone(true)
      setMessage(payload.note || "Your seat is confirmed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="w-full max-w-xl shadow-xs">
      <CardHeader className="gap-4">
        <FetchathonLogo />
        <div>
          <CardDescription>Fetch-A-Thon 3.0 seat confirmation</CardDescription>
          <CardTitle className="font-mono text-2xl">{teamId}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Venue</p>
          <p className="font-medium">{venue}</p>
          {note ? <p className="mt-1 text-sm text-muted-foreground">{note}</p> : null}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Buildfin building at the updated Gurugram location"
              className="mt-3 w-full rounded-lg"
            />
          ) : null}
        </div>
        <ul className="grid gap-2">
          {members.map((member) => (
            <li key={`${member.name}-${member.role}`} className="rounded-lg border px-3 py-2">
              <p className="font-medium">{member.name}</p>
              <p className="text-sm text-muted-foreground">{member.role}</p>
            </li>
          ))}
        </ul>
        {later && !done ? (
          <p className="text-sm text-muted-foreground">
            You picked next time. Your seat stays open if you can still make it.
          </p>
        ) : null}
        {done ? (
          <p className="text-sm font-medium">{message}</p>
        ) : (
          <Button onClick={() => void confirm()} disabled={busy}>
            {busy ? "Confirming…" : "Absolutely, I'm In!"}
          </Button>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}

export function RsvpConfirmMissing() {
  return (
    <Card className="w-full max-w-xl shadow-xs">
      <CardHeader>
        <FetchathonLogo />
        <CardTitle>Link not found</CardTitle>
        <CardDescription>This confirmation link is not a valid Fetch-A-Thon RSVP.</CardDescription>
      </CardHeader>
    </Card>
  )
}
