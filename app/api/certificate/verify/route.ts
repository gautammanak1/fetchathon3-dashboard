import { NextResponse } from "next/server"

import { verifyCertificateStar } from "@/lib/certificate"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { github?: string } | null
  try {
    const result = await verifyCertificateStar({ github: String(body?.github || "") })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not check the star"
    const status = message.startsWith("GitHub") || message === "Database is not configured" ? 503 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
