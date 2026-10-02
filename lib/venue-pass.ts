import { isPassToken } from "@/lib/pass-url"
import { loadRoster } from "@/lib/roster"
import { findTeamQrByToken, teamKey } from "@/lib/team-qr-store"

export type VenuePassMember = {
  name: string
  role: string
  organization: string
  city: string
  builder: string
}

export type VenuePass = {
  token: string
  teamId: string
  venue: string
  members: VenuePassMember[]
}

export async function loadVenuePass(token: string): Promise<VenuePass | null> {
  if (!isPassToken(token)) return null
  const record = await findTeamQrByToken(token)
  if (!record) return null
  const roster = await loadRoster()
  const members = roster.registrations
    .filter((row) => teamKey(row) === record.team_key)
    .map((row) => ({
      name: row.name || "Untitled",
      role: row.role || "Member",
      organization: row.organization || "—",
      city: row.city || record.venue || "—",
      builder: row.are_you || "—",
    }))
  return {
    token: record.token,
    teamId: record.team_id_display || "Team",
    venue: record.venue || members[0]?.city || "Venue",
    members,
  }
}
