import { deriveTeamQrToken, qrDataUrl, teamQrPayload } from "@/lib/qr"
import { readJsonFile, writeJsonFile } from "@/lib/json-store"
import type { Registration, Team } from "@/lib/types"

const STORE_NAME = "team-qr.json"

export type TeamQrRecord = {
  team_key: string
  team_id_display: string
  venue: string
  token: string
  generated_at: string
  sent_at: string | null
}

type Store = Record<string, TeamQrRecord>

export function teamKey(row: { team_id: string; id: string }) {
  return row.team_id || `solo-${row.id}`
}

function derivedRecord(
  input: Pick<TeamQrRecord, "team_key"> & Partial<TeamQrRecord>,
): TeamQrRecord {
  return {
    team_key: input.team_key,
    team_id_display: input.team_id_display || input.team_key,
    venue: input.venue || "",
    token: input.token || deriveTeamQrToken(input.team_key),
    generated_at: input.generated_at || new Date().toISOString(),
    sent_at: input.sent_at ?? null,
  }
}

async function readStore(): Promise<Store> {
  return readJsonFile<Store>(STORE_NAME, {})
}

export async function getTeamQrMap() {
  return readStore()
}

export async function getTeamQr(key: string) {
  const store = await readStore()
  return store[key] ?? null
}

export function teamQrFromRow(
  row: { team_id: string; id: string; team_id_display?: string; city?: string },
) {
  const key = teamKey(row)
  return derivedRecord({
    team_key: key,
    team_id_display: row.team_id_display || key,
    venue: row.city || "",
  })
}

export async function findTeamQrByToken(token: string) {
  const store = await readStore()
  return (
    Object.values(store).find((record) => record.token === token) ?? null
  )
}

export function matchDerivedTeamQr(
  token: string,
  rows: Array<{
    team_id: string
    id: string
    team_id_display?: string
    city?: string
  }>,
) {
  const seen = new Set<string>()
  for (const row of rows) {
    const key = teamKey(row)
    if (seen.has(key)) continue
    seen.add(key)
    if (deriveTeamQrToken(key) === token) {
      return derivedRecord({
        team_key: key,
        team_id_display: row.team_id_display || key,
        venue: row.city || "",
        token,
      })
    }
  }
  return null
}

export async function ensureTeamQr(input: {
  team_key: string
  team_id_display: string
  venue: string
}) {
  const store = await readStore()
  const existing = store[input.team_key]
  if (existing) return existing
  const record = derivedRecord(input)
  store[input.team_key] = record
  await writeJsonFile(STORE_NAME, store)
  return record
}

export async function markTeamQrSent(keys: string[]) {
  const store = await readStore()
  const now = new Date().toISOString()
  for (const key of keys) {
    const current = store[key] || derivedRecord({ team_key: key })
    store[key] = { ...current, sent_at: now }
  }
  await writeJsonFile(STORE_NAME, store)
}

export function teamFromRow(row: Registration, teams: Team[]) {
  return (
    teams.find((team) => team.team_id && team.team_id === row.team_id) ||
    teams.find((team) => team.members.some((member) => member.id === row.id)) ||
    null
  )
}

export async function teamQrImage(record: TeamQrRecord) {
  const payload = teamQrPayload({
    teamId: record.team_id_display,
    venue: record.venue,
    token: record.token,
  })
  const dataUrl = await qrDataUrl(payload)
  const base64 = dataUrl.split(",")[1] || ""
  return {
    payload,
    dataUrl,
    buffer: Buffer.from(base64, "base64"),
  }
}
