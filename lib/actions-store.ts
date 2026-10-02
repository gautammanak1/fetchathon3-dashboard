import { readJsonFile, writeJsonFile } from "@/lib/json-store"
import type { ActionRecord } from "@/lib/types"

const STORE_NAME = "actions.json"

type Store = Record<string, ActionRecord>

const blank = (): ActionRecord => ({
  registration_mail_status: "none",
  registration_mail_sent_at: null,
  rsvp_status: "none",
  rsvp_sent_at: null,
  qr_status: "none",
  qr_token: null,
  qr_generated_at: null,
  qr_sent_at: null,
})

async function readStore(): Promise<Store> {
  return readJsonFile<Store>(STORE_NAME, {})
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
  for (const id of ids) {
    store[id] = {
      ...blank(),
      ...store[id],
      ...patch,
    }
  }
  await writeJsonFile(STORE_NAME, store)
  return ids.map((id) => store[id])
}
