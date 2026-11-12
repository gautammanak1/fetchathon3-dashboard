import { NextResponse } from "next/server"

import { downloadParticipantCertificate } from "@/lib/certificate"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { github?: string } | null
  try {
    const { pdf, name } = await downloadParticipantCertificate({
      github: String(body?.github || ""),
    })
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Fetch-A-Thon-3.0-certificate.pdf"`,
        "Cache-Control": "no-store",
        "X-Certificate-Name": encodeURIComponent(name),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not download the certificate"
    const status = message.startsWith("GitHub") || message === "Database is not configured" ? 503 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
