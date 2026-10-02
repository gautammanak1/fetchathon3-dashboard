import { NextResponse } from "next/server"

import { upsertActions } from "@/lib/actions-store"
import { getAdminSession } from "@/lib/auth"
import { requireAdmin } from "@/lib/require-admin"
import { findRegistration, loadRoster } from "@/lib/roster"
import { teamPassUrl } from "@/lib/pass-url"
import { resultNote, sendTeamQrEmails } from "@/lib/send-bulk"
import { teamMailGroups } from "@/lib/team-mail"
import { isSmtpConfigured } from "@/lib/smtp"
import {
  ensureTeamQr,
  getTeamQr,
  markTeamQrSent,
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
  if (!record && row.qr_status !== "none") {
    record = {
      team_key: key,
      team_id_display: row.team_id_display || key,
      venue: row.city,
      token: row.qr_token || "",
      generated_at: row.qr_generated_at || new Date().toISOString(),
      sent_at: row.qr_sent_at,
    }
    if (!record.token) {
      record = await ensureTeamQr({
        team_key: key,
        team_id_display: row.team_id_display || key,
        venue: row.city,
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
  if (mode === "generate") {
    const now = new Date().toISOString()
    const groups = teamMailGroups(selected, roster.registrations)
    let teams = 0
    const generatedIds: string[] = []
    for (const group of groups) {
      const record = await ensureTeamQr({
        team_key: group.key,
        team_id_display: group.primary.team_id_display || group.key,
        venue: group.primary.city,
      })
      teams += 1
      const memberIds = group.members.map((member) => member.id)
      generatedIds.push(...memberIds)
      await upsertActions(memberIds, {
        qr_status: "generated",
        qr_token: record.token,
        qr_generated_at: record.generated_at || now,
      })
    }
    if (generatedIds.length && isNotionConfigured()) {
      try {
        const schema = await fetchNotionSchema()
        await Promise.all(
          generatedIds.map((id) =>
            updateNotionActionFields(id, { qr_status: "Generated" }, schema).catch(
              () => undefined,
            ),
          ),
        )
      } catch {
        // Local overlay remains if Notion write fails.
      }
    }
    return NextResponse.json({
      ok: true,
      count: generatedIds.length,
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

  const groups = teamMailGroups(selected, roster.registrations).filter((group) =>
    group.members.some((member) => member.qr_status !== "sent"),
  )
  if (groups.length === 0) {
    return NextResponse.json({
      ok: true,
      count: 0,
      sent: 0,
      sentIds: [],
      failed: [],
      skipped: selected.map((row) => ({
        id: row.id,
        reason: "QR mail already sent",
      })),
      note: "No new QR emails. Selected teams already received the venue pass.",
    })
  }

  const records = new Map(
    await Promise.all(
      groups.map(async (group) => {
        const record = await ensureTeamQr({
          team_key: group.key,
          team_id_display: group.primary.team_id_display || group.key,
          venue: group.primary.city || "",
        })
        await upsertActions(
          group.members.map((member) => member.id),
          {
            qr_status: "generated",
            qr_token: record.token,
            qr_generated_at: record.generated_at,
          },
        )
        return [group.key, record] as const
      }),
    ),
  )

  const result = await sendTeamQrEmails(
    groups,
    (group) => records.get(group.key) ?? null,
  )

  if (result.sentIds.length) {
    const sentAt = new Date().toISOString()
    await upsertActions(result.sentIds, {
      qr_status: "sent",
      qr_sent_at: sentAt,
    })
    const keys = groups
      .filter((group) => group.members.some((member) => result.sentIds.includes(member.id)))
      .map((group) => group.key)
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
