import { FeedbackForm } from "@/components/feedback-form"
import { FetchathonLogo } from "@/components/fetchathon-logo"
import { ModeToggle } from "@/components/mode-toggle"

export const dynamic = "force-dynamic"

export default function Page() {
  return (
    <main className="font-normal font-sans antialiased min-h-svh bg-background px-4 py-8">
      <div className="mx-auto grid w-full max-w-2xl gap-6">
        <div className="flex items-center justify-between gap-4">
          <FetchathonLogo />
          <ModeToggle />
        </div>
        <div className="grid gap-2">
          <h1 className="text-2xl">Fetch-A-Thon 3.0 feedback</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Tell us what worked and what did not. The problems matter as much as the praise. We will use this to fix the next one.
          </p>
        </div>
        <FeedbackForm />
      </div>
    </main>
  )
}
