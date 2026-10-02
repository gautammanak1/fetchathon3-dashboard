import { VenuePassCard, VenuePassMissing } from "@/components/venue-pass-card"
import { loadVenuePass } from "@/lib/venue-pass"

export const dynamic = "force-dynamic"

export default async function VenuePassPage({
  params,
}: PageProps<"/pass/[token]">) {
  const { token } = await params
  const pass = await loadVenuePass(token)

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      {pass ? <VenuePassCard pass={pass} /> : <VenuePassMissing />}
    </main>
  )
}
