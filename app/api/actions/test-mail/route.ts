import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/require-admin"
import { sendTestInboxEmails, testInbox } from "@/lib/send-bulk"
import { isSmtpConfigured } from "@/lib/smtp"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied
  if (!isSmtpConfigured()) {
    return NextResponse.json(
      { error: "Set SMTP_PASSWORD in .env to send test email" },
      { status: 500 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    kinds?: Array<"registration" | "rsvp" | "qr">
  }
  const kinds = (body.kinds || ["registration"]).filter(
    (kind): kind is "registration" | "rsvp" | "qr" =>
      kind === "registration" || kind === "rsvp" || kind === "qr",
  )
  if (kinds.length === 0) {
    return NextResponse.json({ error: "Pick registration, rsvp, or qr" }, { status: 400 })
  }

  const result = await sendTestInboxEmails(kinds)
  if (result.to !== testInbox()) {
    return NextResponse.json({ error: "Test mail refused" }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    to: result.to,
    sent: result.sent,
    note: `Test ${result.sent.join(" + ")} sent only to ${result.to}`,
  })
}
