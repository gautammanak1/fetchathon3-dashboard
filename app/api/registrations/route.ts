import { NextResponse } from "next/server"

import { loadRoster } from "@/lib/roster"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const roster = await loadRoster()
    return NextResponse.json(roster)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load Notion roster"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
