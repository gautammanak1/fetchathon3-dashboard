import { fillTemplate, parseEmailList, readableName, type MailFields } from "@/lib/compose-mail"
import { composeMessageHtml, composeMessageText } from "@/lib/email-templates"
import { mailVenue } from "@/lib/event-venues"
import { formatVenue } from "@/lib/fields"
import { deriveTeamQrToken } from "@/lib/qr"
import { rsvpConfirmUrl } from "@/lib/rsvp-confirm"
import { loadRosterFast } from "@/lib/roster"
import { createSmtpTransport, EMAIL_RE, sendSmtpMail, sleep } from "@/lib/smtp"
import { teamKey } from "@/lib/team-qr-store"
import type { Registration } from "@/lib/types"

const SEND_GAP_MS = 250

export type ComposeAudience =
  | { kind: "roster" }
  | { kind: "venue"; venue: string }
  | { kind: "confirmed" }
  | { kind: "custom"; emails: string }
  | { kind: "selected"; ids: string[]; pack: "rsvp" | "confirm" }

type Recipient = MailFields & {
  id: string
  note: string
  address: string
  metroNote: string
  imageCaption: string
  imageUrl: string
  attachQr: boolean
  qrToken: string
  teamKey: string
}

function personFrom(row: Registration, pack: "rsvp" | "confirm" | "none" = "none"): Recipient | null {
  const email = row.email.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return null
  const place = mailVenue(row.city, row.metro)
  const key = teamKey(row)
  const token = row.qr_token || deriveTeamQrToken(key)
  return {
    id: row.id,
    email,
    name: readableName(row.name, email),
    team: row.team_id_display || row.team_id || "",
    venue: place.label,
    map: place.mapUrl || "",
    confirm_url: rsvpConfirmUrl(key),
    note: place.note,
    address: place.address || "",
    metroNote: place.metroNote || "",
    imageCaption: place.imageCaption || "",
    imageUrl: place.imageUrl || "",
    attachQr: false,
    qrToken: token,
    teamKey: key,
  }
}

function sameVenue(person: Recipient, row: Registration, venue: string) {
  const target = venue.trim().toLowerCase()
  if (!target) return false
  const labels = [person.venue, row.city, row.metro, formatVenue(row.city), formatVenue(row.metro)]
  return labels.some((label) => label.trim().toLowerCase() === target)
}

export async function resolveRecipients(audience: ComposeAudience) {
  if (audience.kind === "custom") {
    const wanted = parseEmailList(audience.emails)
    let byEmail = new Map<string, Recipient>()
    try {
      const roster = await loadRosterFast()
      byEmail = new Map(
        roster.registrations
          .map((row) => personFrom(row))
          .filter((person): person is Recipient => Boolean(person))
          .map((person) => [person.email, person]),
      )
    } catch (error) {
      console.error("roster lookup for custom mail failed", error)
    }
    return wanted.map(
      (email) =>
        byEmail.get(email) || {
          id: "",
          email,
          name: readableName("", email),
          team: "",
          venue: "",
          map: "",
          confirm_url: "",
          note: "",
          address: "",
          metroNote: "",
          imageCaption: "",
          imageUrl: "",
          attachQr: false,
          qrToken: "",
          teamKey: "",
        },
    )
  }

  const roster = await loadRosterFast()
  const people: Recipient[] = []
  const seen = new Set<string>()
  const chosen = audience.kind === "selected" ? new Set(audience.ids) : null
  for (const row of roster.registrations) {
    if (chosen && !chosen.has(row.id)) continue
    if (audience.kind === "selected" && audience.pack === "rsvp" && row.rsvp_status === "none") continue
    if (audience.kind === "selected" && audience.pack === "confirm" && row.qr_status !== "sent") continue
    const person = personFrom(row, audience.kind === "selected" ? audience.pack : "none")
    if (!person || seen.has(person.email)) continue
    if (audience.kind === "venue" && !sameVenue(person, row, audience.venue)) continue
    if (audience.kind === "confirmed" && row.qr_status !== "sent") continue
    seen.add(person.email)
    people.push(person)
  }
  return people
}

export async function sendComposedBatch(input: {
  subject: string
  body: string
  emails: string[]
  deadline: number
}) {
  const wanted = new Set(input.emails.map((email) => email.trim().toLowerCase()).filter(Boolean))
  const byEmail = new Map<string, Recipient>()
  try {
    const roster = await loadRosterFast()
    for (const row of roster.registrations) {
      const person = personFrom(row)
      if (person && wanted.has(person.email)) byEmail.set(person.email, person)
    }
  } catch (error) {
    console.error("roster lookup for queued mail failed", error)
  }
  const remaining = [...wanted]
  const sent: string[] = []
  const failed: Array<{ email: string; error: string }> = []
  const transporter = createSmtpTransport()
  let first = true
  try {
    while (remaining.length > 0 && (first || Date.now() < input.deadline)) {
      first = false
      const email = remaining[0]
      const person = byEmail.get(email) || {
        id: "",
        email,
        name: readableName("", email),
        team: "",
        venue: "",
        map: "",
        confirm_url: "",
        note: "",
        address: "",
        metroNote: "",
        imageCaption: "",
        imageUrl: "",
        attachQr: false,
        qrToken: "",
        teamKey: "",
      }
      const subject = fillTemplate(input.subject, person).trim()
      const body = fillTemplate(input.body, person).trim()
      try {
        await sendSmtpMail(
          {
            to: person.email,
            toName: person.name,
            subject,
            text: composeMessageText(body),
            html: composeMessageHtml(subject, body),
          },
          transporter,
        )
        sent.push(email)
      } catch (error) {
        failed.push({
          email,
          error: error instanceof Error ? error.message : "SMTP send failed",
        })
      }
      remaining.shift()
      if (remaining.length > 0 && Date.now() < input.deadline) await sleep(SEND_GAP_MS)
    }
  } finally {
    transporter.close()
  }
  return { sent, failed, remaining }
}

export async function sendComposedMail(input: {
  subject: string
  body: string
  recipients: Recipient[]
}) {
  const result = {
    sent: 0,
    failed: [] as Array<{ email: string; error: string }>,
  }
  const transporter = createSmtpTransport()
  try {
    for (const person of input.recipients) {
      const subject = fillTemplate(input.subject, person).trim()
      const body = fillTemplate(input.body, person).trim()
      try {
        await sendSmtpMail(
          {
            to: person.email,
            toName: person.name,
            subject,
            text: composeMessageText(body),
            html: composeMessageHtml(subject, body),
          },
          transporter,
        )
        result.sent += 1
      } catch (error) {
        result.failed.push({
          email: person.email,
          error: error instanceof Error ? error.message : "SMTP send failed",
        })
      }
      await sleep(SEND_GAP_MS)
    }
  } finally {
    transporter.close()
  }
  return result
}
