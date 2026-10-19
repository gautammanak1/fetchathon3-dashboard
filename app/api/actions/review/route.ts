import { NextResponse } from "next/server"

import { setReviewStatus } from "@/lib/mail-db"
import { requireAdmin } from "@/lib/require-admin"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = (await request.json()) as { ids?: string[]; status?: string }
  const ids = [...new Set((body.ids || []).filter(Boolean))]
  const status = body.status === "pending" ? "pending" : body.status === "reviewed" ? "reviewed" : ""
  if (ids.length === 0) {
    return NextResponse.json({ error: "Select at least one person" }, { status: 400 })
  }
  if (!status) {
    return NextResponse.json({ error: "Choose reviewed or pending" }, { status: 400 })
  }

  try {
    const saved = await setReviewStatus(ids, status)
    return NextResponse.json({
      ok: true,
      ids: saved,
      review_status: status,
      note:
        status === "reviewed"
          ? `Marked ${saved.length} ${saved.length === 1 ? "person" : "people"} reviewed`
          : `Moved ${saved.length} ${saved.length === 1 ? "person" : "people"} back to review pending`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update review"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
