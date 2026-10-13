import { NextResponse } from "next/server"

import { getAdminSession } from "@/lib/auth"
import { fillTemplate } from "@/lib/compose-mail"
import { resolveRecipients, sendComposedMail, type ComposeAudience } from "@/lib/send-compose"
import { isSmtpConfigured } from "@/lib/smtp"

export const dynamic = "force-dynamic"
export const maxDuration = 300

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
  } | null

  const subject = String(body?.subject || "").trim()
  const message = String(body?.body || "").trim()
  if (!subject || !message) {
    return NextResponse.json({ error: "Write a subject and a message" }, { status: 400 })
  }
  if (subject.length > 180 || message.length > 12000) {
    return NextResponse.json({ error: "Subject or message is too long" }, { status: 400 })
  }

  const audience = audienceFrom(body || {})
  if (!body?.test && !audience) {
    return NextResponse.json({ error: "Choose who should receive this mail" }, { status: 400 })
  }

  try {
    const recipients = body?.test
      ? [
          {
            email: session.email,
            name: "there",
            team: "fetchathon3.0-1",
            venue: "Bengaluru",
          },
        ]
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
