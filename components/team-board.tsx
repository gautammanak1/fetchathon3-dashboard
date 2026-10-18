"use client"

import * as React from "react"

import { mailVenue } from "@/lib/event-venues"
import type { Registration, Team } from "@/lib/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

function teamKey(team: Team) {
  return team.team_id || team.lead_email || team.lead_name
}

function statusLabel(kind: "rsvp" | "qr", value: string) {
  if (kind === "rsvp") {
    if (value === "confirmed") return "Confirmed"
    if (value === "sent") return "Sent"
    return "Not sent"
  }
  if (value === "sent") return "Sent"
  if (value === "generated") return "Generated"
  return "Not sent"
}

const PERSON_FIELDS: Array<[keyof Registration, string]> = [
  ["email", "Email"],
  ["phone", "Phone"],
  ["organization", "Organization"],
  ["participation", "Participation"],
  ["are_you", "Are you"],
  ["city", "Location"],
  ["metro", "City"],
  ["experience", "Experience"],
  ["address", "Address"],
  ["github", "GitHub"],
  ["linkedin", "LinkedIn"],
]

function linkFor(label: string, value: string) {
  if (label.toLowerCase().includes("email") && value.includes("@")) return `mailto:${value}`
  if (label === "Phone") {
    const digits = value.replace(/[^\d+]/g, "")
    return digits ? `tel:${digits}` : ""
  }
  if (/^https?:\/\//i.test(value)) return value
  return ""
}

function when(value: string | null) {
  if (!value) return ""
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return ""
  return time.toLocaleString()
}

function Fact({ label, value, href }: { label: string; value: string; href?: string }) {
  const text = value.trim()
  if (!text) return null
  const target = href || linkFor(label, text)
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-all text-sm">
        {target ? (
          <a href={target} target={target.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="underline">
            {text}
          </a>
        ) : (
          text
        )}
      </dd>
    </div>
  )
}

export function TeamBoard({
  teams,
  canManage = false,
  busy = false,
  onRsvp,
  onSendQr,
}: {
  teams: Team[]
  canManage?: boolean
  busy?: boolean
  onRsvp?: (ids: string[], force?: boolean) => void
  onSendQr?: (ids: string[], force?: boolean) => void
}) {
  const [openId, setOpenId] = React.useState<string | null>(null)
  const selected = teams.find((team) => teamKey(team) === openId) || null

  if (teams.length === 0) {
    return (
      <p className="px-4 font-normal font-sans text-sm text-muted-foreground antialiased lg:px-6">
        No teams in the current filter.
      </p>
    )
  }

  return (
    <div className="font-normal font-sans antialiased">
      <div className="grid gap-4 px-4 md:grid-cols-2 xl:grid-cols-3 lg:px-6">
        {teams.map((team) => {
          const expected = team.expected_size || team.registered_count || 1
          const width = Math.min(100, Math.round((team.registered_count / expected) * 100))
          const venue = mailVenue(team.location, team.metro)
          return (
            <Card
              key={teamKey(team)}
              role="button"
              tabIndex={0}
              className="cursor-pointer transition-colors hover:bg-accent/40"
              onClick={() => setOpenId(teamKey(team))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  setOpenId(teamKey(team))
                }
              }}
            >
              <CardHeader className="gap-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="font-normal font-sans text-base">
                    {team.team_id_display || "No team id"}
                  </CardTitle>
                  <Badge variant="outline">{team.team_status.split(" ")[0]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {team.lead_name} · {venue.label}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>
                      {team.registered_count}
                      {team.expected_size ? ` / ${team.expected_size}` : ""} registered
                    </span>
                    <span>
                      {team.seats_remaining === null
                        ? "size pending"
                        : `${team.seats_remaining} seats left`}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-foreground" style={{ width: `${width}%` }} />
                  </div>
                </div>
                <ul className="space-y-2 text-sm">
                  {team.members.map((member) => (
                    <li key={member.id} className="flex items-center justify-between gap-2">
                      <span>
                        {member.name}
                        <span className="ml-2 text-xs text-muted-foreground">{member.role}</span>
                      </span>
                      <Badge variant="outline">{member.status || "—"}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <TeamSheet
        team={selected}
        canManage={canManage}
        busy={busy}
        onClose={() => setOpenId(null)}
        onRsvp={onRsvp}
        onSendQr={onSendQr}
      />
    </div>
  )
}

function TeamSheet({
  team,
  canManage,
  busy,
  onClose,
  onRsvp,
  onSendQr,
}: {
  team: Team | null
  canManage: boolean
  busy: boolean
  onClose: () => void
  onRsvp?: (ids: string[], force?: boolean) => void
  onSendQr?: (ids: string[], force?: boolean) => void
}) {
  const venue = team ? mailVenue(team.location, team.metro) : null
  const ids = team?.members.map((member) => member.id) || []
  const rsvpSent = Boolean(team?.members.some((member) => member.rsvp_status !== "none"))
  const qrSent = Boolean(team?.members.some((member) => member.qr_status === "sent"))
  const registeredAs =
    team && venue && team.location && team.location !== venue.label ? team.location : ""

  return (
    <Sheet open={Boolean(team)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto font-normal font-sans antialiased sm:max-w-xl">
        {team && venue ? (
          <>
            <SheetHeader>
              <SheetTitle className="font-normal font-sans text-lg">
                {team.team_id_display || "Team"}
              </SheetTitle>
              <SheetDescription>
                {team.lead_name} · {team.members.length}{" "}
                {team.members.length === 1 ? "person" : "people"}
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-5 px-4 pb-6">
              <section className="rounded-2xl border bg-card p-4">
                <p className="text-sm text-muted-foreground">Team</p>
                <dl className="mt-3 grid gap-3">
                  <Fact label="Team ID" value={team.team_id_display} />
                  <Fact label="Status" value={team.team_status} />
                  <Fact label="Lead" value={team.lead_name} />
                  <Fact label="Lead email" value={team.lead_email} />
                  <Fact
                    label="Registered"
                    value={
                      team.expected_size
                        ? `${team.registered_count} / ${team.expected_size}`
                        : String(team.registered_count)
                    }
                  />
                  <Fact
                    label="Seats left"
                    value={team.seats_remaining === null ? "Size pending" : String(team.seats_remaining)}
                  />
                  <Fact label="Chosen location" value={registeredAs || team.location || venue.label} />
                  <Fact label="RSVP location" value={venue.label} />
                </dl>
                {registeredAs ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    They chose {registeredAs}. The mail sends {venue.label}.
                  </p>
                ) : venue.note ? (
                  <p className="mt-3 text-sm text-muted-foreground">{venue.note}</p>
                ) : null}
                {venue.mapUrl ? (
                  <a
                    href={venue.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm underline"
                  >
                    Open map
                  </a>
                ) : null}
              </section>

              <section className="grid gap-3">
                <p className="text-sm text-muted-foreground">People</p>
                <ul className="grid gap-3">
                  {team.members.map((member) => (
                    <MemberRow key={member.id} member={member} />
                  ))}
                </ul>
              </section>

              {canManage ? (
                <div className="grid gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={busy || !onRsvp}>
                        {rsvpSent ? "Send RSVP again" : "Send RSVP"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {rsvpSent ? "Resend this team's RSVP?" : "Send this team's RSVP?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          One email goes to {team.team_id_display || "this team"} using the RSVP
                          template. Location in the mail: {venue.label}. Teammates are CC'd.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onRsvp?.(ids, rsvpSent)}>
                          {rsvpSent ? "Send again" : "Send RSVP"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" disabled={busy || !onSendQr}>
                        {qrSent ? "Send QR again" : "Confirm and send QR"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {qrSent ? "Resend the team QR?" : "Send the team QR?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This generates the venue QR if needed and emails{" "}
                          {team.team_id_display || "this team"}. The pass says {venue.label}.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onSendQr?.(ids, qrSent)}>
                          {qrSent ? "Send again" : "Send QR"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function MemberRow({ member }: { member: Registration }) {
  const registrationSent = when(member.registration_mail_sent_at)
  const rsvpSent = when(member.rsvp_sent_at)
  const qrSent = when(member.qr_sent_at)
  return (
    <li className="grid gap-3 rounded-2xl border px-3 py-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span>
          {member.name || "Untitled"}
          <span className="ml-2 text-xs text-muted-foreground">{member.role}</span>
        </span>
        <Badge variant="outline">{member.status || "—"}</Badge>
      </div>
      <dl className="grid gap-3">
        {PERSON_FIELDS.map(([key, label]) => (
          <Fact key={key} label={label} value={String(member[key] || "")} />
        ))}
        {member.skills.length > 0 ? <Fact label="Skills" value={member.skills.join(", ")} /> : null}
        <Fact
          label="Registration mail"
          value={
            member.registration_mail_status === "sent"
              ? `Sent${registrationSent ? ` · ${registrationSent}` : ""}`
              : "Not sent"
          }
        />
        <Fact
          label="RSVP"
          value={`${statusLabel("rsvp", member.rsvp_status)}${rsvpSent ? ` · ${rsvpSent}` : ""}`}
        />
        <Fact
          label="QR"
          value={`${statusLabel("qr", member.qr_status)}${qrSent ? ` · ${qrSent}` : ""}`}
        />
      </dl>
    </li>
  )
}
