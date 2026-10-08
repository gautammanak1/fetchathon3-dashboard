import { NextResponse } from "next/server"

import { getAdminSession } from "@/lib/auth"
import {
  deleteMailTemplate,
  listMailTemplates,
  saveMailTemplate,
} from "@/lib/mail-template-store"

export const dynamic = "force-dynamic"

async function denied() {
  const session = await getAdminSession()
  if (session) return null
  return NextResponse.json({ error: "Admin login required" }, { status: 401 })
}

export async function GET() {
  const blocked = await denied()
  if (blocked) return blocked
  const templates = await listMailTemplates()
  return NextResponse.json({ templates })
}

export async function POST(request: Request) {
  const blocked = await denied()
  if (blocked) return blocked
  const body = (await request.json().catch(() => null)) as {
    id?: string
    name?: string
    subject?: string
    body?: string
  } | null
  try {
    const template = await saveMailTemplate({
      id: body?.id,
      name: String(body?.name || ""),
      subject: String(body?.subject || ""),
      body: String(body?.body || ""),
    })
    return NextResponse.json({ template })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save template"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const blocked = await denied()
  if (blocked) return blocked
  const body = (await request.json().catch(() => null)) as { id?: string } | null
  const id = String(body?.id || "").trim()
  if (!id) return NextResponse.json({ error: "Missing template" }, { status: 400 })
  const removed = await deleteMailTemplate(id)
  if (!removed) return NextResponse.json({ error: "Template not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
