import { redirect } from "next/navigation"

import { RegistrationsPage } from "@/components/dashboard-pages"
import { getAdminSession } from "@/lib/auth"
import { loadDashboardRoster } from "@/lib/roster"

export default async function Page() {
  const admin = await getAdminSession()
  if (!admin) redirect("/dashboard/projects")
  const initial = await loadDashboardRoster()
  return <RegistrationsPage initial={initial} />
}
