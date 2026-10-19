import {
  VENUE_OPTIONS,
  deriveMetro,
  formatTeamId,
  formatVenue,
  isHiddenVenue,
  normalizeOrganization,
  normalizeTeamId,
} from "@/lib/fields"
import { getActionMap } from "@/lib/actions-store"
import { db, isoTime } from "@/lib/db"
import { getMailMap, syncPeopleProfiles } from "@/lib/mail-db"
import { getTeamQrMap, teamKey } from "@/lib/team-qr-store"
import {
  isNotionConfigured,
  queryNotionPages,
  actionFieldsFromNotionPage,
  fetchNotionSchema,
  registrationFromNotionPage,
} from "@/lib/notion"
import { deriveTeamQrToken } from "@/lib/qr"
import type {
  ActionRecord,
  ChartPoint,
  QrStatus,
  Registration,
  RosterPayload,
  Team,
} from "@/lib/types"

function parseSize(value: string) {
  const n = Number(String(value).replace(/\.0$/, ""))
  return Number.isFinite(n) && n > 0 ? n : null
}

function countBy(items: string[], known: string[] = []): ChartPoint[] {
  const map = new Map<string, number>(known.map((name) => [name, 0]))
  for (const item of items) {
    const key = item || "Unknown"
    map.set(key, (map.get(key) || 0) + 1)
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value
      const aKnown = known.indexOf(a.name)
      const bKnown = known.indexOf(b.name)
      if (aKnown !== -1 || bKnown !== -1) {
        return (aKnown === -1 ? known.length : aKnown) - (bKnown === -1 ? known.length : bKnown)
      }
      return a.name.localeCompare(b.name)
    })
}

function applyAction(row: Registration, action?: ActionRecord | null): Registration {
  if (!action) return row
  return {
    ...row,
    registration_mail_status:
      action.registration_mail_status !== "none"
        ? action.registration_mail_status
        : row.registration_mail_status,
    registration_mail_sent_at:
      action.registration_mail_sent_at || row.registration_mail_sent_at,
    registration_mail_count:
      action.registration_mail_count || row.registration_mail_count,
    rsvp_status: action.rsvp_status !== "none" ? action.rsvp_status : row.rsvp_status,
    rsvp_sent_at: action.rsvp_sent_at || row.rsvp_sent_at,
    rsvp_count: action.rsvp_count || row.rsvp_count,
    qr_status: action.qr_status !== "none" ? action.qr_status : row.qr_status,
    qr_token: action.qr_token || row.qr_token,
    qr_generated_at: action.qr_generated_at || row.qr_generated_at,
    qr_sent_at: action.qr_sent_at || row.qr_sent_at,
    qr_count: action.qr_count || row.qr_count,
    reject_status: action.reject_status === "sent" ? "sent" : row.reject_status,
    reject_sent_at: action.reject_sent_at || row.reject_sent_at,
    reject_count: action.reject_count || row.reject_count,
  }
}

function enrich(rows: Registration[]): { registrations: Registration[]; teams: Team[] } {
  const grouped = new Map<string, Registration[]>()
  for (const row of rows) {
    const tid = normalizeTeamId(row.team_id)
    const key = tid || `solo-${row.id}`
    const next = grouped.get(key) || []
    next.push(row)
    grouped.set(key, next)
  }

  const teams: Team[] = []
  const registrations: Registration[] = []

  for (const [key, members] of grouped) {
    const submitted = members.filter(
      (member) => member.status.toLowerCase() === "submitted",
    )
    const lead =
      members.find((member) => member.role.toLowerCase() === "lead") || members[0]
    const expected =
      parseSize(lead?.team_size || "") ||
      members.map((member) => parseSize(member.team_size || "")).find(Boolean) ||
      null
    const registered = submitted.length
    const remaining = expected === null ? null : Math.max(0, expected - registered)
    const complete = expected !== null && registered >= expected
    const label = expected
      ? complete
        ? `Complete (${registered}/${expected} registered)`
        : `Incomplete (${registered}/${expected} registered, ${remaining} remaining)`
      : "Pending lead size"
    const tid = normalizeTeamId(lead?.team_id || key)

    const team: Team = {
      team_id: tid,
      team_id_display: formatTeamId(tid) || tid,
      lead_name: lead?.name || "Unassigned",
      lead_email: lead?.email || "",
      location: lead?.city || "",
      metro: lead?.metro || deriveMetro(lead?.city || ""),
      expected_size: expected,
      registered_count: registered,
      seats_remaining: remaining,
      team_status: label,
      members: [],
    }

    const enrichedMembers = members.map((member) => ({
      ...member,
      team_id: tid || member.team_id,
      team_id_display: formatTeamId(tid || member.team_id),
      city: formatVenue(member.city) || member.city,
      metro: deriveMetro(member.city),
      organization: normalizeOrganization(member.organization),
      registered_count: String(registered),
      seats_remaining: remaining === null ? "" : String(remaining),
      team_status: label,
    }))
    team.members = enrichedMembers
    teams.push(team)
    registrations.push(...enrichedMembers)
  }

  teams.sort((a, b) => a.team_id_display.localeCompare(b.team_id_display))
  registrations.sort((a, b) => {
    const newest = Date.parse(b.created_at || "") || 0
    const oldest = Date.parse(a.created_at || "") || 0
    if (newest !== oldest) return newest - oldest
    return a.name.localeCompare(b.name)
  })
  return { registrations, teams }
}

function toPayload(
  source: RosterPayload["source"],
  configured: boolean,
  schema: Record<string, string>,
  raw: Registration[],
): RosterPayload {
  const { registrations, teams } = enrich(raw)
  const submitted = registrations.filter(
    (row) => row.status.toLowerCase() === "submitted",
  )
  return {
    source,
    configured,
    schema,
    registrations,
    teams,
    charts: {
      byLocation: countBy(
        submitted.map((row) => row.city),
        VENUE_OPTIONS.map((venue) => venue.label),
      ),
      byCity: countBy(
        submitted.map((row) => row.metro),
        [...new Set(VENUE_OPTIONS.map((venue) => venue.metro))],
      ),
      byBuilder: countBy(submitted.map((row) => row.are_you)),
      byCollege: countBy(submitted.map((row) => row.organization)).slice(0, 8),
    },
    stats: {
      total: registrations.length,
      submitted: submitted.length,
      drafts: registrations.length - submitted.length,
      teams: teams.length,
      completeTeams: teams.filter((team) =>
        team.team_status.toLowerCase().startsWith("complete"),
      ).length,
      registrationMailSent: registrations.filter(
        (row) => row.registration_mail_status === "sent",
      ).length,
      rsvpSent: registrations.filter((row) => row.rsvp_status !== "none").length,
      qrGenerated: registrations.filter((row) => row.qr_status !== "none").length,
      qrSent: registrations.filter((row) => row.qr_status === "sent").length,
    },
  }
}

export async function loadRoster(): Promise<RosterPayload> {
  if (!isNotionConfigured()) {
    throw new Error("Set NOTION_TOKEN and NOTION_DATABASE_ID in .env")
  }

  const overlay = await getActionMap()
  const mailDb = await getMailMap()
  const schema = await fetchNotionSchema()
  const pages = await queryNotionPages()
  const raw = pages.map((page) => {
    const base = registrationFromNotionPage(page, schema)
    const fromNotion = actionFieldsFromNotionPage(page)
    const withOverlay = applyAction(
      {
        ...base,
        team_id_display: formatTeamId(base.team_id),
        metro: deriveMetro(base.city),
        registration_mail_status: fromNotion.registration_mail_status,
        registration_mail_sent_at: null,
        registration_mail_count: 0,
        rsvp_status: fromNotion.rsvp_status,
        rsvp_sent_at: null,
        rsvp_count: 0,
        qr_status: fromNotion.qr_status,
        qr_token: null,
        qr_generated_at: null,
        qr_sent_at: null,
        qr_count: 0,
        reject_status: "none",
        reject_sent_at: null,
        reject_count: 0,
        review_status: mailDb[base.id]?.review_status === "reviewed" ? "reviewed" : "pending",
      },
      overlay[base.id],
    )
    return applyAction(withOverlay, mailDb[base.id])
  })
  const visible = raw.filter((row) => !isHiddenVenue(row.city, row.metro))
  const payload = toPayload("notion", true, schema, visible)
  const teamQrs = await getTeamQrMap()
  const attachQr = (row: Registration) => {
    const record = teamQrs[teamKey(row)]
    const token = record?.token || deriveTeamQrToken(teamKey(row))
    if (row.qr_status === "none" && !record) {
      return { ...row, qr_token: token }
    }
    const qrStatus: QrStatus = record?.sent_at || row.qr_status === "sent"
      ? "sent"
      : row.qr_status === "none"
        ? "generated"
        : row.qr_status
    return {
      ...row,
      qr_token: token,
      qr_status: qrStatus,
      qr_generated_at: record?.generated_at || row.qr_generated_at,
      qr_sent_at: record?.sent_at || row.qr_sent_at,
    }
  }
  payload.registrations = payload.registrations.map(attachQr)
  payload.teams = payload.teams.map((team) => ({
    ...team,
    members: team.members.map(attachQr),
  }))
  payload.stats.qrGenerated = payload.registrations.filter(
    (row) => row.qr_status !== "none",
  ).length
  payload.stats.qrSent = payload.registrations.filter(
    (row) => row.qr_status === "sent",
  ).length
  try {
    await syncPeopleProfiles(payload.registrations)
  } catch (error) {
    console.error("Could not save people profiles to Supabase", error)
  }
  return payload
}

function storedText(value: unknown) {
  return String(value || "").trim()
}

function storedRegistration(row: Record<string, unknown>): Registration | null {
  const id = storedText(row.notion_id)
  if (!id) return null
  const city = storedText(row.city)
  const rsvp =
    row.rsvp_status === "confirmed" || row.rsvp_status === "sent" ? row.rsvp_status : "none"
  const qr =
    row.qr_status === "sent" || row.qr_status === "generated" ? row.qr_status : "none"
  return {
    id,
    name: storedText(row.name),
    address: storedText(row.address),
    email: storedText(row.email),
    phone: storedText(row.phone),
    role: storedText(row.role),
    team_id: storedText(row.team_id),
    team_id_display: formatTeamId(storedText(row.team_id)),
    participation: storedText(row.participation),
    are_you: storedText(row.are_you),
    organization: storedText(row.organization),
    city,
    metro: deriveMetro(city),
    skills: storedText(row.skills)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    experience: storedText(row.experience),
    github: storedText(row.github),
    linkedin: storedText(row.linkedin),
    team_size: storedText(row.team_size),
    registered_count: "",
    seats_remaining: "",
    team_status: "",
    status: storedText(row.registration_status) || "Submitted",
    created_at: isoTime(row.updated_at) || "",
    registration_mail_status: row.registration_mail_status === "sent" ? "sent" : "none",
    registration_mail_sent_at: isoTime(row.registration_mail_sent_at),
    registration_mail_count: Number(row.registration_mail_count || 0),
    rsvp_status: rsvp,
    rsvp_sent_at: isoTime(row.rsvp_sent_at),
    rsvp_count: Number(row.rsvp_count || 0),
    qr_status: qr,
    qr_token: storedText(row.qr_token) || null,
    qr_generated_at: isoTime(row.qr_generated_at),
    qr_sent_at: isoTime(row.qr_sent_at),
    qr_count: Number(row.qr_count || 0),
    reject_status: row.reject_status === "sent" ? "sent" : "none",
    reject_sent_at: isoTime(row.reject_sent_at),
    reject_count: Number(row.reject_count || 0),
    review_status: row.review_status === "reviewed" ? "reviewed" : "pending",
    property_types: {},
  }
}

export async function loadStoredRoster(): Promise<RosterPayload | null> {
  const sql = db()
  if (!sql) return null
  try {
    const rows = await sql<Array<Record<string, unknown>>>`select * from mail_people`
    const raw = rows
      .map(storedRegistration)
      .filter((row): row is Registration => Boolean(row))
      .filter((row) => !isHiddenVenue(row.city, row.metro))
    if (raw.length === 0) return null
    return toPayload("notion", true, {}, raw)
  } catch (error) {
    console.error("stored roster failed", error)
    return null
  }
}

export async function loadRosterFast() {
  const stored = await loadStoredRoster()
  if (stored && stored.registrations.length > 0) return stored
  return loadRoster()
}

export function findRegistration(roster: RosterPayload, id: string) {
  return roster.registrations.find((row) => row.id === id) || null
}
