import { redirect } from "next/navigation"

import { CertificateBoard } from "@/components/certificate-board"
import { DashboardShell } from "@/components/dashboard-shell"
import { getAdminSession } from "@/lib/auth"
import { certificateBoard } from "@/lib/certificate"

export const dynamic = "force-dynamic"

export default async function Page() {
  const admin = await getAdminSession()
  if (!admin) redirect("/dashboard")
  const board = await certificateBoard()
  return (
    <DashboardShell title="Certificates">
      <CertificateBoard {...board} />
    </DashboardShell>
  )
}
