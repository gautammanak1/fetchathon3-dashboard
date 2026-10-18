import { mailVenue } from "@/lib/event-venues"
import {
  qrHtml,
  qrSubject,
  qrText,
  registrationHtml,
  registrationSubject,
  registrationText,
  rejectHtml,
  rejectSubject,
  rejectText,
  rsvpHtml,
  rsvpSubject,
  rsvpText,
} from "@/lib/email-templates"
import { rsvpConfirmUrl } from "@/lib/rsvp-confirm"
import { createSmtpTransport, EMAIL_RE, sendSmtpMail, sleep } from "@/lib/smtp"
import { groupWithoutPriorRsvp, type TeamMailGroup } from "@/lib/team-mail"
import { teamQrImage, type TeamQrRecord } from "@/lib/team-qr-store"
import type { Registration } from "@/lib/types"

export type SendResult = {
  sent: number
  sentIds: string[]
  failed: Array<{ id: string; email: string; error: string }>
  skipped: Array<{ id: string; reason: string }>
}

const SEND_GAP_MS = 250

export async function sendRegistrationEmails(rows: Registration[]): Promise<SendResult> {
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
            subject: registrationSubject(),
            text: registrationText(row),
            html: registrationHtml(row),
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

function markGroupFailed(
  result: SendResult,
  group: TeamMailGroup,
  error: string,
) {
  for (const member of group.members) {
    result.failed.push({
      id: member.id,
      email: member.email,
      error,
    })
  }
}

function markGroupSkipped(
  result: SendResult,
  group: TeamMailGroup,
  reason: string,
) {
  for (const member of group.members) {
    result.skipped.push({ id: member.id, reason })
  }
}

export async function sendRsvpEmails(groups: TeamMailGroup[]): Promise<SendResult> {
  const result: SendResult = { sent: 0, sentIds: [], failed: [], skipped: [] }
  const transporter = createSmtpTransport()
  try {
    for (const group of groups) {
      const fresh = groupWithoutPriorRsvp(group)
      if (!fresh) {
        markGroupSkipped(result, group, "RSVP already sent")
        continue
      }
      for (const member of group.members) {
        if (!fresh.members.some((item) => item.id === member.id)) {
          result.skipped.push({ id: member.id, reason: "RSVP already sent" })
        }
      }
      if (!EMAIL_RE.test(fresh.to.email)) {
        markGroupSkipped(result, fresh, "Missing or invalid email")
        continue
      }
      try {
        await sendSmtpMail(
          {
            to: fresh.to.email,
            toName: fresh.to.name,
            cc: fresh.cc.map((item) => item.email),
            subject: rsvpSubject(mailVenue(fresh.primary.city, fresh.primary.metro).label),
            text: rsvpText(fresh.primary, fresh.members, rsvpConfirmUrl(fresh.key)),
            html: rsvpHtml(fresh.primary, fresh.members, rsvpConfirmUrl(fresh.key)),
          },
          transporter,
        )
        result.sent += 1
        result.sentIds.push(...fresh.members.map((member) => member.id))
      } catch (error) {
        markGroupFailed(
          result,
          fresh,
          error instanceof Error ? error.message : "SMTP send failed",
        )
      }
      await sleep(SEND_GAP_MS)
    }
  } finally {
    transporter.close()
  }
  return result
}

export async function sendRejectEmails(groups: TeamMailGroup[]): Promise<SendResult> {
  const result: SendResult = { sent: 0, sentIds: [], failed: [], skipped: [] }
  const transporter = createSmtpTransport()
  try {
    for (const group of groups) {
      if (!EMAIL_RE.test(group.to.email)) {
        markGroupSkipped(result, group, "Missing or invalid email")
        continue
      }
      try {
        await sendSmtpMail(
          {
            to: group.to.email,
            toName: group.to.name,
            cc: group.cc.map((item) => item.email),
            subject: rejectSubject(),
            text: rejectText(group.primary),
            html: rejectHtml(group.primary),
          },
          transporter,
        )
        result.sent += 1
        result.sentIds.push(...group.members.map((member) => member.id))
      } catch (error) {
        markGroupFailed(
          result,
          group,
          error instanceof Error ? error.message : "SMTP send failed",
        )
      }
      await sleep(SEND_GAP_MS)
    }
  } finally {
    transporter.close()
  }
  return result
}

export async function sendTeamQrEmails(
  groups: TeamMailGroup[],
  recordFor: (group: TeamMailGroup) => TeamQrRecord | null,
): Promise<SendResult> {
  const result: SendResult = { sent: 0, sentIds: [], failed: [], skipped: [] }
  const imageCache = new Map<string, Awaited<ReturnType<typeof teamQrImage>>>()
  const transporter = createSmtpTransport()

  try {
    for (const group of groups) {
      if (!EMAIL_RE.test(group.to.email)) {
        markGroupSkipped(result, group, "Missing or invalid email")
        continue
      }
      const record = recordFor(group)
      if (!record) {
        markGroupSkipped(result, group, "Team QR not generated")
        continue
      }
      try {
        let image = imageCache.get(record.team_key)
        if (!image) {
          image = await teamQrImage(record)
          imageCache.set(record.team_key, image)
        }
        const memberNames = group.members.map((member) => member.name).filter(Boolean)
        await sendSmtpMail(
          {
            to: group.to.email,
            toName: group.to.name,
            cc: group.cc.map((item) => item.email),
            subject: qrSubject(record.team_id_display),
            text: qrText({
              row: group.primary,
              teamIdDisplay: record.team_id_display,
              venue: record.venue,
              memberNames,
            }),
            html: qrHtml({
              row: group.primary,
              teamIdDisplay: record.team_id_display,
              venue: record.venue,
              memberNames,
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
        result.sentIds.push(...group.members.map((member) => member.id))
      } catch (error) {
        markGroupFailed(
          result,
          group,
          error instanceof Error ? error.message : "SMTP send failed",
        )
      }
      await sleep(SEND_GAP_MS)
    }
  } finally {
    transporter.close()
  }
  return result
}

export function resultNote(kind: string, result: SendResult) {
  const people = result.sentIds.length
  const parts = [
    `${result.sent} ${kind} ${result.sent === 1 ? "email" : "emails"} sent to ${people} ${people === 1 ? "person" : "people"}`,
  ]
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
}

export async function sendTestInboxEmails(kinds: Array<"registration" | "rsvp" | "qr">) {
  const to = testInbox()
  if (!EMAIL_RE.test(to)) {
    throw new Error("SMTP_TEST_TO is not a valid email")
  }
  const row = sampleTestRow()
  const sent: string[] = []
  if (kinds.includes("registration")) {
    await sendSmtpMail({
      to,
      toName: row.name,
      subject: registrationSubject(),
      text: registrationText(row),
      html: registrationHtml(row),
    })
    sent.push("registration")
  }
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
