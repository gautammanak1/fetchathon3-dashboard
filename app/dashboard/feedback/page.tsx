import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/dashboard-shell"
import { FeedbackInbox } from "@/components/feedback-inbox"
import { getAdminSession } from "@/lib/auth"
import { listFeedback } from "@/lib/feedback"

export const dynamic = "force-dynamic"

export default async function Page() {
  const admin = await getAdminSession()
  if (!admin) redirect("/dashboard")
  const rows = await listFeedback()
  return (
    <DashboardShell title="Feedback">
      <FeedbackInbox rows={rows} />
    </DashboardShell>
  )
}
