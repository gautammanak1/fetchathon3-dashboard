import { NextResponse } from "next/server"

import { getAdminSession } from "@/lib/auth"
import { fillTemplate, readableName } from "@/lib/compose-mail"
import { mailVenue } from "@/lib/event-venues"
import { loadRoster } from "@/lib/roster"
import { rsvpConfirmUrl } from "@/lib/rsvp-confirm"
import { resolveRecipients, sendComposedMail, type ComposeAudience } from "@/lib/send-compose"
import { sendOfficialMail, sendOfficialTest } from "@/lib/send-official"
import { isSmtpConfigured } from "@/lib/smtp"
import { teamKey } from "@/lib/team-qr-store"

export const dynamic = "force-dynamic"
export const maxDuration = 300

async function testRecipient(email: string) {
  try {
    const roster = await loadRoster()
    const row = roster.registrations.find(
      (item) => item.email.trim().toLowerCase() === email.toLowerCase(),
    )
    if (row) {
      return {
        email,
        name: readableName(row.name, email),
        team: row.team_id_display || row.team_id || "",
        venue: mailVenue(row.city, row.metro).label,
        map: mailVenue(row.city, row.metro).mapUrl || "",
        confirm_url: rsvpConfirmUrl(teamKey(row)),
      }
    }
  } catch (error) {
    console.error("test mail name lookup failed", error)
  }
  return {
    email,
    name: readableName("", email),
    team: "",
    venue: "",
    map: "",
    confirm_url: "",
  }
}

function audienceFrom(body: {
  audience?: string
  venue?: string
  emails?: string
}): ComposeAudience | null {
  if (body.audience === "roster") return { kind: "roster" }
  if (body.audience === "venue") {
    const venue = String(body.venue || "").trim()
    if (!venue) return null
    return { kind: "venue", venue }
  }
  if (body.audience === "confirmed") return { kind: "confirmed" }
  if (body.audience === "custom") return { kind: "custom", emails: String(body.emails || "") }
  return null
}

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: "Admin login required" }, { status: 401 })
  }
  if (!isSmtpConfigured()) {
    return NextResponse.json({ error: "Set SMTP_PASSWORD before sending mail" }, { status: 500 })
  }

  const body = (await request.json().catch(() => null)) as {
    subject?: string
    body?: string
    audience?: string
    venue?: string
    emails?: string
    test?: boolean
    force?: boolean
    kind?: string
  } | null

  const kind = body?.kind === "rsvp" || body?.kind === "reject" ? body.kind : "custom"
  const audience = audienceFrom(body || {})
  if (!body?.test && !audience) {
    return NextResponse.json({ error: "Choose who should receive this mail" }, { status: 400 })
  }

  if (kind !== "custom") {
    try {
      const result = body?.test
        ? await sendOfficialTest(kind, session.email)
        : await sendOfficialMail({ kind, audience: audience!, force: body?.force === true })
      return NextResponse.json(result, { status: result.ok || result.sent > 0 ? 200 : 502 })
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Could not send mail"
      return NextResponse.json({ error: messageText }, { status: 500 })
    }
  }

  const subject = String(body?.subject || "").trim()
  const message = String(body?.body || "").trim()
  if (!subject || !message) {
    return NextResponse.json({ error: "Write a subject and a message" }, { status: 400 })
  }
  if (subject.length > 180 || message.length > 80000) {
    return NextResponse.json({ error: "Subject or message is too long" }, { status: 400 })
  }

  try {
    const recipients = body?.test
      ? [await testRecipient(session.email)]
      : await resolveRecipients(audience!)
    if (recipients.length === 0) {
      return NextResponse.json({ error: "No valid email addresses to send to" }, { status: 400 })
    }

    const result = await sendComposedMail({
      subject: body?.test ? `[Test] ${fillTemplate(subject, recipients[0])}` : subject,
      body: message,
      recipients,
    })
    const failed = result.failed.length
    const note = body?.test
      ? result.sent
        ? `Test mail sent to ${session.email}`
        : `Test mail failed: ${result.failed[0]?.error || "SMTP send failed"}`
      : failed
        ? `Sent ${result.sent}. ${failed} failed.`
        : `Sent ${result.sent} ${result.sent === 1 ? "email" : "emails"}.`

    return NextResponse.json({
      ok: result.sent > 0 && failed === 0,
      sent: result.sent,
      failed,
      note,
      failures: result.failed.slice(0, 8),
    }, { status: result.sent > 0 || body?.test ? 200 : 502 })
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Could not send mail"
    return NextResponse.json({ error: messageText }, { status: 500 })
  }
}
