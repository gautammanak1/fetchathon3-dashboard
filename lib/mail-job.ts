import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import { after } from "next/server"

import { db } from "@/lib/db"
import { runQrBatch } from "@/lib/qr-batch"

export type MailJobMode = "generate" | "send"
export type MailJobStatus = "running" | "done" | "error"

export type MailJob = {
  id: string
  kind: string
  mode: MailJobMode
  force: boolean
  only_selected: boolean
  ids: string[]
  sent_ids: string[]
  failed_count: number
  attempt: number
  status: MailJobStatus
  note: string
  total: number
  locked_at: string | null
  updated_at: string | null
}

type JobRow = {
  id: string
  kind: string
  mode: string
  force: boolean
  only_selected: boolean
  ids: string[] | null
  sent_ids: string[] | null
  failed_count: number
  attempt: number
  status: string
  note: string | null
  total: number
  locked_at: Date | string | null
  updated_at: Date | string | null
}

const BUDGET_MS = 35_000
let schemaReady: Promise<void> | null = null

function secret() {
  return process.env.AUTH_SECRET || process.env.QR_SECRET || "fetchathon3-qr"
}

export function queueToken(jobId: string) {
  return createHmac("sha256", secret()).update(`qr-job:${jobId}`).digest("hex")
}

export function queueTokenMatches(jobId: string, token: string) {
  if (!jobId || !token) return false
  const expected = queueToken(jobId)
  const left = createHash("sha256").update(expected).digest()
  const right = createHash("sha256").update(token).digest()
  return timingSafeEqual(left, right)
}

function workerOrigin() {
  if (!process.env.VERCEL) return "http://localhost:3000"
  const configured = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.FETCHATHON_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "")
  if (configured) return configured.startsWith("http") ? configured : `https://${configured}`
  const host = (process.env.VERCEL_URL || "").trim()
  if (host) return host.startsWith("http") ? host : `https://${host}`
  return "http://localhost:3000"
}

function asText(value: Date | string | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function asJob(row: JobRow): MailJob {
  const mode: MailJobMode = row.mode === "generate" ? "generate" : "send"
  const status: MailJobStatus =
    row.status === "done" ? "done" : row.status === "error" ? "error" : "running"
  return {
    id: row.id,
    kind: row.kind,
    mode,
    force: row.force === true,
    only_selected: row.only_selected === true,
    ids: row.ids || [],
    sent_ids: row.sent_ids || [],
    failed_count: Number(row.failed_count || 0),
    attempt: Number(row.attempt || 0),
    status,
    note: row.note || "",
    total: Number(row.total || 0),
    locked_at: asText(row.locked_at),
    updated_at: asText(row.updated_at),
  }
}

async function sqlOrThrow() {
  const sql = db()
  if (!sql) throw new Error("Database is not configured")
  await ensureMailJobs()
  return sql
}

export function ensureMailJobs() {
  if (!schemaReady) {
    schemaReady = createMailJobTable().catch((error) => {
      schemaReady = null
      throw error
    })
  }
  return schemaReady
}

async function createMailJobTable() {
  const sql = db()
  if (!sql) throw new Error("Database is not configured")
  try {
    await sql`select 1 from mail_send_jobs limit 1`
  } catch {
    throw new Error("The confirm-mail queue table is missing. Apply the mail_send_jobs migration.")
  }
}

function textArray(values: string[]) {
  const sql = db()
  if (!sql) throw new Error("Database is not configured")
  return sql.array(values, 1009)
}

export async function getMailJob(id: string) {
  const sql = await sqlOrThrow()
  const rows = await sql<JobRow[]>`select * from mail_send_jobs where id = ${id} limit 1`
  return rows[0] ? asJob(rows[0]) : null
}

export async function latestRunningMailJob() {
  const sql = await sqlOrThrow()
  const rows = await sql<JobRow[]>`
    select * from mail_send_jobs
    where kind = 'qr' and status = 'running'
    order by created_at desc
    limit 1
  `
  return rows[0] ? asJob(rows[0]) : null
}

export function publicMailJob(job: MailJob) {
  return {
    id: job.id,
    status: job.status,
    mode: job.mode,
    sentIds: job.sent_ids,
    remaining: job.ids.length,
    failed: job.failed_count,
    total: job.total,
    note: job.note,
    lockedAt: job.locked_at,
  }
}

export async function startMailJob(input: {
  ids: string[]
  mode: MailJobMode
  force: boolean
  onlySelected: boolean
}) {
  const sql = await sqlOrThrow()
  const ids = [...new Set(input.ids.filter(Boolean))]
  const existing = await latestRunningMailJob()
  if (existing) {
    const same =
      existing.mode === input.mode &&
      existing.force === input.force &&
      existing.only_selected === input.onlySelected
    if (!same) {
      throw new Error("A mail send is already running. Wait for it to finish.")
    }
    const merged = [...new Set([...existing.ids, ...ids])]
    const added = merged.length - existing.ids.length
    const rows = await sql<JobRow[]>`
      update mail_send_jobs
      set ids = ${textArray(merged)},
          total = total + ${added},
          updated_at = now()
      where id = ${existing.id}
      returning *
    `
    const job = asJob(rows[0])
    kickMailJob(job.id)
    return job
  }

  const id = randomUUID()
  const rows = await sql<JobRow[]>`
    insert into mail_send_jobs (
      id, kind, mode, force, only_selected, ids, sent_ids, total, note
    ) values (
      ${id},
      'qr',
      ${input.mode},
      ${input.force},
      ${input.onlySelected},
      ${textArray(ids)},
      ${textArray([])},
      ${ids.length},
      'Sending on the server. You can leave this page.'
    )
    returning *
  `
  const job = asJob(rows[0])
  kickMailJob(job.id)
  return job
}

export function kickMailJob(jobId: string) {
  after(() => postWorker(jobId))
}

export async function kickMailJobIfStale(job: MailJob) {
  if (job.status !== "running") return
  const lockedAt = job.locked_at ? Date.parse(job.locked_at) : 0
  const updatedAt = job.updated_at ? Date.parse(job.updated_at) : 0
  const lockHeldTooLong = lockedAt > 0 && Date.now() - lockedAt > 120_000
  const idle = !lockedAt && updatedAt > 0 && Date.now() - updatedAt > 15_000
  if (lockHeldTooLong || idle) kickMailJob(job.id)
}

async function postWorker(jobId: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-queue-token": queueToken(jobId),
  }
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  if (bypass) headers["x-vercel-protection-bypass"] = bypass
  const response = await fetch(`${workerOrigin()}/api/actions/qr/worker`, {
    method: "POST",
    headers,
    body: JSON.stringify({ jobId, token: headers["x-queue-token"] }),
  })
  if (!response.ok) {
    throw new Error(`Queue worker returned ${response.status}`)
  }
}

async function claimMailJob(id: string) {
  const sql = await sqlOrThrow()
  const rows = await sql<JobRow[]>`
    update mail_send_jobs
    set locked_at = now(), updated_at = now()
    where id = ${id}
      and status = 'running'
      and (locked_at is null or locked_at < now() - interval '120 seconds')
    returning *
  `
  return rows[0] ? asJob(rows[0]) : null
}

async function saveMailJob(
  job: MailJob,
  patch: {
    ids?: string[]
    sentIds?: string[]
    failedCount?: number
    attempt?: number
    status?: MailJobStatus
    note?: string
    release?: boolean
  },
) {
  const sql = await sqlOrThrow()
  const ids = patch.ids ?? job.ids
  const sentIds = patch.sentIds ?? job.sent_ids
  const status = patch.status ?? job.status
  const rows = await sql<JobRow[]>`
    update mail_send_jobs
    set ids = ${textArray(ids)},
        sent_ids = ${textArray(sentIds)},
        failed_count = ${patch.failedCount ?? job.failed_count},
        attempt = ${patch.attempt ?? job.attempt},
        status = ${status},
        note = ${patch.note ?? job.note},
        locked_at = case
          when ${Boolean(patch.release) || status !== "running"} then null
          else locked_at
        end,
        updated_at = now()
    where id = ${job.id}
    returning *
  `
  return asJob(rows[0])
}

export async function advanceMailJob(jobId: string) {
  let job = await claimMailJob(jobId)
  if (!job) return
  const started = Date.now()
  try {
    while (job.status === "running" && job.ids.length > 0) {
      const result = await runQrBatch({
        ids: job.ids,
        mode: job.mode,
        force: job.force,
        onlySelected: job.only_selected,
        queue: true,
      })
      if (result.error) throw new Error(result.error)
      const touched = result.sentIds.length ? result.sentIds : result.generatedIds
      if (result.done || result.remainingIds.length === 0) {
        job = await saveMailJob(job, {
          ids: [],
          sentIds: [...new Set([...job.sent_ids, ...touched])],
          failedCount: job.failed_count + result.failed.length,
          attempt: 0,
          status: "done",
          note: result.note,
          release: true,
        })
        return
      }
      if (touched.length === 0) {
        const attempt = job.attempt + 1
        if (attempt >= 3) {
          const drop = new Set(result.batchIds)
          const ids = job.ids.filter((id) => !drop.has(id))
          const failedCount = job.failed_count + (result.failed.length || result.batchIds.length)
          if (ids.length === 0) {
            await saveMailJob(job, {
              ids: [],
              failedCount,
              attempt: 0,
              status: "error",
              note: result.note || "Some confirm mails failed and were skipped.",
              release: true,
            })
            return
          }
          job = await saveMailJob(job, {
            ids,
            failedCount,
            attempt: 0,
            note: result.note || "Skipped a team that failed three times.",
          })
          continue
        }
        await saveMailJob(job, {
          attempt,
          note: result.note || "Retrying a team that failed to send.",
          release: true,
        })
        await sleep(2000)
        await postWorker(job.id)
        return
      }
      job = await saveMailJob(job, {
        ids: result.remainingIds,
        sentIds: [...new Set([...job.sent_ids, ...touched])],
        failedCount: job.failed_count + result.failed.length,
        attempt: 0,
        note: result.note,
      })
      if (Date.now() - started > BUDGET_MS) break
    }
    if (job.status === "running" && job.ids.length > 0) {
      await saveMailJob(job, { release: true })
      await postWorker(job.id)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Confirm mail stopped"
    try {
      await saveMailJob(job, {
        attempt: job.attempt + 1,
        status: job.attempt + 1 >= 3 ? "error" : "running",
        note: message,
        release: true,
      })
      if (job.attempt + 1 < 3) {
        await sleep(2000)
        await postWorker(job.id)
      }
    } catch {
      // The next page visit claims the job again once the lock is stale.
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
