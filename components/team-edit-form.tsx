"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type TeamEditMember = {
  id: string
  name: string
  email: string
  phone: string
  role: string
}

export function TeamEditForm({
  token,
  teamId,
  venue,
  members,
}: {
  token: string
  teamId: string
  venue: string
  members: TeamEditMember[]
}) {
  const [people, setPeople] = React.useState(members)
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [note, setNote] = React.useState<string | null>(null)

  const send = async (body: Record<string, string>) => {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const response = await fetch(`/api/team-edit/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as {
        error?: string
        team?: { members: TeamEditMember[] }
      }
      if (!response.ok || !payload.team) {
        setError(payload.error || "Could not update the team")
        return
      }
      setPeople(payload.team.members)
      setName("")
      setEmail("")
      setPhone("")
      setNote(body.action === "remove" ? "Teammate removed." : "Teammate added.")
    } catch {
      setError("Could not update the team")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="w-full max-w-lg font-normal font-sans antialiased">
      <CardHeader>
        <CardTitle>Update your team</CardTitle>
        <CardDescription>
          {teamId}
          {venue ? ` · ${venue}` : ""}. A team can have up to 4 people. Changes save to the
          registration.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <ul className="grid gap-2">
          {people.map((person) => (
            <li key={person.id} className="flex items-center gap-3 rounded-xl border px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{person.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {person.role || "Member"}
                  {person.email ? ` · ${person.email}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || people.length <= 1}
                onClick={() => {
                  if (!window.confirm(`Remove ${person.name} from this team?`)) return
                  void send({ action: "remove", id: person.id })
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>

        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void send({ action: "add", name, email, phone })
          }}
        >
          <p className="text-sm font-medium">Add a teammate</p>
          <div className="grid gap-2">
            <Label htmlFor="teammate-name">Name</Label>
            <Input
              id="teammate-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="teammate-email">Email</Label>
            <Input
              id="teammate-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="teammate-phone">Phone</Label>
            <Input
              id="teammate-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={20}
            />
          </div>
          <Button type="submit" disabled={busy || people.length >= 4}>
            {busy ? "Saving..." : "Add teammate"}
          </Button>
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      </CardContent>
    </Card>
  )
}
