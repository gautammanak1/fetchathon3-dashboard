import { redirect } from "next/navigation"

import { CheckInScanner } from "@/components/check-in-scanner"
import { DashboardShell } from "@/components/dashboard-shell"
import { getAdminSession } from "@/lib/auth"

export default async function Page() {
  const admin = await getAdminSession()
  if (!admin) redirect("/dashboard")
  return (
    <DashboardShell title="Check-in">
      <CheckInScanner showRoster />
    </DashboardShell>
  )
}
