import { redirect } from "next/navigation"

import { TeamsPage } from "@/components/dashboard-pages"
import { getAdminSession } from "@/lib/auth"

export default async function Page() {
  const admin = await getAdminSession()
  if (!admin) redirect("/dashboard")
  return <TeamsPage />
}
