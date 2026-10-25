import { readFileSync } from "node:fs"
import path from "node:path"

import { db, isoTime } from "@/lib/db"
import { extractDatabaseId, formatTeamId, normalizeTeamId } from "@/lib/fields"
import { loadRosterFast } from "@/lib/roster"
import type { Registration } from "@/lib/types"

const NOTION_API = "https://api.notion.com/v1"

// The integration can read "Fetchathon 3 Project Submissions".
// b8a8ba13d1754dcb88144470d4852f58 is not shared with this token.
const PROJECT_DATABASE_ID = "3f99efb9b84080c9a4e6d493fe3d0c47"

type SheetRow = {
  project_name: string
  framework: string
  description: string
  github_url: string
  video_url: string
  agent_url: string
  self_rating: string
  team_id: string
}

export type ProjectMember = {
  name: string
  email: string
  role: string
  organization: string
  lead: boolean
}

export type ProjectSubmission = {
  id: string
  source: "notion" | "sheet"
  status: string
  project_name: string
  team_name: string
  team_id: string
  team_id_display: string
  description: string
  location: string
  framework: string
  self_rating: string
  github_url: string
  video_url: string
  ppt_url: string
  deploy_url: string
  agent_url: string
  members: ProjectMember[]
  rating: number | null
  score: number | null
  comment: string
  reviewer: string
  reviewed_at: string | null
}

export type ProjectBoard = {
  projects: ProjectSubmission[]
  notice: string
  stats: {
    total: number
    submitted: number
    sheet: number
    scored: number
    reviewed: number
    average_score: number | null
  }
}

function projectReviewed(project: Pick<ProjectSubmission, "rating" | "score" | "comment">) {
  return project.rating != null || project.score != null || project.comment.trim().length > 0
}

type NotionProject = {
  id: string
  status: string
  project_name: string
  team_name: string
  team_id: string
  description: string
  location: string
  leader_name: string
  leader_email: string
  github_url: string
  video_url: string
  ppt_url: string
  deploy_url: string
  extras: { name: string; email: string }[]
}

type Review = {
  rating: number | null
  score: number | null
  comment: string
  reviewer: string
  reviewed_at: string | null
}

function projectDatabaseId() {
  return extractDatabaseId(
    process.env.NOTION_PROJECT_DATABASE_ID || PROJECT_DATABASE_ID,
  ).replace(/-/g, "")
}

function headers() {
  return {
    Authorization: `Bearer ${(process.env.NOTION_TOKEN || process.env.NOTION_API_KEY || "").trim()}`,
    "Notion-Version": (process.env.NOTION_VERSION || "2022-06-28").trim(),
    "Content-Type": "application/json",
  }
}

function plain(prop: unknown) {
  if (!prop || typeof prop !== "object") return ""
  const item = prop as Record<string, unknown>
  const type = String(item.type || "")
  if (type === "title" || type === "rich_text") {
    const list = (item[type] as { plain_text?: string }[]) || []
    return list.map((part) => part.plain_text || "").join("").trim()
  }
  if (type === "select") {
    return String((item.select as { name?: string } | null)?.name || "").trim()
  }
  if (type === "url") return String(item.url || "").trim()
  if (type === "email") return String(item.email || "").trim()
  if (type === "checkbox") return item.checkbox ? "yes" : ""
  if (type === "number" && item.number != null) return String(item.number)
  return ""
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index += 1
        } else quoted = false
      } else cell += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else if (char !== "\r") cell += char
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function loadSheetProjects() {
  const file = path.join(process.cwd(), "data/project-submissions.csv")
  const text = readFileSync(file, "utf8").replace(/^\uFEFF/, "")
  const table = parseCsv(text).slice(1)
  const projects: SheetRow[] = []
  for (const cells of table) {
    const teamId = normalizeTeamId(cells[8] || "")
    const description = (cells[2] || "").trim()
    if (!teamId) {
      const current = projects[projects.length - 1]
      if (!current) continue
      if (description) current.description = [current.description, description].filter(Boolean).join("\n")
      if (!current.agent_url && cells[3]) current.agent_url = cells[3].trim()
      if (!current.github_url && cells[4]) current.github_url = cells[4].trim()
      if (!current.video_url && cells[6]) current.video_url = cells[6].trim()
      continue
    }
    projects.push({
      project_name: (cells[0] || "").trim(),
      framework: (cells[1] || "").trim(),
      description,
      agent_url: (cells[3] || "").trim(),
      github_url: (cells[4] || "").trim(),
      video_url: (cells[6] || "").trim(),
      self_rating: (cells[7] || "").trim(),
      team_id: teamId,
    })
  }
  return projects
}

function sameProject(left: string, right: string) {
  const compact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "")
  const a = compact(left)
  const b = compact(right)
  if (!a || !b) return false
  if (a.includes(b) || b.includes(a)) return true
  const short = a.length < b.length ? a : b
  const long = a.length < b.length ? b : a
  for (let index = 0; index <= short.length - 6; index += 1) {
    if (long.includes(short.slice(index, index + 6))) return true
  }
  return false
}

function fuller(primary: string, extra: string) {
  const first = primary.trim()
  const second = extra.trim()
  if (!first) return second
  if (!second) return first
  return second.length > first.length ? second : first
}

async function loadNotionProjects() {
  const databaseId = projectDatabaseId()
  if (!databaseId || !(process.env.NOTION_TOKEN || process.env.NOTION_API_KEY)) {
    throw new Error("Notion project database is not configured")
  }
  const pages: NotionProject[] = []
  let cursor: string | undefined
  for (let page = 0; page < 20; page += 1) {
    const response = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
      cache: "no-store",
    })
    if (!response.ok) {
      throw new Error(`Notion project database returned ${response.status}`)
    }
    const data = (await response.json()) as {
      results?: Array<{ id: string; properties: Record<string, unknown> }>
      has_more?: boolean
      next_cursor?: string | null
    }
    for (const result of data.results || []) {
      const props = result.properties || {}
      if (plain(props.Reset) === "yes") continue
      const teamId = normalizeTeamId(plain(props["Team ID"]))
      if (!teamId) continue
      const extras = [1, 2, 3, 4, 5].flatMap((index) => {
        const name = plain(props[`Member ${index} Name`])
        const email = plain(props[`Member ${index} Email`])
        return name || email ? [{ name, email }] : []
      })
      pages.push({
        id: result.id,
        status: plain(props.Status) || "Submitted",
        project_name: plain(props["Project Name"]) || plain(props.Name) || "Untitled project",
        team_name: plain(props["Team Name"]) || plain(props.Name),
        team_id: teamId,
        description: plain(props.Description),
        location: plain(props.Location),
        leader_name: plain(props["Leader Name"]),
        leader_email: plain(props["Leader Email"]),
        github_url: plain(props["GitHub URL"]),
        video_url: plain(props["Video Demo"]),
        ppt_url: plain(props.PPT),
        deploy_url: plain(props["Deploy URL"]),
        extras,
      })
    }
    if (!data.has_more || !data.next_cursor) break
    cursor = data.next_cursor
  }
  return pages
}

async function loadReviews() {
  const sql = db()
  const map = new Map<string, Review>()
  if (!sql) return map
  const rows = await sql<
    Array<{
      team_id: string
      rating: number | null
      score: string | number | null
      comment: string
      reviewer: string
      updated_at: unknown
    }>
  >`select team_id, rating, score, comment, reviewer, updated_at from project_reviews`
  for (const row of rows) {
    const teamId = normalizeTeamId(row.team_id)
    if (!teamId) continue
    map.set(teamId, {
      rating: row.rating == null ? null : Number(row.rating),
      score: row.score == null || row.score === "" ? null : Number(row.score),
      comment: row.comment || "",
      reviewer: row.reviewer || "",
      reviewed_at: isoTime(row.updated_at),
    })
  }
  return map
}

function isLead(row: Registration, leaderEmail: string) {
  if (/lead/i.test(row.role)) return true
  return Boolean(leaderEmail) && row.email.trim().toLowerCase() === leaderEmail.trim().toLowerCase()
}

function membersFor(
  roster: Registration[],
  leaderName: string,
  leaderEmail: string,
  extras: { name: string; email: string }[],
) {
  const people: ProjectMember[] = roster.map((row) => ({
    name: row.name,
    email: row.email,
    role: row.role,
    organization: row.organization,
    lead: isLead(row, leaderEmail),
  }))
  const seen = new Set(people.map((person) => person.email.trim().toLowerCase()).filter(Boolean))
  const add = (name: string, email: string, lead: boolean) => {
    const key = email.trim().toLowerCase()
    if ((key && seen.has(key)) || people.some((person) => person.name.toLowerCase() === name.toLowerCase() && name)) {
      return
    }
    if (key) seen.add(key)
    if (!name && !email) return
    people.push({
      name: name || email,
      email,
      role: lead ? "Lead" : "Member",
      organization: "",
      lead,
    })
  }
  if (!people.some((person) => person.lead)) add(leaderName, leaderEmail, true)
  for (const extra of extras) add(extra.name, extra.email, false)
  people.sort((a, b) => Number(b.lead) - Number(a.lead) || a.name.localeCompare(b.name))
  return people
}

function withReview(
  project: Omit<ProjectSubmission, "rating" | "score" | "comment" | "reviewer" | "reviewed_at">,
  review: Review | undefined,
): ProjectSubmission {
  const next = {
    ...project,
    rating: review?.rating ?? null,
    score: review?.score ?? null,
    comment: review?.comment ?? "",
    reviewer: "",
    reviewed_at: review?.reviewed_at ?? null,
  }
  next.reviewer = projectReviewed(next) ? review?.reviewer || "" : ""
  return next
}

export async function listProjects(): Promise<ProjectBoard> {
  const sheet = loadSheetProjects()
  let notice = ""
  let notion: NotionProject[] = []
  try {
    notion = await loadNotionProjects()
  } catch (error) {
    notice = error instanceof Error ? error.message : "Could not read the project database"
  }
  const [roster, reviews] = await Promise.all([loadRosterFast(), loadReviews()])
  const byTeam = new Map<string, Registration[]>()
  for (const row of roster.registrations) {
    const teamId = normalizeTeamId(row.team_id)
    if (!teamId) continue
    const list = byTeam.get(teamId) || []
    list.push(row)
    byTeam.set(teamId, list)
  }
  const usedSheet = new Set<number>()
  const projects: ProjectSubmission[] = []
  for (const page of notion) {
    const matches = sheet
      .map((row, index) => ({ row, index }))
      .filter((item) => item.row.team_id === page.team_id && !usedSheet.has(item.index))
    const extra =
      matches.find((item) => sameProject(item.row.project_name, page.project_name)) ||
      (matches.length === 1 ? matches[0] : undefined)
    if (extra) usedSheet.add(extra.index)
    const sheetRow = extra?.row
    projects.push(
      withReview(
        {
          id: page.id,
          source: "notion",
          status: page.status,
          project_name: page.project_name,
          team_name: page.team_name,
          team_id: page.team_id,
          team_id_display: formatTeamId(page.team_id),
          description: fuller(page.description, sheetRow?.description || ""),
          location: page.location,
          framework: sheetRow?.framework || "",
          self_rating: sheetRow?.self_rating || "",
          github_url: fuller(page.github_url, sheetRow?.github_url || ""),
          video_url: fuller(page.video_url, sheetRow?.video_url || ""),
          ppt_url: page.ppt_url,
          deploy_url: page.deploy_url,
          agent_url: sheetRow?.agent_url || "",
          members: membersFor(
            byTeam.get(page.team_id) || [],
            page.leader_name,
            page.leader_email,
            page.extras,
          ),
        },
        reviews.get(page.team_id),
      ),
    )
  }
  sheet.forEach((row, index) => {
    if (usedSheet.has(index)) return
    const duplicate = projects.some(
      (project) => project.team_id === row.team_id && project.source === "sheet",
    )
    projects.push(
      withReview(
        {
          id: duplicate ? `sheet-${row.team_id}-${index}` : `sheet-${row.team_id}`,
          source: "sheet",
          status: "Sheet",
          project_name: row.project_name || "Untitled project",
          team_name: "",
          team_id: row.team_id,
          team_id_display: formatTeamId(row.team_id),
          description: row.description,
          location: "",
          framework: row.framework,
          self_rating: row.self_rating,
          github_url: row.github_url,
          video_url: row.video_url,
          ppt_url: "",
          deploy_url: "",
          agent_url: row.agent_url,
          members: membersFor(byTeam.get(row.team_id) || [], "", "", []),
        },
        reviews.get(row.team_id),
      ),
    )
  })
  projects.sort((a, b) => {
    const rank = (project: ProjectSubmission) =>
      project.status === "Submitted" ? 0 : project.source === "sheet" ? 1 : 2
    return rank(a) - rank(b) || a.project_name.localeCompare(b.project_name)
  })
  const scored = projects.filter((project) => project.score != null)
  const average =
    scored.length === 0
      ? null
      : Math.round((scored.reduce((sum, project) => sum + Number(project.score), 0) / scored.length) * 10) / 10
  return {
    projects,
    notice,
    stats: {
      total: projects.length,
      submitted: projects.filter((project) => project.status === "Submitted").length,
      sheet: projects.filter((project) => project.source === "sheet").length,
      scored: scored.length,
      reviewed: projects.filter((project) => projectReviewed(project)).length,
      average_score: average,
    },
  }
}

export async function saveProjectReview(input: {
  teamId: string
  rating: number | null
  score: number | null
  comment: string
  reviewer: string
}) {
  const teamId = normalizeTeamId(input.teamId)
  if (!teamId) throw new Error("Team id is missing")
  if (input.rating != null && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 10)) {
    throw new Error("Rating must be a whole number from 1 to 10")
  }
  if (input.score != null && (Number.isNaN(input.score) || input.score < 0 || input.score > 100)) {
    throw new Error("Score must be between 0 and 100")
  }
  const comment = input.comment.trim().slice(0, 4000)
  const marked = input.rating != null || input.score != null || comment.length > 0
  const reviewer = marked ? input.reviewer.trim().slice(0, 80) : ""
  if (marked && !reviewer) throw new Error("Add the reviewer's name")
  const sql = db()
  if (!sql) throw new Error("Review storage is not configured")
  const rows = await sql<
    Array<{
      rating: number | null
      score: string | number | null
      comment: string
      reviewer: string
      updated_at: unknown
    }>
  >`
    insert into project_reviews (team_id, rating, score, comment, reviewer, updated_at)
    values (${teamId}, ${input.rating}, ${input.score}, ${comment}, ${reviewer}, now())
    on conflict (team_id) do update set
      rating = excluded.rating,
      score = excluded.score,
      comment = excluded.comment,
      reviewer = excluded.reviewer,
      updated_at = now()
    returning rating, score, comment, reviewer, updated_at
  `
  const row = rows[0]
  return {
    team_id: teamId,
    rating: row?.rating == null ? null : Number(row.rating),
    score: row?.score == null || row.score === "" ? null : Number(row.score),
    comment: row?.comment || "",
    reviewer: row?.reviewer || "",
    reviewed_at: isoTime(row?.updated_at),
  }
}
