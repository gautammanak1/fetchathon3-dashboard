import { createHmac, timingSafeEqual } from "node:crypto"

import { mailMeta, persistMailRecords } from "@/lib/mail-db"
import {
  fetchNotionSchema,
  isNotionConfigured,
  updateNotionActionFields,
} from "@/lib/notion"
import { appBaseUrl } from "@/lib/pass-url"
import { loadRoster } from "@/lib/roster"
import { teamKey } from "@/lib/team-qr-store"
import type { Registration } from "@/lib/types"

function secret() {
  return process.env.AUTH_SECRET || process.env.QR_SECRET || "fetchathon3-qr"
}

export function rsvpConfirmToken(teamKeyValue: string) {
  return createHmac("sha256", secret())
    .update(`rsvp-confirm:${teamKeyValue}`)
    .digest("hex")
    .slice(0, 24)
}

export function rsvpConfirmUrl(teamKeyValue: string) {
  return `${appBaseUrl()}/rsvp/confirm/${rsvpConfirmToken(teamKeyValue)}`
}

function tokensMatch(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function findRsvpConfirmTeam(token: string) {
  if (!/^[a-f0-9]{24}$/i.test(token)) return null
  const roster = await loadRoster()
  const seen = new Set<string>()
  for (const row of roster.registrations) {
    const key = teamKey(row)
    if (seen.has(key)) continue
    seen.add(key)
    if (!tokensMatch(rsvpConfirmToken(key), token.toLowerCase())) continue
    const members = roster.registrations.filter((item) => teamKey(item) === key)
    return { key, members }
  }
  return null
}

async function writeNotionConfirmed(members: Registration[]) {
  if (!isNotionConfigured()) return
  try {
    const schema = await fetchNotionSchema()
    await Promise.all(
      members.map(async (member) => {
        try {
          await updateNotionActionFields(member.id, { rsvp_status: "Confirmed" }, schema)
        } catch (error) {
          console.error("notion rsvp confirm failed", member.id, error)
        }
      }),
    )
  } catch (error) {
    console.error("notion rsvp confirm schema failed", error)
  }
}

export async function confirmRsvpTeam(token: string) {
  const team = await findRsvpConfirmTeam(token)
  if (!team) return null
  const already = team.members.every((member) => member.rsvp_status === "confirmed")
  if (!already) {
    await persistMailRecords(
      team.members.map(mailMeta),
      { rsvp_status: "confirmed" },
    )
    await writeNotionConfirmed(team.members)
  }
  return {
    already,
    members: team.members.map((member) => ({
      name: member.name || "Untitled",
      role: member.role || "Member",
    })),
    teamId: team.members[0]?.team_id_display || team.key,
    city: team.members[0]?.city || "",
    metro: team.members[0]?.metro || "",
  }
}
