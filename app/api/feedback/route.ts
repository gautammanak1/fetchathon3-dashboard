import { NextResponse } from "next/server"

import { parseFeedback, saveFeedback } from "@/lib/feedback"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  try {
    const input = parseFeedback(body)
    const id = await saveFeedback(input)
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save feedback"
    const status = message === "Database is not configured" ? 500 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
