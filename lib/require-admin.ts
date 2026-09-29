import { NextResponse } from "next/server"

import { getAdminSession } from "@/lib/auth"

export async function requireAdmin() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json(
      { error: "Admin login required to send RSVP or QR" },
      { status: 401 },
    )
  }
  return null
}
