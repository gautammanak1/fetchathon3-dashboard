"use client"

import * as React from "react"
import { toast } from "sonner"

import { readJson } from "@/lib/read-json"
import type { Registration, RosterPayload } from "@/lib/types"

export type ActionPayload = {
  error?: string
  note?: string
  sentIds?: string[]
  generatedIds?: string[]
  remainingIds?: string[]
  done?: boolean
  failed?: Array<{ id: string }>
  count?: number
  sent?: number
  teams?: number
  jobId?: string
}

const QR_JOB_KEY = "fetchathon-qr-job"

type QrJobView = {
  id?: string
  error?: string
  status?: "running" | "done" | "error"
  mode?: "generate" | "send"
  sentIds?: string[]
  failed?: number
  total?: number
  note?: string
}

let patchQrPeople: ((ids: string[], mode: "generate" | "send") => void) | null = null
let watchToken = 0
let activeJobId: string | null = null

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function watchQrJob(jobId: string, label: string, onBatch?: (ids: string[]) => void) {
  const token = ++watchToken
  activeJobId = jobId
  const seen = new Set<string>()
  let pollErrors = 0
  try {
    while (token === watchToken) {
      let job: QrJobView
      try {
        const response = await fetch(`/api/actions/qr/job?id=${encodeURIComponent(jobId)}`, {
          cache: "no-store",
        })
        job = await readJson<QrJobView>(response)
        if (!response.ok) {
          toast.error(job.error || `${label} stopped`, { id: "qr-queue" })
          sessionStorage.removeItem(QR_JOB_KEY)
          return null
        }
      } catch {
        pollErrors += 1
        if (pollErrors >= 6 || token !== watchToken) {
          toast.message(`${label} keeps going on the server. Open this page again to watch it.`, {
            id: "qr-queue",
          })
          return { sentIds: [] as string[], note: "background" }
        }
        toast.loading(`${label}… still sending on the server. You can leave this page.`, {
          id: "qr-queue",
        })
        await sleep(3000)
        continue
      }
      if (token !== watchToken) return { sentIds: [], note: "continued" }
      if (!job.id) {
        toast.error(`${label} stopped`, { id: "qr-queue" })
        sessionStorage.removeItem(QR_JOB_KEY)
        return null
      }
      pollErrors = 0
      const mode = job.mode === "generate" ? "generate" : "send"
      const fresh = (job.sentIds || []).filter((id) => !seen.has(id))
      for (const id of fresh) seen.add(id)
      if (fresh.length) {
        patchQrPeople?.(fresh, mode)
        onBatch?.(fresh)
      }
      const sent = job.sentIds?.length || 0
      const total = job.total || sent
      if (job.status === "done") {
        sessionStorage.removeItem(QR_JOB_KEY)
        const failed = job.failed || 0
        const noun = sent === 1 ? "person" : "people"
        toast.success(
          failed
            ? `${label} finished, ${failed} failed`
            : sent === 0 && job.note
              ? job.note
              : `${label} finished for ${sent} ${noun}`,
          { id: "qr-queue" },
        )
        return { sentIds: job.sentIds || [], note: job.note || `${label} finished` }
      }
      if (job.status === "error") {
        sessionStorage.removeItem(QR_JOB_KEY)
        toast.error(job.note || `${label} stopped`, { id: "qr-queue" })
        return null
      }
      toast.loading(`${label}… ${sent} of ${total}. You can leave this page.`, { id: "qr-queue" })
      await sleep(3000)
    }
    return { sentIds: [], note: "continued" }
  } finally {
    if (token === watchToken) activeJobId = null
  }
}

export function useRoster(initial?: RosterPayload | null) {
  const [data, setData] = React.useState<RosterPayload | null>(initial ?? null)
  const [loading, setLoading] = React.useState(!initial)
  const [error, setError] = React.useState<string | null>(null)
  const seeded = React.useRef(Boolean(initial))

  const refresh = React.useCallback(async () => {
    if (!seeded.current) setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/registrations", { cache: "no-store" })
      const payload = await readJson<RosterPayload & { error?: string }>(response)
      if (!response.ok) {
        throw new Error(payload.error || "Could not load Notion roster")
      }
      seeded.current = true
      setData(payload)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load roster"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const patchPeople = React.useCallback((ids: string[], patch: Partial<Registration>) => {
    const chosen = new Set(ids)
    setData((current) => {
      if (!current) return current
      const mapRow = (row: Registration) => (chosen.has(row.id) ? { ...row, ...patch } : row)
      return {
        ...current,
        registrations: current.registrations.map(mapRow),
        teams: current.teams.map((team) => ({
          ...team,
          members: team.members.map(mapRow),
        })),
      }
    })
  }, [])

  React.useEffect(() => {
    patchQrPeople = (ids, mode) => {
      patchPeople(ids, {
        qr_status: mode === "send" ? "sent" : "generated",
        ...(mode === "send" ? { qr_sent_at: new Date().toISOString() } : {}),
      })
    }
  }, [patchPeople])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  React.useEffect(() => {
    const stored = window.sessionStorage.getItem(QR_JOB_KEY)
    if (!stored || activeJobId === stored) return
    void watchQrJob(stored, "Sending confirm mail")
  }, [])

  const runAction = React.useCallback(
    async (
      url: string,
      body: Record<string, unknown>,
      success: string,
      options?: { refresh?: boolean },
    ) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      let payload: ActionPayload
      try {
        payload = await readJson<ActionPayload>(response)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed")
        return null
      }
      if (!response.ok) {
        toast.error(payload.error || "Action failed")
        return null
      }
      toast.success(payload.note || success)
      if (options?.refresh !== false) await refresh()
      return payload
    },
    [refresh],
  )

  const runQrQueue = React.useCallback(
    async (
      body: {
        ids: string[]
        mode: "generate" | "send"
        force?: boolean
        onlySelected?: boolean
      },
      label: string,
      onBatch?: (ids: string[]) => void,
      onStarted?: () => void,
    ) => {
      const ids = [...new Set(body.ids.filter(Boolean))]
      if (ids.length === 0) {
        toast.error("Select at least one person")
        return null
      }
      toast.loading(`${label}… starting. You can leave this page.`, { id: "qr-queue" })
      try {
        const response = await fetch("/api/actions/qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, ids, background: true }),
        })
        const payload = await readJson<ActionPayload>(response)
        onStarted?.()
        if (!response.ok || !payload.jobId) {
          toast.error(payload.error || `${label} stopped`, { id: "qr-queue" })
          return null
        }
        sessionStorage.setItem(QR_JOB_KEY, payload.jobId)
        return await watchQrJob(payload.jobId, label, onBatch)
      } catch (err) {
        onStarted?.()
        toast.error(err instanceof Error ? err.message : `${label} stopped`, { id: "qr-queue" })
        return null
      }
    },
    [],
  )

  return { data, loading, error, refresh, runAction, runQrQueue, patchPeople }
}
