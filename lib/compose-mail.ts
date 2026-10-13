export const COMPOSE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type MailFields = {
  name: string
  team: string
  venue: string
  email: string
  confirm_url?: string
}

const TOKEN =
  /\{\{\s*(name|team|venue|email|confirm_url)\s*\}\}/gi

export function readableName(name: string, email = "") {
  const cleaned = name.replace(/\s+/g, " ").trim()
  if (cleaned && cleaned.toLowerCase() !== "there") return cleaned
  const local = email.split("@")[0] || ""
  const words = local
    .split(/[._+-]+/)
    .map((part) => part.replace(/\d+$/g, ""))
    .filter((part) => part.length > 1)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  return words.join(" ")
}

export function fillTemplate(template: string, fields: MailFields) {
  const values: Record<string, string> = {
    name: readableName(fields.name, fields.email),
    team: fields.team || "",
    venue: fields.venue || "",
    email: fields.email || "",
    confirm_url: fields.confirm_url || "",
  }
  return template.replace(TOKEN, (match, key: string) => values[key.toLowerCase()] ?? match)
}

export function parseEmailList(raw: string) {
  const seen = new Set<string>()
  const emails: string[] = []
  for (const part of raw.split(/[\s,;]+/)) {
    const email = part.trim().toLowerCase()
    if (!COMPOSE_EMAIL_RE.test(email) || seen.has(email)) continue
    seen.add(email)
    emails.push(email)
  }
  return emails
}
