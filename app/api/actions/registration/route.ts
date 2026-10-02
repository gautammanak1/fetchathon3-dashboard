import { NextResponse } from "next/server"

import { upsertActions } from "@/lib/actions-store"
import { requireAdmin } from "@/lib/require-admin"
import { findRegistration, loadRoster } from "@/lib/roster"
import { resultNote, sendRegistrationEmails } from "@/lib/send-bulk"
import { isSmtpConfigured } from "@/lib/smtp"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied
  if (!isSmtpConfigured()) {
    return NextResponse.json(
      { error: "Set SMTP_PASSWORD in .env to send registration emails" },
      { status: 500 },
    )
  }

  const body = (await request.json()) as { ids?: string[] }
  const ids = [...new Set((body.ids || []).filter(Boolean))]
  if (ids.length === 0) {
    return NextResponse.json({ error: "Select at least one person" }, { status: 400 })
  }

  const roster = await loadRoster()
  const rows = ids
    .map((id) => findRegistration(roster, id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  const result = await sendRegistrationEmails(rows)

  const sentAt = new Date().toISOString()
  if (result.sentIds.length) {
    await upsertActions(result.sentIds, {
      registration_mail_status: "sent",
      registration_mail_sent_at: sentAt,
    })
  }

  return NextResponse.json({
    ok: result.failed.length === 0,
    count: result.sent,
    ...result,
    note: resultNote("registration", result),
  })
}
