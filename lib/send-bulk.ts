import { qrHtml, qrSubject, qrText, rsvpHtml, rsvpSubject, rsvpText } from "@/lib/email-templates"
import { createSmtpTransport, EMAIL_RE, sendSmtpMail, sleep } from "@/lib/smtp"
import { teamQrImage, type TeamQrRecord } from "@/lib/team-qr-store"
import type { Registration } from "@/lib/types"

export type SendResult = {
  sent: number
  sentIds: string[]
  failed: Array<{ id: string; email: string; error: string }>
  skipped: Array<{ id: string; reason: string }>
}

const SEND_GAP_MS = 250

export async function sendRsvpEmails(rows: Registration[]): Promise<SendResult> {
  const result: SendResult = { sent: 0, sentIds: [], failed: [], skipped: [] }
  const transporter = createSmtpTransport()
  try {
    for (const row of rows) {
      const email = row.email.trim()
      if (!EMAIL_RE.test(email)) {
        result.skipped.push({ id: row.id, reason: "Missing or invalid email" })
        continue
      }
      try {
        await sendSmtpMail(
          {
            to: email,
            toName: row.name,
            subject: rsvpSubject(),
            text: rsvpText(row),
            html: rsvpHtml(row),
          },
          transporter,
        )
        result.sent += 1
        result.sentIds.push(row.id)
      } catch (error) {
        result.failed.push({
          id: row.id,
          email,
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

export async function sendTeamQrEmails(
  rows: Registration[],
  recordFor: (row: Registration) => TeamQrRecord | null,
  membersFor: (row: Registration) => string[],
): Promise<SendResult> {
  const result: SendResult = { sent: 0, sentIds: [], failed: [], skipped: [] }
  const imageCache = new Map<string, Awaited<ReturnType<typeof teamQrImage>>>()
  const transporter = createSmtpTransport()

  try {
    for (const row of rows) {
      const email = row.email.trim()
      if (!EMAIL_RE.test(email)) {
        result.skipped.push({ id: row.id, reason: "Missing or invalid email" })
        continue
      }
      const record = recordFor(row)
      if (!record) {
        result.skipped.push({ id: row.id, reason: "Team QR not generated" })
        continue
      }
      try {
        let image = imageCache.get(record.team_key)
        if (!image) {
          image = await teamQrImage(record)
          imageCache.set(record.team_key, image)
        }
        await sendSmtpMail(
          {
            to: email,
            toName: row.name,
            subject: qrSubject(record.team_id_display),
            text: qrText({
              row,
              teamIdDisplay: record.team_id_display,
              venue: record.venue,
              memberNames: membersFor(row),
            }),
            html: qrHtml({
              row,
              teamIdDisplay: record.team_id_display,
              venue: record.venue,
              memberNames: membersFor(row),
            }),
            attachments: [
              {
                filename: "team-qr.png",
                content: image.buffer,
                cid: "teamqr",
                contentType: "image/png",
              },
            ],
          },
          transporter,
        )
        result.sent += 1
        result.sentIds.push(row.id)
      } catch (error) {
        result.failed.push({
          id: row.id,
          email,
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

export function resultNote(kind: string, result: SendResult) {
  const parts = [`${result.sent} ${kind} emails sent`]
  if (result.failed.length) parts.push(`${result.failed.length} failed`)
  if (result.skipped.length) parts.push(`${result.skipped.length} skipped`)
  return parts.join(" · ")
}

const DEFAULT_TEST_TO = "gautammanak1@gmail.com"

export function testInbox() {
  return (process.env.SMTP_TEST_TO || DEFAULT_TEST_TO).trim().toLowerCase() || DEFAULT_TEST_TO
}

function sampleTestRow(): Registration {
  const email = testInbox()
  return {
    id: "test-inbox",
    name: "Gautam Kumar",
    address: "",
    email,
    phone: "",
    role: "Lead",
    team_id: "fetchathon3.0-0001",
    team_id_display: "fetchathon3.0-0001",
    participation: "team",
    are_you: "Student",
    organization: "Fetch.ai Innovation Lab",
    city: "Bengaluru",
    metro: "Bengaluru",
    skills: ["Agents"],
    experience: "Intermediate",
    github: "https://github.com/fetchai",
    linkedin: "",
    team_size: "3",
    registered_count: "3",
    seats_remaining: "0",
    team_status: "Complete (3/3 registered)",
    status: "Submitted",
    rsvp_status: "none",
    rsvp_sent_at: null,
    qr_status: "none",
    qr_token: null,
    qr_generated_at: null,
    qr_sent_at: null,
    property_types: {},
  }
}

export async function sendTestInboxEmails(kinds: Array<"rsvp" | "qr">) {
  const to = testInbox()
  if (!EMAIL_RE.test(to)) {
    throw new Error("SMTP_TEST_TO is not a valid email")
  }
  const row = sampleTestRow()
  const sent: string[] = []
  if (kinds.includes("rsvp")) {
    await sendSmtpMail({
      to,
      toName: row.name,
      subject: rsvpSubject(),
      text: rsvpText(row),
      html: rsvpHtml(row),
    })
    sent.push("rsvp")
  }
  if (kinds.includes("qr")) {
    const record: TeamQrRecord = {
      team_key: "test-inbox",
      team_id_display: row.team_id_display,
      venue: row.city,
      token: `ft3-test-${Date.now().toString(16)}`,
      generated_at: new Date().toISOString(),
      sent_at: null,
    }
    const image = await teamQrImage(record)
    await sendSmtpMail({
      to,
      toName: row.name,
      subject: qrSubject(record.team_id_display),
      text: qrText({
        row,
        teamIdDisplay: record.team_id_display,
        venue: record.venue,
        memberNames: [row.name, "Teammate Two", "Teammate Three"],
      }),
      html: qrHtml({
        row,
        teamIdDisplay: record.team_id_display,
        venue: record.venue,
        memberNames: [row.name, "Teammate Two", "Teammate Three"],
      }),
      attachments: [
        {
          filename: "team-qr.png",
          content: image.buffer,
          cid: "teamqr",
          contentType: "image/png",
        },
      ],
    })
    sent.push("qr")
  }
  return { to, sent }
}
