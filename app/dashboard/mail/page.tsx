import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/dashboard-shell"
import { MailComposer } from "@/components/mail-composer"
import { getAdminSession } from "@/lib/auth"
import { loadDashboardRoster } from "@/lib/roster"

export default async function Page() {
  const admin = await getAdminSession()
  if (!admin) redirect("/dashboard")
  const initial = await loadDashboardRoster()
  return (
    <DashboardShell title="Mail">
      <MailComposer initial={initial} />
    </DashboardShell>
  )
}
