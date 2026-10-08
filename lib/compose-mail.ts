export const COMPOSE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type MailFields = {
  name: string
  team: string
  venue: string
  email: string
}

const TOKEN =
  /\{\{\s*(name|team|venue|email)\s*\}\}/gi

export function fillTemplate(template: string, fields: MailFields) {
  const values: Record<string, string> = {
    name: fields.name || "there",
    team: fields.team || "",
    venue: fields.venue || "",
    email: fields.email || "",
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
