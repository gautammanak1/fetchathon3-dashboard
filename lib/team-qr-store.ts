import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { makeQrToken, qrDataUrl, teamQrPayload } from "@/lib/qr"
import type { Registration, Team } from "@/lib/types"

const STORE_PATH = path.join(process.cwd(), ".data", "team-qr.json")

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

async function readStore(): Promise<Store> {
  try {
    const raw = await readFile(STORE_PATH, "utf8")
    const parsed = JSON.parse(raw) as Store
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

async function writeStore(store: Store) {
  await mkdir(path.dirname(STORE_PATH), { recursive: true })
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8")
}

export async function getTeamQrMap() {
  return readStore()
}

export async function getTeamQr(key: string) {
  const store = await readStore()
  return store[key] ?? null
}

export async function ensureTeamQr(input: {
  team_key: string
  team_id_display: string
  venue: string
}) {
  const store = await readStore()
  const existing = store[input.team_key]
  if (existing) {
    return existing
  }
  const now = new Date().toISOString()
  const record: TeamQrRecord = {
    team_key: input.team_key,
    team_id_display: input.team_id_display,
    venue: input.venue,
    token: makeQrToken(),
    generated_at: now,
    sent_at: null,
  }
  store[input.team_key] = record
  await writeStore(store)
  return record
}

export async function markTeamQrSent(keys: string[]) {
  const store = await readStore()
  const now = new Date().toISOString()
  for (const key of keys) {
    if (!store[key]) continue
    store[key] = { ...store[key], sent_at: now }
  }
  await writeStore(store)
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
