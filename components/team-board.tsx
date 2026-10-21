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
import { Checkbox } from "@/components/ui/checkbox"
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
      <dd className={`min-w-0 text-sm break-all [overflow-wrap:anywhere] ${text ? "" : "text-muted-foreground"}`}>
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

function rsvpPill(member: Registration, compact = false) {
  if (member.rsvp_status === "confirmed") {
    return <Pill tone="ok">{compact ? "Confirmed" : "Confirmed — they clicked I'm in"}</Pill>
  }
  if (member.rsvp_status === "sent") {
    return <Pill tone="wait">{compact ? "RSVP mailed" : "RSVP mailed"}</Pill>
  }
  return <Pill tone="muted">{compact ? "Not mailed" : "RSVP not mailed"}</Pill>
}

function reviewPill(member: Registration) {
  if (member.review_status === "reviewed") return <Pill tone="ok">Reviewed</Pill>
  return <Pill tone="warn">Review pending</Pill>
}

function readyForConfirm(person: Registration) {
  return (
    person.reject_status !== "sent" &&
    person.rsvp_status === "confirmed" &&
    person.qr_status !== "sent"
  )
}

function bucketOf(team: Team) {
  const people = team.members
  if (people.length > 0 && people.every((person) => person.reject_status === "sent")) return "rejected"
  if (people.length > 0 && people.every((person) => person.qr_status === "sent")) return "confirmed"
  if (people.some(readyForConfirm)) return "rsvpConfirmed"
  if (people.length > 0 && people.every((person) => person.rsvp_status !== "none")) return "sent"
  if (people.length > 0 && people.every((person) => person.review_status === "reviewed")) {
    return "reviewed"
  }
  return "pending"
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
  onMarkReview,
  onRsvp,
  onReject,
  onSendQr,
}: {
  teams: Team[]
  canManage?: boolean
  busy?: boolean
  onMarkReview?: (ids: string[], status: "pending" | "reviewed") => void
  onRsvp?: (ids: string[], force?: boolean) => void
  onReject?: (ids: string[], force?: boolean) => void
  onSendQr?: (ids: string[], force?: boolean, onlySelected?: boolean) => void
}) {
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [picked, setPicked] = React.useState<string[]>([])
  const [section, setSection] = React.useState<
    "pending" | "reviewed" | "sent" | "rsvpConfirmed" | "confirmed" | "rejected"
  >("pending")
  const selected = teams.find((team) => teamKey(team) === openId) || null
  const pickedSet = new Set(picked)
  const pending = teams.filter((team) => bucketOf(team) === "pending")
  const reviewed = teams.filter((team) => bucketOf(team) === "reviewed")
  const sent = teams.filter((team) => bucketOf(team) === "sent")
  const rsvpConfirmed = teams.filter((team) => bucketOf(team) === "rsvpConfirmed")
  const confirmed = teams.filter((team) => bucketOf(team) === "confirmed")
  const rejected = teams.filter((team) => bucketOf(team) === "rejected")
  const sections = [
    {
      id: "pending" as const,
      title: "Review pending",
      hint: "Not reviewed yet. Select a team and mark it before the RSVP goes out.",
      teams: pending,
    },
    {
      id: "reviewed" as const,
      title: "Reviewed",
      hint: "Ready for the RSVP button. People already mailed stay marked and are skipped.",
      teams: reviewed,
    },
    {
      id: "sent" as const,
      title: "RSVP sent",
      hint: "These teams were mailed and are still waiting. Nobody here has confirmed yet.",
      teams: sent,
    },
    {
      id: "rsvpConfirmed" as const,
      title: "RSVP confirmed",
      hint: "Someone on these teams clicked I'm in. Send confirm mails only those people.",
      teams: rsvpConfirmed,
    },
    {
      id: "confirmed" as const,
      title: "Confirm mailed",
      hint: "These teams already received the confirm mail with the venue QR.",
      teams: confirmed,
    },
    {
      id: "rejected" as const,
      title: "Reject mailed",
      hint: "These teams already received the reject mail.",
      teams: rejected,
    },
  ]
  const active = sections.find((item) => item.id === section) || sections[0]
  const pickedTeams = teams.filter((team) => pickedSet.has(teamKey(team)))
  const markIds = pickedTeams
    .filter((team) => bucketOf(team) === "pending")
    .flatMap((team) => team.members.map((member) => member.id))
  const unmarkIds = pickedTeams
    .filter((team) => bucketOf(team) === "reviewed")
    .flatMap((team) => team.members.map((member) => member.id))
  const sendIds = reviewed.flatMap((team) =>
    team.members.filter((member) => member.rsvp_status === "none").map((member) => member.id),
  )
  const confirmPool = pickedTeams.length ? pickedTeams : rsvpConfirmed
  const confirmIds = confirmPool.flatMap((team) =>
    team.members.filter(readyForConfirm).map((member) => member.id),
  )

  const toggle = (key: string, on: boolean) => {
    setPicked((current) => {
      const next = new Set(current)
      if (on) next.add(key)
      else next.delete(key)
      return [...next]
    })
  }

  if (teams.length === 0) {
    return (
      <p className="px-4 font-normal font-sans text-sm text-muted-foreground antialiased lg:px-6">
        No teams in the current filter.
      </p>
    )
  }

  return (
    <div className="grid gap-4 font-normal font-sans antialiased">
      <div className="sticky top-0 z-10 grid gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur lg:px-6">
        <div className="flex flex-wrap gap-2">
          {sections.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={item.id === active.id ? "default" : "outline"}
              onClick={() => setSection(item.id)}
            >
              {item.title}
              <span className="ml-1 tabular-nums">{item.teams.length}</span>
            </Button>
          ))}
        </div>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={busy || markIds.length === 0 || !onMarkReview}
            onClick={() => {
              onMarkReview?.(markIds, "reviewed")
              setPicked([])
            }}
          >
            Mark reviewed{markIds.length ? ` (${markIds.length})` : ""}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={busy || sendIds.length === 0 || !onRsvp}>
                Send RSVP{sendIds.length ? ` (${sendIds.length})` : ""}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send RSVP to reviewed teams?</AlertDialogTitle>
                <AlertDialogDescription>
                  This mails {sendIds.length} {sendIds.length === 1 ? "person" : "people"} in
                  Reviewed who have not received an RSVP. Anyone already mailed is left out.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onRsvp?.(sendIds, false)
                    setPicked([])
                  }}
                >
                  Send RSVP
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="outline"
            disabled={busy || unmarkIds.length === 0 || !onMarkReview}
            onClick={() => {
              onMarkReview?.(unmarkIds, "pending")
              setPicked([])
            }}
          >
            Back to pending
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={busy || confirmIds.length === 0 || !onSendQr}>
                Send confirm{confirmIds.length ? ` (${confirmIds.length})` : ""}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send the confirm mail?</AlertDialogTitle>
                <AlertDialogDescription>
                  This sends the confirm mail and venue QR to {confirmIds.length}{" "}
                  {confirmIds.length === 1 ? "person who has" : "people who have"} confirmed
                  their RSVP
                  {pickedTeams.length
                    ? " on the selected teams"
                    : " and have not received it yet"}
                  . Each mail uses the location they chose. Anyone already mailed is left out.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onSendQr?.(confirmIds, false, true)
                    setPicked([])
                  }}
                >
                  Send confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <p className="text-sm text-muted-foreground">
            Select teams to limit a send. Send RSVP covers reviewed people. Send confirm covers
            people who already clicked I&apos;m in.
          </p>
        </div>
      ) : null}
      </div>

      <TeamSection
        hint={active.hint}
        teams={active.teams}
        picked={pickedSet}
        onToggle={toggle}
        onOpen={setOpenId}
      />

      <TeamSheet
        team={selected}
        canManage={canManage}
        busy={busy}
        onClose={() => setOpenId(null)}
        onMarkReview={onMarkReview}
        onReject={onReject}
        onSendQr={onSendQr}
      />
    </div>
  )
}

function TeamSection({
  hint,
  teams,
  picked,
  onToggle,
  onOpen,
}: {
  hint: string
  teams: Team[]
  picked: Set<string>
  onToggle: (key: string, on: boolean) => void
  onOpen: (key: string) => void
}) {
  return (
    <section className="grid gap-3">
      <div className="px-4 lg:px-6">
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {teams.length === 0 ? (
        <p className="px-4 text-sm text-muted-foreground lg:px-6">None in this section.</p>
      ) : (
        <div className="grid gap-3 px-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 lg:px-6">
          {teams.map((team) => (
            <TeamCard
              key={teamKey(team)}
              team={team}
              picked={picked.has(teamKey(team))}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function TeamCard({
  team,
  picked,
  onToggle,
  onOpen,
}: {
  team: Team
  picked: boolean
  onToggle: (key: string, on: boolean) => void
  onOpen: (key: string) => void
}) {
  const key = teamKey(team)
  const people = peopleOf(team)
  const venue = mailVenue(team.location, team.metro)
  const mailed = people.filter((person) => person.rsvp_status === "sent").length
  const confirmed = people.filter((person) => person.rsvp_status === "confirmed").length
  const waiting = people.filter((person) => person.rsvp_status === "none").length
  const confirmMailed = people.filter((person) => person.qr_status === "sent").length
  return (
    <Card
      role="button"
      tabIndex={0}
      className="cursor-pointer transition-colors hover:bg-accent/40"
      onClick={() => onOpen(key)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(key)
        }
      }}
    >
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Checkbox
              checked={picked}
              onClick={(event) => event.stopPropagation()}
              onCheckedChange={(value) => onToggle(key, value === true)}
              aria-label={`Select ${team.team_id_display || "team"}`}
            />
            <CardTitle className="font-normal font-sans text-base">
              {people.length} {people.length === 1 ? "person" : "people"}
            </CardTitle>
          </div>
          <Badge variant="outline">{team.team_id_display || "No team id"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {venue.label}
          {mailed ? ` · ${mailed} RSVP mailed` : ""}
          {confirmed ? ` · ${confirmed} confirmed` : ""}
          {confirmMailed ? ` · ${confirmMailed} confirm mailed` : ""}
          {waiting ? ` · ${waiting} not mailed` : ""}
        </p>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-1">
          {people.map((person) => (
            <li key={person.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">{person.name || "Untitled"}</span>
              <span className="shrink-0">
                {person.reject_status === "sent" ? (
                  <Pill tone="warn">Rejected</Pill>
                ) : person.qr_status === "sent" ? (
                  <Pill tone="ok">Confirm mailed</Pill>
                ) : (
                  rsvpPill(person, true)
                )}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function TeamSheet({
  team,
  canManage,
  busy,
  onClose,
  onMarkReview,
  onReject,
  onSendQr,
}: {
  team: Team | null
  canManage: boolean
  busy: boolean
  onClose: () => void
  onMarkReview?: (ids: string[], status: "pending" | "reviewed") => void
  onReject?: (ids: string[], force?: boolean) => void
  onSendQr?: (ids: string[], force?: boolean, onlySelected?: boolean) => void
}) {
  const venue = team ? mailVenue(team.location, team.metro) : null
  const people = team ? peopleOf(team) : []
  const [editNote, setEditNote] = React.useState<string | null>(null)
  const copyEditLink = async () => {
    const id = people[0]?.id
    if (!id) return
    setEditNote(null)
    const response = await fetch("/api/team-edit/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    const payload = (await response.json()) as { url?: string; error?: string }
    if (!response.ok || !payload.url) {
      setEditNote(payload.error || "Could not make the team link")
      return
    }
    try {
      await navigator.clipboard.writeText(payload.url)
      setEditNote("Team edit link copied.")
    } catch {
      setEditNote(payload.url)
    }
  }
  const ids = people.map((member) => member.id)
  const reviewed = people.length > 0 && people.every((member) => member.review_status === "reviewed")
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
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => void copyEditLink()}>
                      Copy team edit link
                    </Button>
                    {editNote ? (
                      <p className="min-w-0 text-sm break-all text-muted-foreground">{editNote}</p>
                    ) : null}
                  </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button
                    disabled={busy || !onMarkReview}
                    onClick={() => onMarkReview?.(ids, reviewed ? "pending" : "reviewed")}
                  >
                    {reviewed ? "Back to pending" : "Mark reviewed"}
                  </Button>
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
    <article className="grid min-w-0 gap-4 overflow-hidden rounded-2xl border bg-card p-4">
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
        {reviewPill(member)}
        {rsvpPill(member)}
        {rejectPill(member)}
        {qrPill(member)}
        {registrationPill(member)}
      </div>
      <dl className="grid min-w-0 gap-3">
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
