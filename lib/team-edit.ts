import { createHmac, timingSafeEqual } from "node:crypto"

import { deleteMailPerson, insertMailPerson } from "@/lib/mail-db"
import { archiveNotionPage, createNotionTeamMember, isNotionConfigured } from "@/lib/notion"
import { appBaseUrl } from "@/lib/pass-url"
import { findRegistration, loadRosterFast } from "@/lib/roster"
import { EMAIL_RE } from "@/lib/smtp"
import { teamKey } from "@/lib/team-qr-store"
import type { Registration } from "@/lib/types"

const MAX_TEAM = 4

function secret() {
  return process.env.AUTH_SECRET || process.env.QR_SECRET || "fetchathon3-qr"
}

export function teamEditToken(teamKeyValue: string) {
  return createHmac("sha256", secret())
    .update(`team-edit:${teamKeyValue}`)
    .digest("hex")
    .slice(0, 24)
}

export function teamEditUrl(teamKeyValue: string) {
  return `${appBaseUrl()}/team/edit/${teamEditToken(teamKeyValue)}`
}

function tokensMatch(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export type TeamEditMember = {
  id: string
  name: string
  email: string
  phone: string
  role: string
}

export type TeamEditView = {
  key: string
  teamId: string
  venue: string
  members: TeamEditMember[]
}

function viewOf(key: string, members: Registration[]): TeamEditView {
  const lead = members.find((member) => member.role.toLowerCase() === "lead") || members[0]
  return {
    key,
    teamId: lead?.team_id_display || key,
    venue: lead?.city || "",
    members: members.map((member) => ({
      id: member.id,
      name: member.name || "Untitled",
      email: member.email || "",
      phone: member.phone || "",
      role: member.role || "Member",
    })),
  }
}

export async function findTeamEdit(token: string) {
  if (!/^[a-f0-9]{24}$/i.test(token)) return null
  const roster = await loadRosterFast()
  const seen = new Set<string>()
  for (const row of roster.registrations) {
    const key = teamKey(row)
    if (seen.has(key)) continue
    seen.add(key)
    if (!tokensMatch(teamEditToken(key), token.toLowerCase())) continue
    const members = roster.registrations.filter((item) => teamKey(item) === key)
    return viewOf(key, members)
  }
  return null
}

export async function teamEditUrlForPerson(id: string) {
  const roster = await loadRosterFast()
  const row = findRegistration(roster, id)
  if (!row) return null
  return teamEditUrl(teamKey(row))
}

async function teamFromToken(token: string) {
  if (!/^[a-f0-9]{24}$/i.test(token)) return null
  const roster = await loadRosterFast()
  const seen = new Set<string>()
  for (const row of roster.registrations) {
    const key = teamKey(row)
    if (seen.has(key)) continue
    seen.add(key)
    if (!tokensMatch(teamEditToken(key), token.toLowerCase())) continue
    const members = roster.registrations.filter((item) => teamKey(item) === key)
    return { key, members }
  }
  return null
}

export async function addTeamMember(
  token: string,
  input: { name: string; email: string; phone: string },
) {
  const team = await teamFromToken(token)
  if (!team) return { error: "This team link is not valid.", status: 404 as const }
  if (!isNotionConfigured()) {
    return { error: "Notion is not configured.", status: 500 as const }
  }
  const name = input.name.replace(/\s+/g, " ").trim()
  const email = input.email.trim().toLowerCase()
  const phone = input.phone.trim()
  if (name.length < 2) return { error: "Enter the new teammate's name.", status: 400 as const }
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email.", status: 400 as const }
  if (team.members.length >= MAX_TEAM) {
    return {
      error: "A team can have 4 people. Remove someone before adding a new teammate.",
      status: 400 as const,
    }
  }
  const roster = await loadRosterFast()
  const existing = roster.registrations.find(
    (row) => row.email.trim().toLowerCase() === email,
  )
  if (existing) {
    return { error: "That email is already registered.", status: 400 as const }
  }
  const source = team.members.find((member) => member.role.toLowerCase() === "lead") || team.members[0]
  const pageId = await createNotionTeamMember(source.id, { name, email, phone })
  try {
    await insertMailPerson({
      id: pageId,
      email,
      name,
      team_id: source.team_id_display || source.team_id,
      phone,
      role: "Member",
      organization: source.organization || "",
      participation: source.participation || "Team",
      city: source.city || "",
      registration_status: "Submitted",
    })
  } catch (error) {
    await archiveNotionPage(pageId).catch((archiveError) => {
      console.error("could not roll back new teammate", archiveError)
    })
    throw error
  }
  const next = await teamFromToken(token)
  return { team: next ? viewOf(next.key, next.members) : null }
}

export async function removeTeamMember(token: string, id: string) {
  const team = await teamFromToken(token)
  if (!team) return { error: "This team link is not valid.", status: 404 as const }
  if (!isNotionConfigured()) {
    return { error: "Notion is not configured.", status: 500 as const }
  }
  const member = team.members.find((item) => item.id === id)
  if (!member) return { error: "That person is not on this team.", status: 404 as const }
  if (team.members.length <= 1) {
    return { error: "A team needs at least one person.", status: 400 as const }
  }
  await archiveNotionPage(member.id)
  await deleteMailPerson(member.id)
  const next = await teamFromToken(token)
  return { team: next ? viewOf(next.key, next.members) : null }
}
