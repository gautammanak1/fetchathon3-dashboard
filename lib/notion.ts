import {
  CHECKIN_FIELD_ALIASES,
  QR_FIELD_ALIASES,
  REGISTRATION_MAIL_FIELD_ALIASES,
  RSVP_FIELD_ALIASES,
  extractDatabaseId,
  parseFieldMap,
} from "@/lib/fields"
import type { QrStatus, Registration, RsvpStatus } from "@/lib/types"

const NOTION_API = "https://api.notion.com/v1"

function token() {
  return (process.env.NOTION_TOKEN || process.env.NOTION_API_KEY || "").trim()
}

function databaseRef() {
  return (
    process.env.NOTION_DATABASE_ID ||
    process.env.NOTION_DATABASE_URL ||
    ""
  ).trim()
}

function version() {
  return (process.env.NOTION_VERSION || "2022-06-28").trim()
}

export function isNotionConfigured() {
  return Boolean(token() && extractDatabaseId(databaseRef()))
}

function headers() {
  return {
    Authorization: `Bearer ${token()}`,
    "Notion-Version": version(),
    "Content-Type": "application/json",
  }
}

function fields() {
  return parseFieldMap(process.env.NOTION_FIELDS)
}

function plainFromProp(prop: unknown): string {
  if (!prop || typeof prop !== "object") return ""
  const item = prop as Record<string, unknown>
  const type = String(item.type || "")
  if (type === "title") {
    return ((item.title as { plain_text?: string }[]) || [])
      .map((part) => part.plain_text || "")
      .join("")
      .trim()
  }
  if (type === "rich_text") {
    return ((item.rich_text as { plain_text?: string }[]) || [])
      .map((part) => part.plain_text || "")
      .join("")
      .trim()
  }
  if (type === "email") return String(item.email || "").trim()
  if (type === "phone_number") return String(item.phone_number || "").trim()
  if (type === "url") return String(item.url || "").trim()
  if (type === "select") {
    const select = item.select as { name?: string } | null
    return String(select?.name || "").trim()
  }
  if (type === "status") {
    const status = item.status as { name?: string } | null
    return String(status?.name || "").trim()
  }
  if (type === "number") {
    const num = item.number
    if (num === null || num === undefined) return ""
    return String(num).replace(/\.0$/, "")
  }
  if (type === "multi_select") {
    return ((item.multi_select as { name?: string }[]) || [])
      .map((option) => option.name || "")
      .filter(Boolean)
      .join(", ")
  }
  if (type === "checkbox") return item.checkbox ? "Yes" : "No"
  if (type === "date") {
    const date = item.date as { start?: string } | null
    return String(date?.start || "").trim()
  }
  return ""
}

function schemaFromProperties(
  properties: Record<string, { type?: string }> | undefined,
) {
  const schema: Record<string, string> = {}
  for (const [name, meta] of Object.entries(properties || {})) {
    schema[name] = meta.type || ""
  }
  return schema
}

export async function fetchNotionSchema() {
  const dbId = extractDatabaseId(databaseRef())
  const response = await fetch(`${NOTION_API}/databases/${dbId}`, {
    headers: headers(),
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(`Notion schema HTTP ${response.status}`)
  }
  const data = (await response.json()) as {
    properties?: Record<string, { type?: string }>
  }
  return schemaFromProperties(data.properties)
}

export async function queryNotionPages() {
  const dbId = extractDatabaseId(databaseRef())
  const pages: Record<string, unknown>[] = []
  let cursor: string | undefined
  do {
    const response = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method: "POST",
      headers: headers(),
      cache: "no-store",
      body: JSON.stringify({
        page_size: 100,
        start_cursor: cursor,
      }),
    })
    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Notion query HTTP ${response.status}: ${body.slice(0, 200)}`)
    }
    const data = (await response.json()) as {
      results?: Record<string, unknown>[]
      has_more?: boolean
      next_cursor?: string | null
    }
    pages.push(...(data.results || []))
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined
  } while (cursor)
  return pages
}

function mapRsvpStatus(value: string): RsvpStatus {
  const text = value.trim().toLowerCase()
  if (!text || text === "none" || text === "no") return "none"
  if (text.includes("confirm")) return "confirmed"
  return "sent"
}

function mapQrStatus(value: string): QrStatus {
  const text = value.trim().toLowerCase()
  if (!text || text === "none" || text === "no") return "none"
  if (text.includes("sent")) return "sent"
  if (text.includes("generat") || text.includes("ready")) return "generated"
  return "none"
}

function plainFromNamedProps(
  props: Record<string, unknown>,
  names: string[],
) {
  for (const name of names) {
    if (props[name]) return plainFromProp(props[name])
  }
  const keys = Object.keys(props)
  for (const name of names) {
    const hit = keys.find((key) => key.toLowerCase() === name.toLowerCase())
    if (hit) return plainFromProp(props[hit])
  }
  return ""
}

function mapMailStatus(value: string): "none" | "sent" {
  const text = value.trim().toLowerCase()
  if (!text || text === "none" || text === "no") return "none"
  if (text.includes("sent") || text.includes("yes")) return "sent"
  return "none"
}

export function actionFieldsFromNotionPage(page: Record<string, unknown>) {
  const props = (page.properties || {}) as Record<string, unknown>
  return {
    registration_mail_status: mapMailStatus(
      plainFromNamedProps(props, REGISTRATION_MAIL_FIELD_ALIASES),
    ),
    rsvp_status: mapRsvpStatus(plainFromNamedProps(props, RSVP_FIELD_ALIASES)),
    qr_status: mapQrStatus(plainFromNamedProps(props, QR_FIELD_ALIASES)),
  }
}

export function registrationFromNotionPage(
  page: Record<string, unknown>,
  schema: Record<string, string>,
): Omit<
  Registration,
  | "metro"
  | "team_id_display"
  | "registration_mail_status"
  | "registration_mail_sent_at"
  | "registration_mail_count"
  | "rsvp_status"
  | "rsvp_sent_at"
  | "rsvp_count"
  | "qr_status"
  | "qr_token"
  | "qr_generated_at"
  | "qr_sent_at"
  | "qr_count"
> {
  const props = (page.properties || {}) as Record<string, unknown>
  const map = fields()
  const col = (key: keyof typeof map) => {
    const name = map[key]
    return name ? plainFromProp(props[name]) : ""
  }
  const skills = col("skills")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)

  return {
    id: String(page.id || ""),
    name: col("name"),
    address: col("address"),
    email: col("email"),
    phone: col("phone"),
    role: col("role"),
    team_id: col("team_id"),
    participation: col("participation"),
    are_you: col("are_you"),
    organization: col("organization"),
    city: col("city"),
    skills,
    experience: col("experience"),
    github: col("github"),
    linkedin: col("linkedin"),
    team_size: col("team_size"),
    registered_count: col("registered_count"),
    seats_remaining: col("seats_remaining"),
    team_status: col("team_status"),
    status: col("status"),
    created_at: String(page.created_time || page.last_edited_time || ""),
    property_types: schema,
  }
}

function coerceProperty(notionType: string, text: string) {
  if (notionType === "title") {
    return { title: text ? [{ text: { content: text } }] : [] }
  }
  if (notionType === "rich_text") {
    return { rich_text: text ? [{ text: { content: text } }] : [] }
  }
  if (notionType === "select") {
    return text ? { select: { name: text } } : { select: null }
  }
  if (notionType === "status") {
    return text ? { status: { name: text } } : { status: null }
  }
  if (notionType === "checkbox") {
    const on =
      Boolean(text) && !["none", "no", "false"].includes(text.toLowerCase())
    return { checkbox: on }
  }
  if (notionType === "date") {
    return text ? { date: { start: text } } : { date: null }
  }
  return null
}

function schemaColumn(schema: Record<string, string>, names: string[]) {
  for (const name of names) {
    if (schema[name]) return name
  }
  const keys = Object.keys(schema)
  for (const name of names) {
    const hit = keys.find((key) => key.toLowerCase() === name.toLowerCase())
    if (hit) return hit
  }
  return null
}

export async function updateNotionActionFields(
  pageId: string,
  values: {
    registration_mail_status?: string
    rsvp_status?: string
    qr_status?: string
  },
  schema: Record<string, string>,
) {
  const properties: Record<string, unknown> = {}
  const mailCol = schemaColumn(schema, REGISTRATION_MAIL_FIELD_ALIASES)
  const rsvpCol = schemaColumn(schema, RSVP_FIELD_ALIASES)
  const qrCol = schemaColumn(schema, QR_FIELD_ALIASES)
  if (mailCol && values.registration_mail_status) {
    const shaped = coerceProperty(schema[mailCol], values.registration_mail_status)
    if (shaped) properties[mailCol] = shaped
  }
  if (rsvpCol && values.rsvp_status) {
    const shaped = coerceProperty(schema[rsvpCol], values.rsvp_status)
    if (shaped) properties[rsvpCol] = shaped
  }
  if (qrCol && values.qr_status) {
    const shaped = coerceProperty(schema[qrCol], values.qr_status)
    if (shaped) properties[qrCol] = shaped
  }
  await patchNotionPage(pageId, properties)
}

async function patchNotionPage(
  pageId: string,
  properties: Record<string, unknown>,
) {
  if (Object.keys(properties).length === 0) return false
  const response = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: headers(),
    cache: "no-store",
    body: JSON.stringify({ properties }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Notion patch HTTP ${response.status}: ${body.slice(0, 200)}`)
  }
  return true
}

function checkInProperty(notionType: string, at: string, joined: boolean) {
  if (notionType === "checkbox") return { checkbox: joined }
  if (notionType === "date") return joined ? { date: { start: at } } : { date: null }
  if (notionType === "select") return joined ? { select: { name: "Joined" } } : { select: null }
  if (notionType === "status") return joined ? { status: { name: "Joined" } } : { status: null }
  if (notionType === "rich_text") {
    return joined
      ? { rich_text: [{ text: { content: `Joined ${at}` } }] }
      : { rich_text: [] }
  }
  return null
}

export async function ensureNotionCheckInField(schema: Record<string, string>) {
  if (schemaColumn(schema, CHECKIN_FIELD_ALIASES)) return schema
  const dbId = extractDatabaseId(databaseRef())
  const response = await fetch(`${NOTION_API}/databases/${dbId}`, {
    method: "PATCH",
    headers: headers(),
    cache: "no-store",
    body: JSON.stringify({
      properties: {
        "Check-in": { checkbox: {} },
      },
    }),
  })
  if (!response.ok) {
    const body = await response.text()
    console.error("notion check-in field create failed", body.slice(0, 200))
    return schema
  }
  return { ...schema, "Check-in": "checkbox" }
}

export async function updateNotionCheckIn(
  pageId: string,
  at: string,
  schema: Record<string, string>,
  joined = true,
) {
  const column = schemaColumn(schema, CHECKIN_FIELD_ALIASES)
  if (!column) return "skipped" as const
  const shaped = checkInProperty(schema[column] || "", at, joined)
  if (!shaped) return "skipped" as const
  try {
    await patchNotionPage(pageId, { [column]: shaped })
    return "updated" as const
  } catch (error) {
    console.error("notion check-in patch failed", error)
    return "failed" as const
  }
}
