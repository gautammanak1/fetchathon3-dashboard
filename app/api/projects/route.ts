import { NextResponse } from "next/server"

import { getAdminSession } from "@/lib/auth"
import { listProjects, saveProjectReview } from "@/lib/projects"

export const dynamic = "force-dynamic"
export const maxDuration = 60

async function denied() {
  const session = await getAdminSession()
  if (session) return null
  return NextResponse.json({ error: "Admin login required" }, { status: 401 })
}

export async function GET() {
  const blocked = await denied()
  if (blocked) return blocked
  try {
    return NextResponse.json(await listProjects())
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load projects"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: "Admin login required" }, { status: 401 })
  }
  const body = (await request.json().catch(() => null)) as {
    team_id?: string
    rating?: number | null
    score?: number | string | null
    comment?: string
    reviewer?: string
  } | null
  if (!body?.team_id) {
    return NextResponse.json({ error: "Pick a team project first" }, { status: 400 })
  }
  const score =
    body.score == null || body.score === ""
      ? null
      : Number(body.score)
  try {
    const saved = await saveProjectReview({
      teamId: body.team_id,
      rating: body.rating == null ? null : Number(body.rating),
      score,
      comment: body.comment || "",
      reviewer: body.reviewer || "",
    })
    return NextResponse.json(saved)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the review"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
