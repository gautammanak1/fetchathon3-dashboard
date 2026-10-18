import { randomUUID } from "node:crypto"

import { db, isoTime } from "@/lib/db"
import { readJsonFile, writeJsonFile } from "@/lib/json-store"

const STORE_NAME = "mail-templates.json"

export type MailTemplate = {
  id: string
  name: string
  subject: string
  body: string
  updated_at: string
}

type Store = Record<string, MailTemplate>

function normalize(value: unknown): MailTemplate | null {
  if (!value || typeof value !== "object") return null
  const item = value as Partial<MailTemplate>
  const id = String(item.id || "").trim()
  const name = String(item.name || "").trim()
  const subject = String(item.subject || "").trim()
  const body = String(item.body || "").trim()
  if (!id || !name || !subject || !body) return null
  return {
    id,
    name: name.slice(0, 80),
    subject: subject.slice(0, 180),
    body: body.slice(0, 12000),
    updated_at: String(item.updated_at || new Date().toISOString()),
  }
}

function newer(current: MailTemplate | undefined, incoming: MailTemplate) {
  if (!current) return incoming
  return incoming.updated_at >= current.updated_at ? incoming : current
}

async function readSupabase(): Promise<Store> {
  const sql = db()
  if (!sql) throw new Error("Supabase is not configured")
  const rows = await sql<Array<Record<string, unknown>>>`select * from mail_templates`
  const store: Store = {}
  for (const row of rows) {
    const template = normalize({
      ...row,
      updated_at: isoTime(row.updated_at),
    })
    if (template) store[template.id] = newer(store[template.id], template)
  }
  return store
}

async function writeSupabase(store: Store) {
  const sql = db()
  if (!sql) return
  const rows = Object.values(store)
  if (!rows.length) return
  await sql`
    insert into mail_templates ${sql(rows)}
    on conflict (id) do update set
      name = excluded.name,
      subject = excluded.subject,
      body = excluded.body,
      updated_at = excluded.updated_at
  `
}

async function deleteSupabase(id: string) {
  const sql = db()
  if (!sql) return
  await sql`delete from mail_templates where id = ${id}`
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
      console.error("mail template supabase read failed", error)
    }
  }
  const file = await readJsonFile<Record<string, unknown>>(STORE_NAME, {})
  const fromFile: Store = {}
  for (const value of Object.values(file)) {
    const template = normalize(value)
    if (template) fromFile[template.id] = template
  }
  const merged: Store = { ...fromFile }
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

export async function listMailTemplates() {
  return enqueue(async () => {
    const store = { ...(await loadStore()) }
    const removed: string[] = []
    for (const [id, template] of Object.entries(store)) {
      if (/^RSVP ·/i.test(template.name)) {
        delete store[id]
        removed.push(id)
      }
    }
    if (removed.length) {
      await saveStore(store)
      await Promise.all(removed.map((id) => deleteSupabase(id)))
    }
    return Object.values(store).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
  })
}

export async function saveMailTemplate(input: {
  id?: string
  name: string
  subject: string
  body: string
}) {
  const name = input.name.trim().slice(0, 80)
  const subject = input.subject.trim().slice(0, 180)
  const body = input.body.trim().slice(0, 80000)
  if (!name || !subject || !body) {
    throw new Error("Template needs a name, subject, and message")
  }
  return enqueue(async () => {
    const store = { ...(await loadStore()) }
    const existing =
      (input.id && store[input.id]) ||
      Object.values(store).find((item) => item.name.toLowerCase() === name.toLowerCase())
    const template: MailTemplate = {
      id: existing?.id || randomUUID(),
      name,
      subject,
      body,
      updated_at: new Date().toISOString(),
    }
    store[template.id] = template
    await saveStore(store)
    return template
  })
}

export async function deleteMailTemplate(id: string) {
  return enqueue(async () => {
    const store = { ...(await loadStore()) }
    if (!store[id]) return false
    delete store[id]
    if (db()) await deleteSupabase(id)
    await saveStore(store)
    return true
  })
}
