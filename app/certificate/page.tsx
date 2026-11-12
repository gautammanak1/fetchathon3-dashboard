import { CertificateForm } from "@/components/certificate-form"
import { FetchathonLogo } from "@/components/fetchathon-logo"
import { ModeToggle } from "@/components/mode-toggle"

export const dynamic = "force-dynamic"

export default function Page() {
  return (
    <main className="font-normal font-sans antialiased min-h-svh bg-background px-4 py-8">
      <div className="mx-auto grid w-full max-w-xl gap-6">
        <div className="flex items-center justify-between gap-4">
          <FetchathonLogo />
          <ModeToggle />
        </div>
        <div className="grid gap-2">
          <h1 className="text-2xl">Participant certificate</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Star the repository, then verify your GitHub username. Download and share appear only after the star is confirmed.
          </p>
        </div>
        <CertificateForm />
      </div>
    </main>
  )
}
