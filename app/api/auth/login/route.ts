import { NextResponse } from "next/server"

import {
  ADMIN_COOKIE,
  cookieOptions,
  credentialsConfigured,
  signSession,
  verifyCredentials,
} from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!credentialsConfigured()) {
    return NextResponse.json(
      { error: "Set ADMIN_EMAIL and ADMIN_PASSWORD in .env" },
      { status: 500 },
    )
  }

  const body = (await request.json()) as { email?: string; password?: string }
  const email = String(body.email || "")
  const password = String(body.password || "")
  if (!verifyCredentials(email, password)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true, email: email.trim().toLowerCase() })
  response.cookies.set(ADMIN_COOKIE, signSession(email.trim().toLowerCase()), cookieOptions())
  return response
}
