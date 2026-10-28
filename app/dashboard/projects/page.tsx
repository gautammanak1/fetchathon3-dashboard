import { ProjectBoard } from "@/components/project-board"
import { DashboardShell } from "@/components/dashboard-shell"
import { listProjects, type ProjectBoard as Board } from "@/lib/projects"
import { projectWinnerRank } from "@/lib/winners"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function publicBoard(board: Board): Board {
  const projects = board.projects
    .map((project) => ({
      ...project,
      self_rating: "",
      rating: null,
      score: null,
      comment: "",
      reviewer: "",
      reviewed_at: null,
      members: project.members.map((member) => ({ ...member, email: "" })),
    }))
    .sort(
      (a, b) =>
        projectWinnerRank(a.team_id, a.team_id_display) -
        projectWinnerRank(b.team_id, b.team_id_display),
    )
  return {
    ...board,
    projects,
    stats: { ...board.stats, scored: 0, reviewed: 0, average_score: null },
  }
}

export default async function Page() {
  const board = await listProjects()
  return (
    <DashboardShell title="Projects">
      <ProjectBoard initial={publicBoard(board)} />
    </DashboardShell>
  )
}
