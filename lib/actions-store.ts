import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { ActionRecord } from "@/lib/types"

const STORE_PATH = path.join(process.cwd(), ".data", "actions.json")

type Store = Record<string, ActionRecord>

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

export async function getActionMap() {
  return readStore()
}

export async function getAction(id: string) {
  const store = await readStore()
  return store[id] ?? null
}

export async function upsertActions(
  ids: string[],
  patch: Partial<ActionRecord>,
) {
  const store = await readStore()
  const blank: ActionRecord = {
    registration_mail_status: "none",
    registration_mail_sent_at: null,
    rsvp_status: "none",
    rsvp_sent_at: null,
    qr_status: "none",
    qr_token: null,
    qr_generated_at: null,
    qr_sent_at: null,
  }
  for (const id of ids) {
    store[id] = {
      ...blank,
      ...store[id],
      ...patch,
    }
  }
  await writeStore(store)
  return ids.map((id) => store[id])
}
