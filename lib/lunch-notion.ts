import { extractDatabaseId } from "@/lib/fields"

const NOTION_API = "https://api.notion.com/v1"

export type LunchNotionPerson = {
  id: string
  email: string
  name: string
  address: string
  teamId: string
}

export type LunchNotionPage = {
  id: string
  pageId: string
  created: boolean
}

function token() {
  return (process.env.NOTION_TOKEN || process.env.NOTION_API_KEY || "").trim()
}

function databaseId() {
  return extractDatabaseId(
    process.env.NOTION_LUNCH_DATABASE_ID || process.env.NOTION_LUNCH_DATABASE_URL || "",
  )
}

function version() {
  return (process.env.NOTION_VERSION || "2022-06-28").trim()
}

export function isLunchNotionConfigured() {
  return Boolean(token() && databaseId())
}

function headers() {
  return {
    Authorization: `Bearer ${token()}`,
    "Notion-Version": version(),
    "Content-Type": "application/json",
  }
}

function title(text: string) {
  return { title: text ? [{ text: { content: text } }] : [] }
}

function richText(text: string) {
  return { rich_text: text ? [{ text: { content: text } }] : [] }
}

function statusSelect(name: "Collected" | "Ordered") {
  return { select: { name } }
}

async function notion(path: string, init?: RequestInit) {
  const response = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
    cache: "no-store",
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Lunch Notion HTTP ${response.status}: ${body.slice(0, 180)}`)
  }
  return response.json() as Promise<Record<string, unknown>>
}

async function findPage(person: LunchNotionPerson) {
  const filters = []
  const address = person.address.trim()
  const email = person.email.trim()
  if (address) {
    filters.push({ property: "Address", rich_text: { equals: address } })
  }
  if (email) {
    filters.push({ property: "Email", email: { equals: email } })
  }
  if (!filters.length) return ""
  const data = await notion(`/databases/${databaseId()}/query`, {
    method: "POST",
    body: JSON.stringify({
      filter: filters.length === 1 ? filters[0] : { or: filters },
      page_size: 1,
    }),
  })
  const results = Array.isArray(data.results) ? data.results : []
  const page = results[0] as { id?: string } | undefined
  return String(page?.id || "")
}

async function createPage(person: LunchNotionPerson, at: string) {
  const properties: Record<string, unknown> = {
    Name: title(person.name || "Untitled"),
    Meal: richText("Lunch"),
    Status: statusSelect("Collected"),
    "Ordered at": { date: { start: at } },
    Sync: { checkbox: false },
    Reset: { checkbox: false },
  }
  if (person.email.trim()) properties.Email = { email: person.email.trim() }
  if (person.address.trim()) properties.Address = richText(person.address.trim())
  if (person.teamId.trim()) properties["Team ID"] = richText(person.teamId.trim())
  const data = await notion("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: databaseId() },
      properties,
    }),
  })
  return String(data.id || "")
}

async function patchStatus(pageId: string, name: "Collected" | "Ordered") {
  await notion(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: { Status: statusSelect(name) } }),
  })
}

export async function markLunchCollected(people: LunchNotionPerson[], at: string) {
  if (!isLunchNotionConfigured() || !people.length) {
    return { status: "skipped" as const, pages: [] as LunchNotionPage[] }
  }
  const pages: LunchNotionPage[] = []
  let failed = false
  for (const person of people) {
    try {
      const existing = await findPage(person)
      if (existing) {
        await patchStatus(existing, "Collected")
        pages.push({ id: person.id, pageId: existing, created: false })
        continue
      }
      const pageId = await createPage(person, at)
      if (!pageId) {
        failed = true
        continue
      }
      pages.push({ id: person.id, pageId, created: true })
    } catch (error) {
      failed = true
      console.error("lunch notion collect failed", error)
    }
  }
  if (!pages.length && failed) return { status: "failed" as const, pages }
  if (failed) return { status: "failed" as const, pages }
  return { status: "updated" as const, pages }
}

export async function releaseLunchNotion(pageId: string, created: boolean) {
  if (!pageId || !isLunchNotionConfigured()) return "skipped" as const
  try {
    if (created) {
      await notion(`/pages/${pageId}`, {
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      })
    } else {
      await patchStatus(pageId, "Ordered")
    }
    return "updated" as const
  } catch (error) {
    console.error("lunch notion undo failed", error)
    return "failed" as const
  }
}
