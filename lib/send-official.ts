import { readableName } from "@/lib/compose-mail"
import { mailVenue } from "@/lib/event-venues"
import { mailMeta, persistMailRecords } from "@/lib/mail-db"
import { loadRoster } from "@/lib/roster"
import { resultNote, sendRejectEmails, sendRsvpEmails } from "@/lib/send-bulk"
import { EMAIL_RE } from "@/lib/smtp"
import { teamMailGroups } from "@/lib/team-mail"
import type { Registration } from "@/lib/types"
import type { ComposeAudience } from "@/lib/send-compose"

function eventLocation(row: Registration) {
  return mailVenue(row.city, row.metro).label
}

function matches(row: Registration, audience: ComposeAudience) {
  if (audience.kind === "roster") return true
  if (audience.kind === "venue") {
    return eventLocation(row).toLowerCase() === audience.venue.trim().toLowerCase()
  }
  const wanted = new Set(
    audience.emails
      .split(/[\s,;]+/)
      .map((item) => item.trim().toLowerCase())
      .filter((item) => EMAIL_RE.test(item)),
  )
  return wanted.has(row.email.trim().toLowerCase())
}

export async function sendOfficialTest(kind: "rsvp" | "reject", email: string) {
  let row: Registration | undefined
  try {
    const roster = await loadRoster()
    row = roster.registrations.find((item) => item.email.trim().toLowerCase() === email.toLowerCase())
  } catch (error) {
    console.error("official test lookup failed", error)
  }
  const person: Registration = row || {
    id: "mail-test",
    name: readableName("", email),
    address: "",
    email,
    phone: "",
    role: "Lead",
    team_id: "",
    team_id_display: "",
    participation: "",
    are_you: "",
    organization: "",
    city: "Gurugram",
    metro: "Gurugram",
    skills: [],
    experience: "",
    github: "",
    linkedin: "",
    team_size: "1",
    registered_count: "1",
    seats_remaining: "0",
    team_status: "",
    status: "Submitted",
    created_at: new Date().toISOString(),
    registration_mail_status: "none",
    registration_mail_sent_at: null,
    registration_mail_count: 0,
    rsvp_status: "none",
    rsvp_sent_at: null,
    rsvp_count: 0,
    qr_status: "none",
    qr_token: null,
    qr_generated_at: null,
    qr_sent_at: null,
    qr_count: 0,
    reject_status: "none",
    reject_sent_at: null,
    reject_count: 0,
    property_types: {},
  }
  const group = {
    key: "mail-test",
    primary: person,
    members: [person],
    to: { name: person.name, email },
    cc: [],
  }
  const result = kind === "rsvp" ? await sendRsvpEmails([group]) : await sendRejectEmails([group])
  return {
    ok: result.failed.length === 0 && result.sent > 0,
    sent: result.sent,
    failed: result.failed,
    note: result.sent ? `Test mail sent to ${email}` : `Test mail failed: ${result.failed[0]?.error || "SMTP send failed"}`,
  }
}

export async function sendOfficialMail(input: {
  kind: "rsvp" | "reject"
  audience: ComposeAudience
  force?: boolean
}) {
  const roster = await loadRoster()
  const rows = roster.registrations.filter((row) => matches(row, input.audience))
  const groups = teamMailGroups(rows, roster.registrations).filter((group) => {
    if (input.kind === "rsvp") {
      return group.members.some((member) => member.rsvp_status === "none")
    }
    if (input.force) return true
    return group.members.some((member) => member.reject_status !== "sent")
  })
  if (groups.length === 0) {
    return {
      ok: true,
      sent: 0,
      failed: [],
      note:
        input.kind === "rsvp"
          ? "No new RSVP emails. Anyone who already has an RSVP mail is left out."
          : "No new reject emails. Send again to resend.",
    }
  }

  const result = input.kind === "rsvp" ? await sendRsvpEmails(groups) : await sendRejectEmails(groups)
  const sentAt = new Date().toISOString()
  const sentRows = groups
    .flatMap((group) => group.members)
    .filter((row) => result.sentIds.includes(row.id))
  if (sentRows.length) {
    await persistMailRecords(
      sentRows.map(mailMeta),
      input.kind === "rsvp"
        ? { rsvp_status: "sent", rsvp_sent_at: sentAt }
        : { reject_status: "sent", reject_sent_at: sentAt },
      input.kind,
    )
  }
  return {
    ok: result.failed.length === 0,
    sent: result.sent,
    failed: result.failed,
    note: resultNote(input.kind === "rsvp" ? "RSVP" : "reject", result),
  }
}
