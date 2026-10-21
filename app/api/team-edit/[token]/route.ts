import { NextResponse } from "next/server"

import { addTeamMember, findTeamEdit, removeTeamMember } from "@/lib/team-edit"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params
  const team = await findTeamEdit(token)
  if (!team) return NextResponse.json({ error: "This team link is not valid." }, { status: 404 })
  return NextResponse.json({ team })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params
  const body = (await request.json().catch(() => null)) as {
    action?: string
    id?: string
    name?: string
    email?: string
    phone?: string
  } | null
  try {
    if (body?.action === "remove") {
      const result = await removeTeamMember(token, String(body.id || ""))
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }
      return NextResponse.json({ team: result.team })
    }
    if (body?.action === "add") {
      const result = await addTeamMember(token, {
        name: String(body.name || ""),
        email: String(body.email || ""),
        phone: String(body.phone || ""),
      })
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }
      return NextResponse.json({ team: result.team })
    }
    return NextResponse.json({ error: "Choose add or remove." }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the team"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
