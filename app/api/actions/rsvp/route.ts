import { NextResponse } from "next/server"

import { mailMeta, persistMailRecords } from "@/lib/mail-db"
import { requireAdmin } from "@/lib/require-admin"
import { findRegistration, loadRoster } from "@/lib/roster"
import { resultNote, sendRsvpEmails } from "@/lib/send-bulk"
import { isSmtpConfigured } from "@/lib/smtp"
import { teamMailGroups } from "@/lib/team-mail"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied
  if (!isSmtpConfigured()) {
    return NextResponse.json(
      { error: "Set SMTP_PASSWORD in .env to send RSVP emails" },
      { status: 500 },
    )
  }

  const body = (await request.json()) as { ids?: string[]; force?: boolean }
  const ids = [...new Set((body.ids || []).filter(Boolean))]
  const force = body.force === true
  if (ids.length === 0) {
    return NextResponse.json({ error: "Select at least one person" }, { status: 400 })
  }

  const roster = await loadRoster()
  const rows = ids
    .map((id) => findRegistration(roster, id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
  const groups = teamMailGroups(rows, roster.registrations).filter((group) =>
    force ? true : group.members.some((member) => member.rsvp_status === "none"),
  )
  if (groups.length === 0) {
    return NextResponse.json({
      ok: true,
      count: 0,
      sent: 0,
      sentIds: [],
      failed: [],
      skipped: rows.map((row) => ({
        id: row.id,
        reason: "RSVP already sent",
      })),
      note: "No new RSVP emails. Selected teams already received seat confirmation. Use Send again to resend.",
    })
  }

  const result = await sendRsvpEmails(groups)
  const sentAt = new Date().toISOString()
  const sentRows = groups
    .flatMap((group) => group.members)
    .filter((row) => result.sentIds.includes(row.id))
  if (sentRows.length) {
    await persistMailRecords(
      sentRows.map(mailMeta),
      {
        rsvp_status: "sent",
        rsvp_sent_at: sentAt,
      },
      "rsvp",
    )
  }

  return NextResponse.json({
    ok: result.failed.length === 0,
    count: result.sent,
    ...result,
    note: resultNote("RSVP", result),
  })
}
