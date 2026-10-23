import { RsvpConfirmCard, RsvpConfirmMissing } from "@/components/rsvp-confirm-card"
import { mailVenue } from "@/lib/event-venues"
import { findRsvpConfirmTeam } from "@/lib/rsvp-confirm"

export const dynamic = "force-dynamic"

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ later?: string }>
}) {
  const { token } = await params
  const { later } = await searchParams
  const team = await findRsvpConfirmTeam(token)
  const venue = team ? mailVenue(team.members[0]?.city || "", team.members[0]?.metro || "") : null

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      {team && venue ? (
        <RsvpConfirmCard
          token={token}
          teamId={team.members[0]?.team_id_display || team.key}
          venue={venue.label}
          note={venue.note}
          imageUrl={venue.imageUrl}
          later={later === "1"}
          already={team.members.every((member) => member.rsvp_status === "confirmed")}
          members={team.members.map((member) => ({
            name: member.name || "Untitled",
            role: member.role || "Member",
          }))}
        />
      ) : (
        <RsvpConfirmMissing />
      )}
    </main>
  )
}
