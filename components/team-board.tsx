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

function peopleOf(team: Team) {
  return [...team.members].sort((a, b) => {
    const aLead = a.role.toLowerCase() === "lead" ? 0 : 1
    const bLead = b.role.toLowerCase() === "lead" ? 0 : 1
    if (aLead !== bLead) return aLead - bLead
    return a.name.localeCompare(b.name)
  })
}

function linkFor(label: string, value: string) {
  if (label === "Email" && value.includes("@")) return `mailto:${value}`
  if (label === "Phone") {
    const digits = value.replace(/[^\d+]/g, "")
    return digits ? `tel:${digits}` : ""
  }
  if (/^https?:\/\//i.test(value)) return value
  if (label === "GitHub" && value && !value.includes(" ")) {
    return value.startsWith("http") ? value : `https://github.com/${value.replace(/^@/, "")}`
  }
  if (label === "LinkedIn" && value.startsWith("http")) return value
  return ""
}

function when(value: string | null) {
  if (!value) return ""
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return ""
  return time.toLocaleString()
}

function initial(name: string) {
  const letter = name.trim().charAt(0)
  return letter ? letter.toUpperCase() : "?"
}

const PROFILE_FIELDS: Array<[keyof Registration, string]> = [
  ["email", "Email"],
  ["phone", "Phone"],
  ["organization", "College or company"],
  ["participation", "Participation"],
  ["are_you", "Are you"],
  ["city", "Chosen location"],
  ["metro", "City"],
  ["experience", "Experience"],
  ["address", "Address"],
  ["github", "GitHub"],
  ["linkedin", "LinkedIn"],
]

function Fact({ label, value }: { label: string; value: string }) {
  const text = value.trim()
  const shown = text || "Not added"
  const target = text ? linkFor(label, text) : ""
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-sm break-words ${text ? "" : "text-muted-foreground"}`}>
        {target ? (
          <a
            href={target}
            target={target.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            className="underline"
          >
            {shown}
          </a>
        ) : (
          shown
        )}
      </dd>
    </div>
  )
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: "ok" | "wait" | "muted" | "warn"
}) {
  const toneClass = {
    ok: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
    wait: "bg-amber-500/20 text-amber-950 dark:text-amber-100",
    warn: "bg-rose-500/15 text-rose-900 dark:text-rose-100",
    muted: "bg-muted text-muted-foreground",
  }[tone]
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs ${toneClass}`}>{children}</span>
  )
}

function rsvpPill(member: Registration) {
  if (member.rsvp_status === "confirmed") {
    return <Pill tone="ok">Confirmed — they clicked I&apos;m in</Pill>
  }
  if (member.rsvp_status === "sent") {
    return <Pill tone="wait">Invite mailed — waiting for I&apos;m in</Pill>
  }
  return <Pill tone="muted">RSVP not mailed</Pill>
}

function rejectPill(member: Registration) {
  if (member.reject_status === "sent") return <Pill tone="warn">Reject mailed</Pill>
  return <Pill tone="muted">No reject mail</Pill>
}

function qrPill(member: Registration) {
  if (member.qr_status === "sent") return <Pill tone="ok">QR mailed</Pill>
  if (member.qr_status === "generated") return <Pill tone="wait">QR ready, not mailed</Pill>
  return <Pill tone="muted">QR not sent</Pill>
}

function registrationPill(member: Registration) {
  if (member.registration_mail_status === "sent") {
    return <Pill tone="ok">Registration mail sent</Pill>
  }
  return <Pill tone="muted">Registration mail not sent</Pill>
}

export function TeamBoard({
  teams,
  canManage = false,
  busy = false,
  onRsvp,
  onReject,
  onSendQr,
}: {
  teams: Team[]
  canManage?: boolean
  busy?: boolean
  onRsvp?: (ids: string[], force?: boolean) => void
  onReject?: (ids: string[], force?: boolean) => void
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
          const people = peopleOf(team)
          const venue = mailVenue(team.location, team.metro)
          const confirmed = people.filter((person) => person.rsvp_status === "confirmed").length
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
                    {people.length} {people.length === 1 ? "person" : "people"}
                  </CardTitle>
                  <Badge variant="outline">{team.team_id_display || "No team id"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {venue.label}
                  {confirmed ? ` · ${confirmed} confirmed` : ""}
                </p>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2">
                  {people.map((person) => (
                    <li key={person.id} className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                        {initial(person.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{person.name || "Untitled"}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {person.role || "Role not added"}
                          {person.organization ? ` · ${person.organization}` : ""}
                        </span>
                      </span>
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
        onReject={onReject}
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
  onReject,
  onSendQr,
}: {
  team: Team | null
  canManage: boolean
  busy: boolean
  onClose: () => void
  onRsvp?: (ids: string[], force?: boolean) => void
  onReject?: (ids: string[], force?: boolean) => void
  onSendQr?: (ids: string[], force?: boolean) => void
}) {
  const venue = team ? mailVenue(team.location, team.metro) : null
  const people = team ? peopleOf(team) : []
  const ids = people.map((member) => member.id)
  const rsvpSent = people.some((member) => member.rsvp_status !== "none")
  const rejectSent = people.some((member) => member.reject_status === "sent")
  const qrSent = people.some((member) => member.qr_status === "sent")
  const registeredAs =
    team && venue && team.location && team.location !== venue.label ? team.location : ""

  return (
    <Sheet open={Boolean(team)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto font-normal font-sans antialiased data-[side=right]:sm:max-w-3xl">
        {team && venue ? (
          <>
            <SheetHeader>
              <SheetTitle className="font-normal font-sans text-lg">
                {people.length} {people.length === 1 ? "person" : "people"} on this team
              </SheetTitle>
              <SheetDescription>
                {team.team_id_display || "No team id"} · {venue.label} · {team.team_status}
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-5 px-4 pb-6">
              <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
                <Fact label="Lead" value={team.lead_name} />
                <Fact label="Lead email" value={team.lead_email} />
                <Fact
                  label="Seats"
                  value={
                    team.expected_size
                      ? `${team.registered_count} of ${team.expected_size} registered`
                      : `${team.registered_count} registered`
                  }
                />
                <Fact label="They chose" value={registeredAs || team.location || venue.label} />
                <Fact label="Mail sends" value={venue.label} />
                {venue.mapUrl ? null : (
                  <Fact label="Map" value={venue.note || "No map for this location"} />
                )}
                {venue.mapUrl ? (
                  <a href={venue.mapUrl} target="_blank" rel="noreferrer" className="text-sm underline">
                    Open the location map
                  </a>
                ) : null}
              </section>

              <section className="grid gap-3">
                {people.map((member, index) => (
                  <PersonProfile key={member.id} member={member} index={index + 1} total={people.length} />
                ))}
              </section>

              {canManage ? (
                <div className="grid gap-2 sm:grid-cols-3">
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
                          One email goes to every person on {team.team_id_display || "this team"}.
                          Location in the mail: {venue.label}. Teammates are CC&apos;d. Confirmed
                          means they clicked I&apos;m in.
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
                      <Button variant="outline" disabled={busy || !onReject}>
                        {rejectSent ? "Send reject again" : "Send reject"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {rejectSent ? "Resend the reject mail?" : "Send the reject mail?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This thanks everyone on {team.team_id_display || "this team"} and says we
                          hope to see them at Fetch-A-Thon 4.0. RSVP status stays as it is.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onReject?.(ids, rejectSent)}>
                          {rejectSent ? "Send again" : "Send reject"}
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
                          This generates the venue QR if needed and emails everyone on{" "}
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

function PersonProfile({
  member,
  index,
  total,
}: {
  member: Registration
  index: number
  total: number
}) {
  return (
    <article className="grid gap-4 rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm">
          {initial(member.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base">{member.name || "Untitled"}</p>
          <p className="text-sm text-muted-foreground">
            Person {index} of {total}
            {member.role ? ` · ${member.role}` : ""}
            {member.status ? ` · ${member.status}` : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {rsvpPill(member)}
        {rejectPill(member)}
        {qrPill(member)}
        {registrationPill(member)}
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        {PROFILE_FIELDS.map(([key, label]) => (
          <Fact key={key} label={label} value={String(member[key] || "")} />
        ))}
        <Fact label="Skills" value={member.skills.join(", ")} />
        {member.rsvp_sent_at ? <Fact label="Invite mailed" value={when(member.rsvp_sent_at)} /> : null}
        {member.reject_sent_at ? (
          <Fact label="Reject mailed" value={when(member.reject_sent_at)} />
        ) : null}
        {member.qr_sent_at ? <Fact label="QR mailed" value={when(member.qr_sent_at)} /> : null}
      </dl>
    </article>
  )
}
