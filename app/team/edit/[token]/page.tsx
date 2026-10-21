import { TeamEditForm } from "@/components/team-edit-form"
import { findTeamEdit } from "@/lib/team-edit"

export const dynamic = "force-dynamic"

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const team = await findTeamEdit(token)

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10 font-normal font-sans antialiased">
      {team ? (
        <TeamEditForm
          token={token}
          teamId={team.teamId}
          venue={team.venue}
          members={team.members}
        />
      ) : (
        <p className="text-sm text-muted-foreground">This team link is not valid.</p>
      )}
    </main>
  )
}
