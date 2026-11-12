import { readFile } from "node:fs/promises"
import path from "node:path"

import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, rgb } from "pdf-lib"
import sharp from "sharp"

import { db } from "@/lib/db"

const CLAIM_ID = "certificateclaims"
const EXAMPLES_REPO = "fetchai/innovation-lab-examples"
const PAGE_WIDTH = 2200
const PAGE_HEIGHT = 1556

export const EXAMPLES_REPO_URL = "https://github.com/fetchai/innovation-lab-examples"

export type CertificateClaim = {
  email: string
  name: string
  github: string
  starredAt: string
  downloadedAt: string | null
}

export type CertificatePerson = {
  email: string
  name: string
  city: string
  github: string
}

function titleName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 2 && word === word.toUpperCase()) return word
      if (/[A-Z]/.test(word.slice(1))) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(" ")
}

export function githubUsername(value: string) {
  const text = value.trim().replace(/^@/, "")
  const fromUrl = text.match(/github\.com\/([A-Za-z0-9-]+)/i)
  const name = (fromUrl?.[1] || text).replace(/\.git$/, "")
  if (!/^[A-Za-z0-9-]{1,39}$/.test(name)) return ""
  return name
}

function parseClaims(value: unknown): CertificateClaim[] {
  if (typeof value !== "string" || !value.trim()) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return []
      const row = item as Partial<CertificateClaim>
      const email = String(row.email || "").trim().toLowerCase()
      const github = githubUsername(String(row.github || ""))
      if (!github) return []
      return [{
        email,
        name: String(row.name || "").trim(),
        github,
        starredAt: String(row.starredAt || ""),
        downloadedAt: row.downloadedAt ? String(row.downloadedAt) : null,
      }]
    })
  } catch {
    return []
  }
}

async function withClaims<T>(update: (claims: CertificateClaim[]) => { claims: CertificateClaim[]; result: T }) {
  const sql = db()
  if (!sql) throw new Error("Database is not configured")
  return sql.begin(async (tx) => {
    const rows = await tx<{ comment: string }[]>`
      select comment from project_reviews where team_id = ${CLAIM_ID} for update
    `
    const current = parseClaims(rows[0]?.comment)
    const next = update(current)
    const comment = JSON.stringify(next.claims)
    await tx`
      insert into project_reviews (team_id, rating, score, comment, reviewer, updated_at)
      values (${CLAIM_ID}, null, null, ${comment}, ${"certificate"}, now())
      on conflict (team_id) do update set
        comment = excluded.comment,
        reviewer = excluded.reviewer,
        updated_at = now()
    `
    return next.result
  })
}

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error("GitHub star check is not configured.")
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "fetchathon3-dashboard",
    "X-GitHub-Api-Version": "2022-11-28",
  }
}

let stargazerCache: { at: number; users: Set<string> } | null = null

async function stargazers() {
  if (stargazerCache && Date.now() - stargazerCache.at < 5 * 60 * 1000) return stargazerCache.users
  const users = new Set<string>()
  for (let page = 1; page <= 40; page += 1) {
    const response = await fetch(
      `https://api.github.com/repos/${EXAMPLES_REPO}/stargazers?per_page=100&page=${page}`,
      { headers: githubHeaders(), cache: "no-store" },
    )
    if (!response.ok) throw new Error("GitHub could not check the star. Try again in a minute.")
    const rows = (await response.json()) as { login?: string }[]
    if (!Array.isArray(rows) || rows.length === 0) break
    for (const row of rows) {
      const login = githubUsername(String(row.login || ""))
      if (login) users.add(login.toLowerCase())
    }
    if (rows.length < 100) break
  }
  stargazerCache = { at: Date.now(), users }
  return users
}

export async function githubHasStarred(username: string) {
  const users = await stargazers()
  return users.has(username.toLowerCase())
}

async function certificateName(username: string) {
  const sql = db()
  if (sql) {
    const rows = await sql<{ name: string; email: string; github: string }[]>`
      select name, email, github from mail_people
      where github ilike ${"%" + username + "%"}
      limit 30
    `
    const match = rows.find((row) => githubUsername(row.github).toLowerCase() === username.toLowerCase())
    if (match) {
      return {
        email: match.email.trim().toLowerCase(),
        name: titleName(match.name || "") || username,
      }
    }
  }
  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
    headers: githubHeaders(),
    cache: "no-store",
  })
  if (response.ok) {
    const profile = (await response.json()) as { name?: string | null }
    const name = titleName(profile.name || "")
    if (name) return { email: "", name }
  }
  return { email: "", name: username }
}

export async function verifyCertificateStar(input: { github: string }) {
  const github = githubUsername(input.github)
  if (!github) throw new Error("Enter a GitHub username.")
  const starred = await githubHasStarred(github)
  if (!starred) return { starred: false as const, name: "", github }
  const person = await certificateName(github)
  return { starred: true as const, name: person.name, github, email: person.email }
}

export async function participantCertificatePdf(name: string) {
  const root = process.cwd()
  const [png, fontBytes] = await Promise.all([
    readFile(path.join(root, "assets/certificates/participant.png")),
    readFile(path.join(root, "assets/certificates/Lexend-Bold.ttf")),
  ])
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const image = await pdf.embedPng(png)
  const font = await pdf.embedFont(fontBytes)
  page.drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT })
  let size = 72
  while (size > 28 && font.widthOfTextAtSize(name, size) > 1500) size -= 2
  const textWidth = font.widthOfTextAtSize(name, size)
  page.drawText(name, {
    x: (PAGE_WIDTH - textWidth) / 2,
    y: PAGE_HEIGHT - 890,
    size,
    font,
    color: rgb(95 / 255, 56 / 255, 251 / 255),
  })
  return Buffer.from(await pdf.save())
}

function certificateNameSvg(name: string, fontBytes: Buffer) {
  const font = fontkit.create(fontBytes)
  const run = font.layout(name)
  let size = 72
  while (size > 28 && run.advanceWidth * (size / font.unitsPerEm) > 1500) size -= 2
  const scale = size / font.unitsPerEm
  const textWidth = run.advanceWidth * scale
  const baseline = 890
  let pen = (PAGE_WIDTH - textWidth) / 2
  const paths = run.glyphs.map((glyph, index) => {
    const position = run.positions[index]
    const x = pen + position.xOffset * scale
    const y = baseline - position.yOffset * scale
    pen += position.xAdvance * scale
    const data = glyph.path.toSVG()
    if (!data) return ""
    return `<path d="${data}" transform="translate(${x} ${y}) scale(${scale} ${-scale})" fill="#5F38FB"/>`
  })
  return Buffer.from(
    `<svg width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${paths.join("")}</svg>`,
  )
}

export async function participantCertificatePng(name: string) {
  const root = process.cwd()
  const [png, fontBytes] = await Promise.all([
    readFile(path.join(root, "assets/certificates/participant.png")),
    readFile(path.join(root, "assets/certificates/Lexend-Bold.ttf")),
  ])
  const svg = certificateNameSvg(name, fontBytes)
  return sharp(png).composite([{ input: svg, top: 0, left: 0 }]).png().toBuffer()
}

export async function downloadParticipantCertificate(input: { github: string }) {
  const checked = await verifyCertificateStar(input)
  if (!checked.starred) throw new Error("Star the Innovation Lab examples repository first.")
  const pdf = await participantCertificatePdf(checked.name)
  const downloadedAt = new Date().toISOString()
  const github = checked.github.toLowerCase()
  await withClaims((claims) => {
    const previous = claims.find((claim) => claim.github.toLowerCase() === github)
    const claim: CertificateClaim = {
      email: checked.email || previous?.email || "",
      name: checked.name,
      github: checked.github,
      starredAt: previous?.starredAt || downloadedAt,
      downloadedAt: previous?.downloadedAt || downloadedAt,
    }
    return {
      claims: [claim, ...claims.filter((item) => item.github.toLowerCase() !== github)],
      result: true,
    }
  })
  return { pdf, name: checked.name }
}

export async function certificateBoard() {
  const sql = db()
  if (!sql) throw new Error("Database is not configured")
  const [people, claimRows] = await Promise.all([
    sql<CertificatePerson[]>`
      select lower(email) as email, min(name) as name, min(coalesce(city, '')) as city, min(coalesce(github, '')) as github
      from mail_people
      where email <> ''
      group by lower(email)
      order by min(name)
    `,
    sql<{ comment: string }[]>`select comment from project_reviews where team_id = ${CLAIM_ID}`,
  ])
  const claims = parseClaims(claimRows[0]?.comment)
  const savedClaims = claims.filter((claim) => claim.downloadedAt)
  const savedGithubs = new Set(savedClaims.map((claim) => claim.github.toLowerCase()))
  const byGithub = new Map(
    people.flatMap((person) => {
      const login = githubUsername(person.github).toLowerCase()
      return login ? [[login, person] as const] : []
    }),
  )
  const saved = savedClaims.map((claim) => {
    const person = byGithub.get(claim.github.toLowerCase())
    return {
      email: person?.email || claim.email,
      name: claim.name || titleName(person?.name || ""),
      city: person?.city || "",
      github: claim.github,
      downloadedAt: claim.downloadedAt || "",
    }
  })
  const missing = people
    .filter((person) => {
      const login = githubUsername(person.github).toLowerCase()
      return !login || !savedGithubs.has(login)
    })
    .map((person) => ({ ...person, name: titleName(person.name), github: githubUsername(person.github) }))
  return {
    registered: people.length,
    saved: saved.length,
    missing: missing.length,
    savedRows: saved.sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt)),
    missingRows: missing,
  }
}
