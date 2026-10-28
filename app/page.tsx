import { redirect } from "next/navigation"

import { getAdminSession } from "@/lib/auth"

export default async function Home() {
  const admin = await getAdminSession()
  redirect(admin ? "/dashboard" : "/dashboard/projects")
}
