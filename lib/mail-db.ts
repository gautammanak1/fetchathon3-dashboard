import { getActionMap, replaceActionEntries } from "@/lib/actions-store"
import { readJsonFile, writeJsonFile } from "@/lib/json-store"
import type { ActionRecord, QrStatus, Registration, RsvpStatus } from "@/lib/types"

const STORE_NAME = "mail-db.json"
const BLOB_PATH = "fetchathon3-mail-db.json"

export type MailPerson = ActionRecord & {
  email: string
  name: string
  team_id: string
}

type Store = Record<string, MailPerson>

const rankQr: Record<QrStatus, number> = { none: 0, generated: 1, sent: 2 }
const rankRsvp: Record<RsvpStatus, number> = { none: 0, sent: 1, confirmed: 2 }
const rankMail = { none: 0, sent: 1 } as const

function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

function blank(partial?: Partial<MailPerson>): MailPerson {
  return {
    email: "",
    name: "",
    team_id: "",
    registration_mail_status: "none",
    registration_mail_sent_at: null,
    registration_mail_count: 0,
    rsvp_status: "none",
    rsvp_sent_at: null,
    rsvp_count: 0,
    qr_status: "none",
    qr_token: null,
    qr_generated_at: null,
    qr_sent_at: null,
    qr_count: 0,
    ...partial,
  }
}

function asActionPatch(record: MailPerson): ActionRecord {
  return {
    registration_mail_status: record.registration_mail_status,
    registration_mail_sent_at: record.registration_mail_sent_at,
    registration_mail_count: record.registration_mail_count,
    rsvp_status: record.rsvp_status,
    rsvp_sent_at: record.rsvp_sent_at,
    rsvp_count: record.rsvp_count,
    qr_status: record.qr_status,
    qr_token: record.qr_token,
    qr_generated_at: record.qr_generated_at,
    qr_sent_at: record.qr_sent_at,
    qr_count: record.qr_count,
  }
}

function normalize(value: unknown): MailPerson | null {
  if (!value || typeof value !== "object") return null
  const item = value as Partial<MailPerson>
  return blank({
    email: String(item.email || ""),
    name: String(item.name || ""),
    team_id: String(item.team_id || ""),
    registration_mail_status: item.registration_mail_status === "sent" ? "sent" : "none",
    registration_mail_sent_at: item.registration_mail_sent_at || null,
    registration_mail_count: Number(item.registration_mail_count || 0),
    rsvp_status:
      item.rsvp_status === "confirmed"
        ? "confirmed"
        : item.rsvp_status === "sent"
          ? "sent"
          : "none",
    rsvp_sent_at: item.rsvp_sent_at || null,
    rsvp_count: Number(item.rsvp_count || 0),
    qr_status:
      item.qr_status === "sent"
        ? "sent"
        : item.qr_status === "generated"
          ? "generated"
          : "none",
    qr_token: item.qr_token || null,
    qr_generated_at: item.qr_generated_at || null,
    qr_sent_at: item.qr_sent_at || null,
    qr_count: Number(item.qr_count || 0),
  })
}

function mergePerson(base: MailPerson, incoming: MailPerson): MailPerson {
  return {
    ...base,
    email: incoming.email || base.email,
    name: incoming.name || base.name,
    team_id: incoming.team_id || base.team_id,
    registration_mail_status:
      rankMail[incoming.registration_mail_status] >= rankMail[base.registration_mail_status]
        ? incoming.registration_mail_status
        : base.registration_mail_status,
    registration_mail_sent_at:
      incoming.registration_mail_sent_at || base.registration_mail_sent_at,
    registration_mail_count: Math.max(
      incoming.registration_mail_count,
      base.registration_mail_count,
    ),
    rsvp_status:
      rankRsvp[incoming.rsvp_status] >= rankRsvp[base.rsvp_status]
        ? incoming.rsvp_status
        : base.rsvp_status,
    rsvp_sent_at: incoming.rsvp_sent_at || base.rsvp_sent_at,
    rsvp_count: Math.max(incoming.rsvp_count, base.rsvp_count),
    qr_status:
      rankQr[incoming.qr_status] >= rankQr[base.qr_status]
        ? incoming.qr_status
        : base.qr_status,
    qr_token: incoming.qr_token || base.qr_token,
    qr_generated_at: incoming.qr_generated_at || base.qr_generated_at,
    qr_sent_at: incoming.qr_sent_at || base.qr_sent_at,
    qr_count: Math.max(incoming.qr_count, base.qr_count),
  }
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
      const person = normalize(value)
      if (person) store[id] = person
    }
    return store
  } catch (error) {
    console.error("mail-db blob read failed", error)
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
    console.error("mail-db blob write failed", error)
  }
}

function mergeStores(...stores: Array<Store | null | undefined>): Store {
  const merged: Store = {}
  for (const store of stores) {
    if (!store) continue
    for (const [id, person] of Object.entries(store)) {
      merged[id] = merged[id] ? mergePerson(merged[id], person) : person
    }
  }
  return merged
}

let memory: Store | null = null
let loadPromise: Promise<Store> | null = null

async function loadStore(): Promise<Store> {
  if (memory) return memory
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    const overlay = await getActionMap()
    const fromOverlay: Store = {}
    for (const [id, action] of Object.entries(overlay)) {
      fromOverlay[id] = blank(action)
    }
    const file = await readJsonFile<Record<string, unknown>>(STORE_NAME, {})
    const fromFile: Store = {}
    for (const [id, value] of Object.entries(file)) {
      const person = normalize(value)
      if (person) fromFile[id] = person
    }
    const fromBlob = await readBlobStore()
    memory = mergeStores(fromOverlay, fromFile, fromBlob)
    return memory
  })()
  try {
    return await loadPromise
  } finally {
    loadPromise = null
  }
}

async function saveStore(store: Store) {
  memory = store
  await writeJsonFile(STORE_NAME, store)
  await writeBlobStore(store)
}

export async function getMailMap() {
  return loadStore()
}

export function mailMeta(row: Pick<Registration, "id" | "email" | "name" | "team_id" | "team_id_display">) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    team_id: row.team_id_display || row.team_id,
  }
}

export async function persistMailRecords(
  people: Array<{ id: string; email?: string; name?: string; team_id?: string }>,
  patch: Partial<MailPerson>,
  bump?: "registration" | "rsvp" | "qr",
) {
  const store = { ...(await loadStore()) }
  const ids: string[] = []
  for (const person of people) {
    if (!person.id) continue
    const prev = store[person.id] || blank()
    const cleanPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<MailPerson>
    const next = blank({
      ...prev,
      email: person.email || prev.email,
      name: person.name || prev.name,
      team_id: person.team_id || prev.team_id,
      ...cleanPatch,
    })
    next.registration_mail_status =
      rankMail[next.registration_mail_status] >= rankMail[prev.registration_mail_status]
        ? next.registration_mail_status
        : prev.registration_mail_status
    next.rsvp_status =
      rankRsvp[next.rsvp_status] >= rankRsvp[prev.rsvp_status]
        ? next.rsvp_status
        : prev.rsvp_status
    next.qr_status =
      rankQr[next.qr_status] >= rankQr[prev.qr_status] ? next.qr_status : prev.qr_status
    next.registration_mail_count = prev.registration_mail_count
    next.rsvp_count = prev.rsvp_count
    next.qr_count = prev.qr_count
    if (bump === "registration") next.registration_mail_count += 1
    if (bump === "rsvp") next.rsvp_count += 1
    if (bump === "qr") next.qr_count += 1
    store[person.id] = next
    ids.push(person.id)
  }
  await saveStore(store)
  if (ids.length) {
    await replaceActionEntries(
      Object.fromEntries(ids.map((id) => [id, asActionPatch(store[id])])),
    )
  }
  return ids.map((id) => store[id])
}
