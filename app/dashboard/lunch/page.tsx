import { redirect } from "next/navigation"

import { CheckInScanner } from "@/components/check-in-scanner"
import { DashboardShell } from "@/components/dashboard-shell"
import { getAdminSession } from "@/lib/auth"

export default async function Page() {
  const admin = await getAdminSession()
  if (!admin) redirect("/dashboard")
  return (
    <DashboardShell title="Lunch">
      <CheckInScanner
        endpoint="/api/lunch"
        peopleLabel="Lunches collected"
        teamsLabel="Teams collected"
        title="Scan lunch QR"
        description="Point the camera at the lunch QR from the lunch agent. That code is the 4-digit pickup code. A confirm-mail team pass still marks the whole team. The registration Notion is left alone."
        manualPlaceholder="Or type the 4-digit lunch code"
        manualLabel="Lunch code"
        submitLabel="Mark collected"
        recentTitle="Recent pickups"
        recentDescription="People whose lunch was collected from a lunch QR or a team pass."
        recentEmpty="No lunches collected yet."
        alreadyLabel="Already collected"
        freshLabel="Collected"
        joinedLabel="Collected"
      />
    </DashboardShell>
  )
}
