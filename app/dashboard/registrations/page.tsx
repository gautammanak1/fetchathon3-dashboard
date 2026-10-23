import { RegistrationsPage } from "@/components/dashboard-pages"
import { loadDashboardRoster } from "@/lib/roster"

export default async function Page() {
  const initial = await loadDashboardRoster()
  return <RegistrationsPage initial={initial} />
}
