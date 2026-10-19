import { getActionMap, replaceActionEntries } from "@/lib/actions-store"
import { db, isoTime } from "@/lib/db"
import { readJsonFile, writeJsonFile } from "@/lib/json-store"
import type { ActionRecord, QrStatus, Registration, RsvpStatus } from "@/lib/types"

const STORE_NAME = "mail-db.json"

export type MailPerson = ActionRecord & {
  email: string
  name: string
  team_id: string
  review_status: "pending" | "reviewed"
}

type Store = Record<string, MailPerson>

const rankQr: Record<QrStatus, number> = { none: 0, generated: 1, sent: 2 }
const rankRsvp: Record<RsvpStatus, number> = { none: 0, sent: 1, confirmed: 2 }
const rankMail = { none: 0, sent: 1 } as const

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
    reject_status: "none",
    reject_sent_at: null,
    reject_count: 0,
    review_status: "pending",
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
    reject_status: record.reject_status,
    reject_sent_at: record.reject_sent_at,
    reject_count: record.reject_count,
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
    reject_status: item.reject_status === "sent" ? "sent" : "none",
    reject_sent_at: item.reject_sent_at || null,
    reject_count: Number(item.reject_count || 0),
    review_status: item.review_status === "reviewed" ? "reviewed" : "pending",
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
    reject_status: rankMail[incoming.reject_status] >= rankMail[base.reject_status]
      ? incoming.reject_status
      : base.reject_status,
    reject_sent_at: incoming.reject_sent_at || base.reject_sent_at,
    reject_count: Math.max(incoming.reject_count, base.reject_count),
    review_status:
      base.review_status === "reviewed" || incoming.review_status === "reviewed"
        ? "reviewed"
        : "pending",
  }
}

async function readSupabase(): Promise<Store> {
  const sql = db()
  if (!sql) throw new Error("Supabase is not configured")
  const rows = await sql<Array<Record<string, unknown>>>`select * from mail_people`
  const store: Store = {}
  for (const row of rows) {
    const id = String(row.notion_id || "")
    const person = normalize({
      ...row,
      registration_mail_sent_at: isoTime(row.registration_mail_sent_at),
      rsvp_sent_at: isoTime(row.rsvp_sent_at),
      qr_generated_at: isoTime(row.qr_generated_at),
      qr_sent_at: isoTime(row.qr_sent_at),
      reject_sent_at: isoTime(row.reject_sent_at),
    })
    if (id && person) store[id] = person
  }
  return store
}

async function writeSupabase(store: Store) {
  const sql = db()
  if (!sql) return
  const rows = Object.entries(store).map(([notion_id, person]) => ({
    notion_id,
    email: person.email || "",
    name: person.name || "",
    team_id: person.team_id || "",
    registration_mail_status: person.registration_mail_status,
    registration_mail_sent_at: person.registration_mail_sent_at,
    registration_mail_count: person.registration_mail_count,
    rsvp_status: person.rsvp_status,
    rsvp_sent_at: person.rsvp_sent_at,
    rsvp_count: person.rsvp_count,
    qr_status: person.qr_status,
    qr_token: person.qr_token,
    qr_generated_at: person.qr_generated_at,
    qr_sent_at: person.qr_sent_at,
    qr_count: person.qr_count,
    reject_status: person.reject_status,
    reject_sent_at: person.reject_sent_at,
    reject_count: person.reject_count,
  }))
  for (let index = 0; index < rows.length; index += 100) {
    const chunk = rows.slice(index, index + 100)
    await sql`
      insert into mail_people ${sql(chunk)}
      on conflict (notion_id) do update set
        email = excluded.email,
        name = excluded.name,
        team_id = excluded.team_id,
        registration_mail_status = excluded.registration_mail_status,
        registration_mail_sent_at = excluded.registration_mail_sent_at,
        registration_mail_count = excluded.registration_mail_count,
        rsvp_status = excluded.rsvp_status,
        rsvp_sent_at = excluded.rsvp_sent_at,
        rsvp_count = excluded.rsvp_count,
        qr_status = excluded.qr_status,
        qr_token = excluded.qr_token,
        qr_generated_at = excluded.qr_generated_at,
        qr_sent_at = excluded.qr_sent_at,
        qr_count = excluded.qr_count,
        reject_status = excluded.reject_status,
        reject_sent_at = excluded.reject_sent_at,
        reject_count = excluded.reject_count,
        updated_at = now()
    `
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
        console.error("mail-db supabase read failed", error)
      }
    }
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
    const merged = mergeStores(fromOverlay, fromFile)
    if (remoteOk && Object.keys(merged).length) await writeSupabase(merged)
    memory = merged
    return memory
  })()
  try {
    return await loadPromise
  } finally {
    loadPromise = null
  }
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

export async function getMailMap() {
  return loadStore()
}

export async function setReviewStatus(ids: string[], status: "pending" | "reviewed") {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return []
  const sql = db()
  if (!sql) throw new Error("Supabase is not configured")
  await sql`
    update mail_people
    set review_status = ${status}, updated_at = now()
    where notion_id in ${sql(unique)}
  `
  if (memory) {
    for (const id of unique) {
      const prev = memory[id]
      if (prev) memory[id] = { ...prev, review_status: status }
    }
  }
  return unique
}

export async function syncPeopleProfiles(rows: Registration[]) {
  const sql = db()
  if (!sql || rows.length === 0) return
  const payload = rows
    .filter((row) => row.id)
    .map((row) => ({
      notion_id: row.id,
      email: row.email || "",
      name: row.name || "",
      team_id: row.team_id_display || row.team_id || "",
      phone: row.phone || "",
      role: row.role || "",
      organization: row.organization || "",
      participation: row.participation || "",
      are_you: row.are_you || "",
      city: row.city || "",
      skills: row.skills.join(", "),
      experience: row.experience || "",
      github: row.github || "",
      linkedin: row.linkedin || "",
      address: row.address || "",
      team_size: row.team_size || "",
      registration_status: row.status || "",
    }))
  for (let index = 0; index < payload.length; index += 80) {
    const chunk = payload.slice(index, index + 80)
    await sql`
      insert into mail_people ${sql(chunk)}
      on conflict (notion_id) do update set
        email = excluded.email,
        name = excluded.name,
        team_id = excluded.team_id,
        phone = excluded.phone,
        role = excluded.role,
        organization = excluded.organization,
        participation = excluded.participation,
        are_you = excluded.are_you,
        city = excluded.city,
        skills = excluded.skills,
        experience = excluded.experience,
        github = excluded.github,
        linkedin = excluded.linkedin,
        address = excluded.address,
        team_size = excluded.team_size,
        registration_status = excluded.registration_status,
        updated_at = now()
    `
  }
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
  bump?: "registration" | "rsvp" | "qr" | "reject",
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
    next.reject_count = prev.reject_count
    next.reject_status =
      rankMail[next.reject_status] >= rankMail[prev.reject_status]
        ? next.reject_status
        : prev.reject_status
    if (bump === "registration") next.registration_mail_count += 1
    if (bump === "rsvp") next.rsvp_count += 1
    if (bump === "qr") next.qr_count += 1
    if (bump === "reject") next.reject_count += 1
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
