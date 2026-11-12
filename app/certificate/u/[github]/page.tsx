import type { Metadata } from "next"

import { FetchathonLogo } from "@/components/fetchathon-logo"
import { ModeToggle } from "@/components/mode-toggle"
import { verifyCertificateStar } from "@/lib/certificate"
import { CERTIFICATE_SHARE_TEXT, certificateImagePath } from "@/lib/certificate-share"
import { appBaseUrl } from "@/lib/pass-url"

export const dynamic = "force-dynamic"

type Params = { github: string }

async function load(github: string) {
  return verifyCertificateStar({ github: decodeURIComponent(github) })
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { github } = await params
  const checked = await load(github)
  if (!checked.starred) return { title: "Participant certificate" }
  const image = `${appBaseUrl()}${certificateImagePath(checked.github)}`
  const title = `${checked.name} · Fetch-A-Thon 3.0`
  return {
    title,
    description: CERTIFICATE_SHARE_TEXT,
    openGraph: {
      title,
      description: CERTIFICATE_SHARE_TEXT,
      images: [{ url: image, width: 2200, height: 1556 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: CERTIFICATE_SHARE_TEXT,
      images: [image],
    },
  }
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { github } = await params
  const checked = await load(github)
  return (
    <main className="font-normal font-sans antialiased min-h-svh bg-background px-4 py-8">
      <div className="mx-auto grid w-full max-w-3xl gap-6">
        <div className="flex items-center justify-between gap-4">
          <FetchathonLogo />
          <ModeToggle />
        </div>
        {checked.starred ? (
          <img
            src={certificateImagePath(checked.github)}
            alt={`Fetch-A-Thon 3.0 certificate for ${checked.name}`}
            className="w-full rounded-lg border"
          />
        ) : (
          <p className="text-sm leading-6">Star the Innovation Lab examples repository, then verify your GitHub username.</p>
        )}
      </div>
    </main>
  )
}
