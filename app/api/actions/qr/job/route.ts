import { NextResponse } from "next/server"

import {
  getMailJob,
  kickMailJobIfStale,
  latestRunningMailJob,
  publicMailJob,
} from "@/lib/mail-job"
import { requireAdmin } from "@/lib/require-admin"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied
  const id = new URL(request.url).searchParams.get("id")
  try {
    const job = id ? await getMailJob(id) : await latestRunningMailJob()
    if (!job) return NextResponse.json({ job: null })
    await kickMailJobIfStale(job)
    return NextResponse.json(publicMailJob(job))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the send"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
