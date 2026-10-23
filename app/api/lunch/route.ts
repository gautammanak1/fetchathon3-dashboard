import { NextResponse } from "next/server"

import { getAdminSession } from "@/lib/auth"
import { collectLunch, lunchSummary, undoLunch } from "@/lib/lunch"

export const dynamic = "force-dynamic"

async function denied() {
  const session = await getAdminSession()
  if (session) return null
  return NextResponse.json({ error: "Admin login required" }, { status: 401 })
}

export async function GET() {
  const blocked = await denied()
  if (blocked) return blocked
  try {
    return NextResponse.json(await lunchSummary())
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load lunch"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const blocked = await denied()
  if (blocked) return blocked
  const body = (await request.json().catch(() => null)) as {
    scan?: string
    undoId?: string
  } | null
  try {
    if (body?.undoId) {
      const result = await undoLunch(body.undoId)
      return NextResponse.json(result, { status: result.status })
    }
    if (!body?.scan?.trim()) {
      return NextResponse.json({ error: "Scan a venue QR" }, { status: 400 })
    }
    const result = await collectLunch(body.scan)
    return NextResponse.json(result, { status: result.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lunch scan failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
