import { NextResponse } from "next/server"

import { upsertActions } from "@/lib/actions-store"
import { getAdminSession } from "@/lib/auth"
import { requireAdmin } from "@/lib/require-admin"
import { findRegistration, loadRoster } from "@/lib/roster"
import { resultNote, sendTeamQrEmails } from "@/lib/send-bulk"
import { isSmtpConfigured } from "@/lib/smtp"
import {
  ensureTeamQr,
  getTeamQr,
  markTeamQrSent,
  teamFromRow,
  teamKey,
  teamQrImage,
} from "@/lib/team-qr-store"
import {
  fetchNotionSchema,
  isNotionConfigured,
  updateNotionActionFields,
} from "@/lib/notion"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }
  const roster = await loadRoster()
  const row = findRegistration(roster, id)
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const admin = await getAdminSession()
  const key = teamKey(row)
  let record = await getTeamQr(key)
  if (!record && !admin) {
    return NextResponse.json(
      { error: "Admin login required to generate a team QR" },
      { status: 401 },
    )
  }
  if (!record) {
    if (row.rsvp_status === "none") {
      return NextResponse.json(
        { error: "Send RSVP before generating a team QR" },
        { status: 409 },
      )
    }
    record = await ensureTeamQr({
      team_key: key,
      team_id_display: row.team_id_display || key,
      venue: row.city,
    })
    await upsertActions([row.id], {
      qr_status: "generated",
      qr_token: record.token,
      qr_generated_at: record.generated_at,
    })
  }
  const image = await teamQrImage(record)
  return NextResponse.json({
    id: row.id,
    name: `${record.team_id_display} · ${record.venue || row.city}`,
    token: record.token,
    teamId: record.team_id_display,
    venue: record.venue,
    dataUrl: image.dataUrl,
  })
}

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = (await request.json()) as {
    ids?: string[]
    mode?: "generate" | "send"
  }
  const ids = [...new Set((body.ids || []).filter(Boolean))]
  const mode = body.mode === "send" ? "send" : "generate"
  if (ids.length === 0) {
    return NextResponse.json({ error: "Select at least one person" }, { status: 400 })
  }

  const roster = await loadRoster()
  const selected = ids
    .map((id) => findRegistration(roster, id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
  const blocked = selected.filter((row) => row.rsvp_status === "none")
  if (blocked.length > 0) {
    return NextResponse.json(
      {
        error: `RSVP must be sent first for ${blocked.length} selected people`,
      },
      { status: 409 },
    )
  }

  if (mode === "generate") {
    const now = new Date().toISOString()
    const seen = new Set<string>()
    let teams = 0
    for (const row of selected) {
      const key = teamKey(row)
      if (seen.has(key)) continue
      seen.add(key)
      await ensureTeamQr({
        team_key: key,
        team_id_display: row.team_id_display || key,
        venue: row.city,
      })
      teams += 1
    }
    const records = await Promise.all(
      selected.map(async (row) => {
        const record = await getTeamQr(teamKey(row))
        return { row, record }
      }),
    )
    for (const { row, record } of records) {
      if (!record) continue
      await upsertActions([row.id], {
        qr_status: "generated",
        qr_token: record.token,
        qr_generated_at: record.generated_at || now,
      })
    }
    return NextResponse.json({
      ok: true,
      count: selected.length,
      teams,
      note: `Generated ${teams} team QR ${teams === 1 ? "code" : "codes"} for venue check-in`,
    })
  }

  if (!isSmtpConfigured()) {
    return NextResponse.json(
      { error: "Set SMTP_PASSWORD in .env to send QR emails" },
      { status: 500 },
    )
  }

  const records = new Map(
    await Promise.all(
      [...new Set(selected.map((row) => teamKey(row)))].map(async (key) => {
        return [key, await getTeamQr(key)] as const
      }),
    ),
  )
  const missingQr = selected.filter((row) => !records.get(teamKey(row)))
  if (missingQr.length > 0) {
    return NextResponse.json(
      { error: "Generate team QR codes before sending them" },
      { status: 409 },
    )
  }

  const result = await sendTeamQrEmails(
    selected,
    (row) => records.get(teamKey(row)) ?? null,
    (row) => {
      const team = teamFromRow(row, roster.teams)
      return (team?.members || [row]).map((member) => member.name).filter(Boolean)
    },
  )

  if (result.sentIds.length) {
    const sentAt = new Date().toISOString()
    await upsertActions(result.sentIds, {
      qr_status: "sent",
      qr_sent_at: sentAt,
    })
    const keys = [
      ...new Set(result.sentIds.map((id) => {
        const row = selected.find((item) => item.id === id)
        return row ? teamKey(row) : ""
      }).filter(Boolean)),
    ]
    await markTeamQrSent(keys)
    if (isNotionConfigured()) {
      try {
        const schema = await fetchNotionSchema()
        await Promise.all(
          result.sentIds.map((id) =>
            updateNotionActionFields(id, { qr_status: "Sent" }, schema).catch(
              () => undefined,
            ),
          ),
        )
      } catch {
        // Overlay remains if Notion write fails.
      }
    }
  }

  return NextResponse.json({
    ok: result.failed.length === 0,
    count: result.sent,
    ...result,
    note: resultNote("QR", result),
  })
}
