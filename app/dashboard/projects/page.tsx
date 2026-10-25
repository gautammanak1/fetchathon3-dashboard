import { redirect } from "next/navigation"

import { ProjectBoard } from "@/components/project-board"
import { DashboardShell } from "@/components/dashboard-shell"
import { getAdminSession } from "@/lib/auth"
import { listProjects } from "@/lib/projects"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export default async function Page() {
  const admin = await getAdminSession()
  if (!admin) redirect("/dashboard")
  const board = await listProjects()
  return (
    <DashboardShell title="Projects">
      <ProjectBoard initial={board} />
    </DashboardShell>
  )
}
