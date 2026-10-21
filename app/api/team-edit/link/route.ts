import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/require-admin"
import { teamEditUrlForPerson } from "@/lib/team-edit"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied
  const body = (await request.json().catch(() => null)) as { id?: string } | null
  const id = String(body?.id || "").trim()
  if (!id) return NextResponse.json({ error: "Missing team member" }, { status: 400 })
  const url = await teamEditUrlForPerson(id)
  if (!url) return NextResponse.json({ error: "Team not found" }, { status: 404 })
  return NextResponse.json({ url })
}
