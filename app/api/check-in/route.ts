import { NextResponse } from "next/server"

import { getAdminSession } from "@/lib/auth"
import { checkInFromScan, checkInSummary, undoCheckIn } from "@/lib/checkin"

export const dynamic = "force-dynamic"

async function denied() {
  const session = await getAdminSession()
  if (session) return null
  return NextResponse.json({ error: "Admin login required" }, { status: 401 })
}

export async function GET() {
  const blocked = await denied()
  if (blocked) return blocked
  return NextResponse.json(await checkInSummary())
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
      const result = await undoCheckIn(body.undoId)
      return NextResponse.json(result, { status: result.status })
    }
    if (!body?.scan?.trim()) {
      return NextResponse.json({ error: "Scan a venue QR" }, { status: 400 })
    }
    const result = await checkInFromScan(body.scan)
    return NextResponse.json(result, { status: result.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check-in failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
