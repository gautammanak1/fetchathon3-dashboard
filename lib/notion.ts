import { extractDatabaseId, parseFieldMap } from "@/lib/fields"
import type { Registration } from "@/lib/types"

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
  const schema: Record<string, string> = {}
  for (const [name, meta] of Object.entries(data.properties || {})) {
    schema[name] = meta.type || ""
  }
  return schema
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

export function registrationFromNotionPage(
  page: Record<string, unknown>,
  schema: Record<string, string>,
): Omit<
  Registration,
  | "metro"
  | "team_id_display"
  | "rsvp_status"
  | "rsvp_sent_at"
  | "qr_status"
  | "qr_token"
  | "qr_generated_at"
  | "qr_sent_at"
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
  return null
}

export async function updateNotionActionFields(
  pageId: string,
  values: { rsvp_status?: string; qr_status?: string },
  schema: Record<string, string>,
) {
  const properties: Record<string, unknown> = {}
  const rsvpCol = schema["RSVP Status"] ? "RSVP Status" : null
  const qrCol = schema["QR Status"] ? "QR Status" : null
  if (rsvpCol && values.rsvp_status) {
    const shaped = coerceProperty(schema[rsvpCol], values.rsvp_status)
    if (shaped) properties[rsvpCol] = shaped
  }
  if (qrCol && values.qr_status) {
    const shaped = coerceProperty(schema[qrCol], values.qr_status)
    if (shaped) properties[qrCol] = shaped
  }
  if (Object.keys(properties).length === 0) return
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
}
