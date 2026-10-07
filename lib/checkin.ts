import { getCheckInMap, markCheckedIn, removeCheckIn, type CheckInRecord } from "@/lib/checkin-store"
import { isPassToken } from "@/lib/pass-url"
import { loadRoster } from "@/lib/roster"
import { findTeamQrByToken, matchDerivedTeamQr, teamKey } from "@/lib/team-qr-store"
import {
  ensureNotionCheckInField,
  fetchNotionSchema,
  isNotionConfigured,
  updateNotionCheckIn,
} from "@/lib/notion"
import type { Registration } from "@/lib/types"

export type CheckInMember = {
  id: string
  name: string
  email: string
  role: string
  organization: string
  checked_in_at: string | null
  newly: boolean
}

export function tokenFromScan(raw: string) {
  const text = raw.trim()
  if (!text) return null
  const embedded = text.match(/\/pass\/([^/?#\s]+)/i)
  if (embedded?.[1]) {
    try {
      const token = decodeURIComponent(embedded[1])
      if (isPassToken(token)) return token
    } catch {
      return null
    }
  }
  if (isPassToken(text)) return text
  const loose = text.match(/ft3-[a-z0-9-]+/i)
  return loose && isPassToken(loose[0]) ? loose[0] : null
}

function memberFrom(
  row: Registration,
  record: CheckInRecord | undefined,
  newly: boolean,
): CheckInMember {
  return {
    id: row.id,
    name: row.name || "Untitled",
    email: row.email || "",
    role: row.role || "Member",
    organization: row.organization || "",
    checked_in_at: record?.checked_in_at || null,
    newly,
  }
}

async function syncNotion(ids: string[], at: string, joined: boolean) {
  if (!ids.length || !isNotionConfigured()) return "skipped" as const
  try {
    const schema = await ensureNotionCheckInField(await fetchNotionSchema())
    const results = await Promise.all(
      ids.map((id) => updateNotionCheckIn(id, at, schema, joined)),
    )
    if (results.every((result) => result === "skipped")) return "skipped" as const
    if (results.some((result) => result === "failed")) return "failed" as const
    if (results.some((result) => result === "updated")) return "updated" as const
    return "skipped" as const
  } catch (error) {
    console.error("notion check-in sync failed", error)
    return "failed" as const
  }
}

export async function checkInFromScan(raw: string) {
  const token = tokenFromScan(raw)
  if (!token) {
    return { ok: false as const, status: 400, error: "That code is not a Fetch-A-Thon pass" }
  }
  const roster = await loadRoster()
  const record =
    (await findTeamQrByToken(token)) ||
    matchDerivedTeamQr(token, roster.registrations)
  if (!record) {
    return { ok: false as const, status: 404, error: "This QR is not on the roster" }
  }
  const rows = roster.registrations.filter((row) => teamKey(row) === record.team_key)
  if (!rows.length) {
    return { ok: false as const, status: 404, error: "No people found on this pass" }
  }

  const now = new Date().toISOString()
  const saved = await markCheckedIn(
    rows.map((row) => ({
      registration_id: row.id,
      name: row.name || "Untitled",
      email: row.email || "",
      role: row.role || "Member",
      organization: row.organization || "",
      team_key: record.team_key,
      team_id_display: record.team_id_display || record.team_key,
      venue: record.venue || row.city || "",
      checked_in_at: now,
    })),
  )
  const savedById = new Map(saved.map((item) => [item.record.registration_id, item]))
  const createdIds = saved.filter((item) => item.created).map((item) => item.record.registration_id)
  const notion = await syncNotion(createdIds, now, true)
  const members = rows.map((row) => {
    const hit = savedById.get(row.id)
    return memberFrom(row, hit?.record, Boolean(hit?.created))
  })
  const teamId = record.team_id_display || record.team_key
  const already = createdIds.length === 0
  return {
    ok: true as const,
    status: 200,
    already,
    teamId,
    venue: record.venue || rows[0]?.city || "",
    notion,
    members,
    note: already
      ? `${teamId} was already marked joined`
      : `${createdIds.length} ${createdIds.length === 1 ? "person" : "people"} marked joined`,
  }
}

export async function undoCheckIn(registrationId: string) {
  const id = registrationId.trim()
  if (!id) return { ok: false as const, status: 400, error: "Missing person" }
  const removed = await removeCheckIn(id)
  if (!removed) return { ok: false as const, status: 404, error: "This person is not checked in" }
  const notion = await syncNotion([id], removed.checked_in_at, false)
  return {
    ok: true as const,
    status: 200,
    member: removed,
    notion,
    note: `${removed.name} removed from check-in`,
  }
}

export async function checkInSummary() {
  const map = await getCheckInMap()
  const recent = Object.values(map).sort((a, b) =>
    a.checked_in_at < b.checked_in_at ? 1 : -1,
  )
  const teams = new Set(recent.map((item) => item.team_key).filter(Boolean))
  return {
    people: recent.length,
    teams: teams.size,
    recent: recent.slice(0, 40),
  }
}
