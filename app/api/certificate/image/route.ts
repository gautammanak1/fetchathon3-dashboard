import { NextResponse } from "next/server"

import { participantCertificatePng, verifyCertificateStar } from "@/lib/certificate"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const github = new URL(request.url).searchParams.get("github") || ""
  try {
    const checked = await verifyCertificateStar({ github })
    if (!checked.starred) {
      return NextResponse.json({ error: "Star the Innovation Lab examples repository first." }, { status: 404 })
    }
    const png = await participantCertificatePng(checked.name)
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not make the certificate"
    const status = message.startsWith("GitHub") || message === "Database is not configured" ? 503 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
