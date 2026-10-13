import { NextResponse } from "next/server"

import { mailVenue } from "@/lib/event-venues"
import { confirmRsvpTeam } from "@/lib/rsvp-confirm"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: string } | null
  const token = String(body?.token || "").trim()
  if (!token) {
    return NextResponse.json({ error: "Missing confirmation link" }, { status: 400 })
  }
  try {
    const result = await confirmRsvpTeam(token)
    if (!result) {
      return NextResponse.json({ error: "This confirmation link is not valid" }, { status: 404 })
    }
    const venue = mailVenue(result.city, result.metro)
    return NextResponse.json({
      ok: true,
      already: result.already,
      teamId: result.teamId,
      venue: venue.label,
      members: result.members,
      note: result.already
        ? "This team was already confirmed."
        : "Your seat is confirmed.",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not confirm"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
