import { fillTemplate, parseEmailList, readableName, type MailFields } from "@/lib/compose-mail"
import { composeMessageHtml, composeMessageText, type ComposePlace } from "@/lib/email-templates"
import { mailVenue } from "@/lib/event-venues"
import { formatVenue } from "@/lib/fields"
import { deriveTeamQrToken } from "@/lib/qr"
import { rsvpConfirmUrl } from "@/lib/rsvp-confirm"
import { loadRosterFast } from "@/lib/roster"
import { createSmtpTransport, EMAIL_RE, sendSmtpMail, sleep } from "@/lib/smtp"
import { teamKey, teamQrImage, type TeamQrRecord } from "@/lib/team-qr-store"
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
    imageUrl: place.imageUrl || "",
    attachQr: pack === "confirm",
    qrToken: token,
    teamKey: key,
  }
}

function placeFor(person: Recipient, qr: ComposePlace["qr"]): ComposePlace {
  return {
    label: person.venue,
    mapUrl: person.map || null,
    note: person.note,
    imageUrl: person.imageUrl || null,
    qr,
    teamId: person.team,
  }
}

function qrRecord(person: Recipient): TeamQrRecord {
  return {
    team_key: person.teamKey,
    team_id_display: person.team || person.teamKey,
    venue: person.venue,
    token: person.qrToken,
    generated_at: new Date().toISOString(),
    sent_at: null,
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
  const qrCache = new Map<string, Buffer>()
  try {
    for (const person of input.recipients) {
      const subject = fillTemplate(input.subject, person).trim()
      const body = fillTemplate(input.body, person).trim()
      const place = placeFor(person, person.attachQr ? "attach" : false)
      let attachments: Array<{ filename: string; content: Buffer; cid: string; contentType: string }> | undefined
      if (person.attachQr) {
        let content = qrCache.get(person.qrToken)
        if (!content) {
          content = (await teamQrImage(qrRecord(person))).buffer
          qrCache.set(person.qrToken, content)
        }
        attachments = [
          {
            filename: "team-qr.png",
            content,
            cid: "teamqr",
            contentType: "image/png",
          },
        ]
      }
      try {
        await sendSmtpMail(
          {
            to: person.email,
            toName: person.name,
            subject,
            text: composeMessageText(body, place),
            html: composeMessageHtml(subject, body, place),
            attachments,
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
