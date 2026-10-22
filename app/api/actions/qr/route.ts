import { NextResponse } from "next/server"

import { getAdminSession } from "@/lib/auth"
import { mailVenue } from "@/lib/event-venues"
import { mailMeta, persistMailRecords } from "@/lib/mail-db"
import { startMailJob } from "@/lib/mail-job"
import { teamPassUrl } from "@/lib/pass-url"
import { runQrBatch } from "@/lib/qr-batch"
import { requireAdmin } from "@/lib/require-admin"
import { findRegistration, loadRosterFast } from "@/lib/roster"
import { ensureTeamQr, getTeamQr, teamKey, teamQrImage } from "@/lib/team-qr-store"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }
  const roster = await loadRosterFast()
  const row = findRegistration(roster, id)
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const admin = await getAdminSession()
  const key = teamKey(row)
  let record = await getTeamQr(key)
  if (!record && row.qr_status !== "none") {
    record = {
      team_key: key,
      team_id_display: row.team_id_display || key,
      venue: mailVenue(row.city, row.metro).label,
      token: row.qr_token || "",
      generated_at: row.qr_generated_at || new Date().toISOString(),
      sent_at: row.qr_sent_at,
    }
    if (!record.token) {
      record = await ensureTeamQr({
        team_key: key,
        team_id_display: row.team_id_display || key,
        venue: mailVenue(row.city, row.metro).label,
      })
    }
  }
  if (!record && !admin) {
    return NextResponse.json(
      { error: "Admin login required to generate a team QR" },
      { status: 401 },
    )
  }
  if (!record) {
    record = await ensureTeamQr({
      team_key: key,
      team_id_display: row.team_id_display || key,
      venue: mailVenue(row.city, row.metro).label,
    })
    await persistMailRecords([mailMeta(row)], {
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
    passUrl: teamPassUrl(record.token),
    dataUrl: image.dataUrl,
  })
}

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = (await request.json()) as {
    ids?: string[]
    mode?: "generate" | "send"
    force?: boolean
    onlySelected?: boolean
    queue?: boolean
    background?: boolean
  }
  const ids = [...new Set((body.ids || []).filter(Boolean))]
  const mode = body.mode === "send" ? "send" : "generate"
  const force = body.force === true
  const onlySelected = body.onlySelected === true
  const queue = body.queue === true
  if (ids.length === 0) {
    return NextResponse.json({ error: "Select at least one person" }, { status: 400 })
  }

  if (body.background === true) {
    try {
      const job = await startMailJob({ ids, mode, force, onlySelected })
      return NextResponse.json({
        ok: true,
        jobId: job.id,
        background: true,
        done: job.status !== "running",
        sentIds: job.sent_ids,
        remainingIds: job.ids,
        note: "Confirm mail is sending on the server. You can leave this page.",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start the send"
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  const result = await runQrBatch({ ids, mode, force, onlySelected, queue })
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status || 500 })
  }
  return NextResponse.json(result)
}
