import { NextResponse } from "next/server"

import { loadRosterFast } from "@/lib/roster"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const roster = await loadRosterFast()
    return NextResponse.json(roster)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load Notion roster"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
