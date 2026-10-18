import { db, isoTime } from "@/lib/db"
import { readJsonFile, writeJsonFile } from "@/lib/json-store"

const STORE_NAME = "checkin.json"

export type CheckInRecord = {
  registration_id: string
  name: string
  email: string
  role: string
  organization: string
  team_key: string
  team_id_display: string
  venue: string
  checked_in_at: string
}

type Store = Record<string, CheckInRecord>

function normalize(value: unknown): CheckInRecord | null {
  if (!value || typeof value !== "object") return null
  const item = value as Partial<CheckInRecord>
  const id = String(item.registration_id || "").trim()
  const at = String(item.checked_in_at || "").trim()
  if (!id || !at) return null
  return {
    registration_id: id,
    name: String(item.name || "Untitled"),
    email: String(item.email || ""),
    role: String(item.role || "Member"),
    organization: String(item.organization || ""),
    team_key: String(item.team_key || ""),
    team_id_display: String(item.team_id_display || item.team_key || ""),
    venue: String(item.venue || ""),
    checked_in_at: at,
  }
}

async function readSupabase(): Promise<Store> {
  const sql = db()
  if (!sql) throw new Error("Supabase is not configured")
  const rows = await sql<Array<Record<string, unknown>>>`select * from checkins`
  const store: Store = {}
  for (const row of rows) {
    const record = normalize({
      ...row,
      checked_in_at: isoTime(row.checked_in_at),
    })
    if (record) store[record.registration_id] = record
  }
  return store
}

async function writeSupabase(store: Store) {
  const sql = db()
  if (!sql) return
  const rows = Object.values(store)
  if (!rows.length) return
  await sql`
    insert into checkins ${sql(rows)}
    on conflict (registration_id) do update set
      name = excluded.name,
      email = excluded.email,
      role = excluded.role,
      organization = excluded.organization,
      team_key = excluded.team_key,
      team_id_display = excluded.team_id_display,
      venue = excluded.venue,
      checked_in_at = excluded.checked_in_at
  `
}

async function deleteSupabase(registrationId: string) {
  const sql = db()
  if (!sql) return
  await sql`delete from checkins where registration_id = ${registrationId}`
}

let memory: Store | null = null
let chain: Promise<unknown> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>) {
  const run = chain.then(task, task)
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function loadStore() {
  if (memory) return memory
  let remoteOk = false
  if (db()) {
    try {
      const remote = await readSupabase()
      remoteOk = true
      if (Object.keys(remote).length) {
        memory = remote
        return memory
      }
    } catch (error) {
      console.error("check-in supabase read failed", error)
    }
  }
  const file = await readJsonFile<Record<string, unknown>>(STORE_NAME, {})
  const fromFile: Store = {}
  for (const [id, value] of Object.entries(file)) {
    const record = normalize({ ...(value as object), registration_id: id })
    if (record) fromFile[id] = record
  }
  const merged = fromFile
  if (remoteOk && Object.keys(merged).length) await writeSupabase(merged)
  memory = merged
  return memory
}

async function saveStore(store: Store) {
  if (db()) {
    await writeSupabase(store)
    memory = store
    return
  }
  memory = store
  await writeJsonFile(STORE_NAME, store)
}

export async function getCheckInMap() {
  return enqueue(async () => ({ ...(await loadStore()) }))
}

export async function markCheckedIn(records: CheckInRecord[]) {
  return enqueue(async () => {
    const store = { ...(await loadStore()) }
    const saved: Array<{ record: CheckInRecord; created: boolean }> = []
    let changed = false
    for (const record of records) {
      const next = normalize(record)
      if (!next) continue
      const prev = store[next.registration_id]
      if (prev) {
        saved.push({ record: prev, created: false })
        continue
      }
      store[next.registration_id] = next
      saved.push({ record: next, created: true })
      changed = true
    }
    if (changed) await saveStore(store)
    return saved
  })
}

export async function removeCheckIn(registrationId: string) {
  return enqueue(async () => {
    const store = { ...(await loadStore()) }
    const current = store[registrationId]
    if (!current) return null
    delete store[registrationId]
    if (db()) await deleteSupabase(registrationId)
    await saveStore(store)
    return current
  })
}
