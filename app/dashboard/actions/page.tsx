import { redirect } from "next/navigation"

import { ActionsPage } from "@/components/dashboard-pages"
import { getAdminSession } from "@/lib/auth"
import { loadDashboardRoster } from "@/lib/roster"

export default async function Page() {
  const admin = await getAdminSession()
  if (!admin) redirect("/dashboard")
  const initial = await loadDashboardRoster()
  return <ActionsPage initial={initial} />
}
