import { redirect } from "next/navigation"

import { TeamsPage } from "@/components/dashboard-pages"
import { getAdminSession } from "@/lib/auth"
import { loadRoster } from "@/lib/roster"

export default async function Page() {
  const admin = await getAdminSession()
  if (!admin) redirect("/dashboard")
  const initial = await loadRoster()
  return <TeamsPage initial={initial} />
}
