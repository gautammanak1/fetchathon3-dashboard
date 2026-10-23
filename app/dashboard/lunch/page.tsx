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
        description="Point the camera at the team pass from the confirm mail. Supabase records the pickup, and the Fetchathon 3 Lunch Notion row is marked Collected. The registration Notion is left alone."
        submitLabel="Mark collected"
        recentTitle="Recent pickups"
        recentDescription="People whose lunch was collected from a scanned pass."
        recentEmpty="No lunches collected yet."
        alreadyLabel="Already collected"
        freshLabel="Collected"
        joinedLabel="Collected"
      />
    </DashboardShell>
  )
}
