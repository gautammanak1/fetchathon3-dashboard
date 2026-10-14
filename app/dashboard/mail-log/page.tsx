import { redirect } from "next/navigation"

import { MailLogPage } from "@/components/mail-log"
import { getAdminSession } from "@/lib/auth"

export default async function Page() {
  const admin = await getAdminSession()
  if (!admin) redirect("/dashboard")
  return <MailLogPage />
}
