import { readJsonFile, writeJsonFile } from "@/lib/json-store"

const STORE_NAME = "checkin.json"
const BLOB_PATH = "fetchathon3-checkin.json"

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

function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

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

function earlier(current: CheckInRecord | undefined, incoming: CheckInRecord) {
  if (!current) return incoming
  return incoming.checked_in_at < current.checked_in_at
    ? { ...current, ...incoming, checked_in_at: incoming.checked_in_at }
    : { ...incoming, ...current, checked_in_at: current.checked_in_at }
}

function mergeStores(...stores: Array<Store | null | undefined>): Store {
  const merged: Store = {}
  for (const store of stores) {
    if (!store) continue
    for (const [id, record] of Object.entries(store)) {
      merged[id] = earlier(merged[id], record)
    }
  }
  return merged
}

async function readStreamText(input: unknown): Promise<string> {
  if (!input) return ""
  if (typeof input === "string") return input
  if (input instanceof ReadableStream) return await new Response(input).text()
  if (typeof input === "object") {
    const item = input as { stream?: ReadableStream; body?: ReadableStream }
    if (item.stream) return await new Response(item.stream).text()
    if (item.body) return await new Response(item.body).text()
  }
  return ""
}

async function readBlobStore(): Promise<Store | null> {
  if (!blobEnabled()) return null
  try {
    const blob = await import("@vercel/blob")
    let parsed: unknown = null
    try {
      const file = await blob.get(BLOB_PATH, { access: "private", useCache: false })
      const text = await readStreamText(file?.stream)
      parsed = text ? JSON.parse(text) : null
    } catch {
      const { blobs } = await blob.list({ prefix: BLOB_PATH, limit: 20 })
      const hit = blobs.find((item) => item.pathname === BLOB_PATH)
      if (!hit) return null
      const file = await blob.get(hit.url, { access: "private", useCache: false })
      const text = await readStreamText(file?.stream)
      parsed = text ? JSON.parse(text) : null
    }
    if (!parsed || typeof parsed !== "object") return null
    const store: Store = {}
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      const record = normalize(value)
      if (record) store[id] = record
    }
    return store
  } catch (error) {
    console.error("check-in blob read failed", error)
    return null
  }
}

async function writeBlobStore(store: Store) {
  if (!blobEnabled()) return
  try {
    const { put } = await import("@vercel/blob")
    await put(BLOB_PATH, JSON.stringify(store, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    })
  } catch (error) {
    console.error("check-in blob write failed", error)
  }
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
  const file = await readJsonFile<Record<string, unknown>>(STORE_NAME, {})
  const fromFile: Store = {}
  for (const [id, value] of Object.entries(file)) {
    const record = normalize({ ...(value as object), registration_id: id })
    if (record) fromFile[id] = record
  }
  memory = mergeStores(fromFile, await readBlobStore())
  return memory
}

async function saveStore(store: Store) {
  memory = store
  await writeJsonFile(STORE_NAME, store)
  await writeBlobStore(store)
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
    await saveStore(store)
    return current
  })
}
