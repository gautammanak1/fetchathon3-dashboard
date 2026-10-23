import { db, isoTime } from "@/lib/db"
import { tokenFromScan, type CheckInMember } from "@/lib/checkin"
import { markLunchCollected, releaseLunchNotion } from "@/lib/lunch-notion"
import { loadStoredRoster } from "@/lib/roster"
import { matchDerivedTeamQr, teamKey } from "@/lib/team-qr-store"
import type { Registration } from "@/lib/types"

export type LunchPickup = {
  registration_id: string
  name: string
  email: string
  role: string
  organization: string
  team_key: string
  team_id_display: string
  venue: string
  token: string
  collected_at: string
  notion_page_id: string
  notion_created: boolean
}

function sqlOrThrow() {
  const sql = db()
  if (!sql) throw new Error("Database is not configured")
  return sql
}

function asPickup(row: Record<string, unknown>): LunchPickup | null {
  const id = String(row.registration_id || "").trim()
  const at = isoTime(row.collected_at)
  if (!id || !at) return null
  return {
    registration_id: id,
    name: String(row.name || "Untitled"),
    email: String(row.email || ""),
    role: String(row.role || "Member"),
    organization: String(row.organization || ""),
    team_key: String(row.team_key || ""),
    team_id_display: String(row.team_id_display || row.team_key || ""),
    venue: String(row.venue || ""),
    token: String(row.token || ""),
    collected_at: at,
    notion_page_id: String(row.notion_page_id || ""),
    notion_created: row.notion_created === true,
  }
}

async function listPickups() {
  const sql = sqlOrThrow()
  const rows = await sql<Array<Record<string, unknown>>>`
    select * from lunch_pickups order by collected_at desc
  `
  return rows.map(asPickup).filter((row): row is LunchPickup => Boolean(row))
}

export async function lunchSummary() {
  const recent = await listPickups()
  const teams = new Set(recent.map((item) => item.team_key).filter(Boolean))
  return {
    people: recent.length,
    teams: teams.size,
    recent: recent.slice(0, 40).map((item) => ({
      registration_id: item.registration_id,
      name: item.name,
      email: item.email,
      role: item.role,
      organization: item.organization,
      team_key: item.team_key,
      team_id_display: item.team_id_display,
      venue: item.venue,
      checked_in_at: item.collected_at,
    })),
  }
}

function memberFrom(row: Registration, at: string | null, newly: boolean): CheckInMember {
  return {
    id: row.id,
    name: row.name || "Untitled",
    email: row.email || "",
    role: row.role || "Member",
    organization: row.organization || "",
    checked_in_at: at,
    newly,
  }
}

export async function collectLunch(raw: string) {
  const token = tokenFromScan(raw)
  if (!token) {
    return { ok: false as const, status: 400, error: "That code is not a Fetch-A-Thon pass" }
  }
  const roster = await loadStoredRoster()
  if (!roster) {
    return { ok: false as const, status: 503, error: "The roster is not in Supabase yet" }
  }
  const stamped = roster.registrations.find((row) => row.qr_token === token)
  const derived = matchDerivedTeamQr(token, roster.registrations)
  const key = stamped ? teamKey(stamped) : derived?.team_key
  if (!key) {
    return { ok: false as const, status: 404, error: "This QR is not on the roster" }
  }
  const rows = roster.registrations.filter((row) => teamKey(row) === key)
  if (!rows.length) {
    return { ok: false as const, status: 404, error: "No people found on this pass" }
  }
  const sql = sqlOrThrow()
  const now = new Date().toISOString()
  const venue = stamped?.city || derived?.venue || rows[0]?.city || ""
  const teamId = stamped?.team_id_display || derived?.team_id_display || key
  const created = new Set<string>()
  for (const row of rows) {
    const inserted = await sql<Array<{ registration_id: string }>>`
      insert into lunch_pickups (
        registration_id, name, email, role, organization, team_key,
        team_id_display, venue, token, collected_at
      ) values (
        ${row.id},
        ${row.name || "Untitled"},
        ${row.email || ""},
        ${row.role || "Member"},
        ${row.organization || ""},
        ${key},
        ${teamId},
        ${venue},
        ${token},
        ${now}
      )
      on conflict (registration_id) do nothing
      returning registration_id
    `
    if (inserted[0]) created.add(inserted[0].registration_id)
  }
  const fresh = rows.filter((row) => created.has(row.id))
  const notion = await markLunchCollected(
    fresh.map((row) => ({
      id: row.id,
      email: row.email || "",
      name: row.name || "Untitled",
      address: row.address || "",
      teamId: teamId,
    })),
    now,
  )
  for (const row of fresh) {
    const page = notion.pages.find((item) => item.id === row.id)
    if (!page?.pageId) continue
    await sql`
      update lunch_pickups
      set notion_page_id = ${page.pageId}, notion_created = ${page.created}
      where registration_id = ${row.id}
    `
  }
  const saved = await sql<Array<Record<string, unknown>>>`
    select * from lunch_pickups where team_key = ${key}
  `
  const byId = new Map(
    saved.map(asPickup).filter((row): row is LunchPickup => Boolean(row)).map((row) => [row.registration_id, row]),
  )
  const members = rows.map((row) => {
    const hit = byId.get(row.id)
    return memberFrom(row, hit?.collected_at || null, created.has(row.id))
  })
  const already = created.size === 0
  return {
    ok: true as const,
    status: 200,
    already,
    teamId,
    venue,
    notion: already ? ("skipped" as const) : notion.status,
    members,
    note: already
      ? `${teamId} already collected lunch`
      : notionNote(created.size, notion.status),
  }
}

function notionNote(count: number, notion: "updated" | "skipped" | "failed") {
  const people = `${count} ${count === 1 ? "person" : "people"} collected lunch`
  if (notion === "updated") return `${people}. Lunch Notion marked collected.`
  if (notion === "failed") return `${people}. Lunch Notion could not be updated.`
  return people
}

export async function undoLunch(registrationId: string) {
  const id = registrationId.trim()
  if (!id) return { ok: false as const, status: 400, error: "Missing person" }
  const sql = sqlOrThrow()
  const rows = await sql<Array<Record<string, unknown>>>`
    delete from lunch_pickups where registration_id = ${id} returning *
  `
  const removed = rows[0] ? asPickup(rows[0]) : null
  if (!removed) return { ok: false as const, status: 404, error: "This person has not collected lunch" }
  const notion = await releaseLunchNotion(removed.notion_page_id, removed.notion_created)
  const notionText =
    notion === "updated"
      ? " Lunch Notion updated."
      : notion === "failed"
        ? " Lunch Notion could not be updated."
        : ""
  return {
    ok: true as const,
    status: 200,
    notion,
    note: `${removed.name} removed from lunch.${notionText}`,
  }
}
