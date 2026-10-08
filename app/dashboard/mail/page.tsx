import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/dashboard-shell"
import { MailComposer } from "@/components/mail-composer"
import { getAdminSession } from "@/lib/auth"

export default async function Page() {
  const admin = await getAdminSession()
  if (!admin) redirect("/dashboard")
  return (
    <DashboardShell title="Mail">
      <MailComposer />
    </DashboardShell>
  )
}
