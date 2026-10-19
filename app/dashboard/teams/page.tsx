import { redirect } from "next/navigation"

import { TeamsPage } from "@/components/dashboard-pages"
import { getAdminSession } from "@/lib/auth"
import { loadRoster, loadStoredRoster } from "@/lib/roster"

export default async function Page() {
  const admin = await getAdminSession()
  if (!admin) redirect("/dashboard")
  const stored = await loadStoredRoster()
  const initial = stored ?? (await loadRoster())
  return <TeamsPage initial={initial} />
}
