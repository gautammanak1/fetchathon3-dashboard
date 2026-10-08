import { randomUUID } from "node:crypto"

import { readJsonFile, writeJsonFile } from "@/lib/json-store"

const STORE_NAME = "mail-templates.json"
const BLOB_PATH = "fetchathon3-mail-templates.json"

export type MailTemplate = {
  id: string
  name: string
  subject: string
  body: string
  updated_at: string
}

type Store = Record<string, MailTemplate>

function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

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
    body: body.slice(0, 5000),
    updated_at: String(item.updated_at || new Date().toISOString()),
  }
}

function newer(current: MailTemplate | undefined, incoming: MailTemplate) {
  if (!current) return incoming
  return incoming.updated_at >= current.updated_at ? incoming : current
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
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      const template = normalize(value)
      if (template) store[template.id] = newer(store[template.id], template)
    }
    return store
  } catch (error) {
    console.error("mail template blob read failed", error)
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
    console.error("mail template blob write failed", error)
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
  for (const value of Object.values(file)) {
    const template = normalize(value)
    if (template) fromFile[template.id] = template
  }
  const fromBlob = await readBlobStore()
  const merged: Store = { ...fromFile }
  for (const [id, template] of Object.entries(fromBlob || {})) {
    merged[id] = newer(merged[id], template)
  }
  memory = merged
  return memory
}

async function saveStore(store: Store) {
  memory = store
  await writeJsonFile(STORE_NAME, store)
  await writeBlobStore(store)
}

export async function listMailTemplates() {
  return enqueue(async () => {
    const store = await loadStore()
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
  const body = input.body.trim().slice(0, 5000)
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
    await saveStore(store)
    return true
  })
}
