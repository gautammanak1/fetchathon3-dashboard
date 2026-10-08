import { fillTemplate, parseEmailList, type MailFields } from "@/lib/compose-mail"
import { composeMessageHtml, composeMessageText } from "@/lib/email-templates"
import { formatVenue } from "@/lib/fields"
import { loadRoster } from "@/lib/roster"
import { createSmtpTransport, EMAIL_RE, sendSmtpMail, sleep } from "@/lib/smtp"
import type { Registration } from "@/lib/types"

const SEND_GAP_MS = 250

export type ComposeAudience =
  | { kind: "roster" }
  | { kind: "venue"; venue: string }
  | { kind: "custom"; emails: string }

type Recipient = MailFields

function personFrom(row: Registration): Recipient | null {
  const email = row.email.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return null
  return {
    email,
    name: row.name.trim() || "there",
    team: row.team_id_display || row.team_id || "",
    venue: formatVenue(row.city) || row.city || row.metro || "",
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
      const roster = await loadRoster()
      byEmail = new Map(
        roster.registrations
          .map(personFrom)
          .filter((person): person is Recipient => Boolean(person))
          .map((person) => [person.email, person]),
      )
    } catch (error) {
      console.error("roster lookup for custom mail failed", error)
    }
    return wanted.map(
      (email) =>
        byEmail.get(email) || {
          email,
          name: email.split("@")[0] || "there",
          team: "",
          venue: "",
        },
    )
  }

  const roster = await loadRoster()
  const people: Recipient[] = []
  const seen = new Set<string>()
  for (const row of roster.registrations) {
    const person = personFrom(row)
    if (!person || seen.has(person.email)) continue
    if (audience.kind === "venue" && !sameVenue(person, row, audience.venue)) continue
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
