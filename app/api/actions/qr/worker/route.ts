import { NextResponse } from "next/server"
import { after } from "next/server"

import { advanceMailJob, queueTokenMatches } from "@/lib/mail-job"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { jobId?: string } | null
  const jobId = body?.jobId || ""
  const token = request.headers.get("x-queue-token") || ""
  if (!queueTokenMatches(jobId, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  after(() => advanceMailJob(jobId))
  return NextResponse.json({ ok: true })
}
