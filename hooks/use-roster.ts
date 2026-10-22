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
}

export function useRoster(initial?: RosterPayload | null) {
  const [data, setData] = React.useState<RosterPayload | null>(initial ?? null)
  const [loading, setLoading] = React.useState(!initial)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/registrations", { cache: "no-store" })
      const payload = await readJson<RosterPayload & { error?: string }>(response)
      if (!response.ok) {
        throw new Error(payload.error || "Could not load Notion roster")
      }
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
    if (initial) return
    void refresh()
  }, [initial, refresh])

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
    ) => {
      const toastId = "qr-queue"
      let pending = [...new Set(body.ids.filter(Boolean))]
      const total = pending.length
      if (total === 0) {
        toast.error("Select at least one person")
        return null
      }
      let people = 0
      let failed = 0
      let steps = 0
      let lastNote = ""
      try {
        while (pending.length > 0 && steps < 400) {
          steps += 1
          toast.loading(`${label}… ${total - pending.length} of ${total}`, { id: toastId })
          const response = await fetch("/api/actions/qr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, ids: pending, queue: true }),
          })
          const payload = await readJson<ActionPayload>(response)
          if (!response.ok) {
            toast.error(payload.error || `${label} stopped`, { id: toastId })
            return null
          }
          const touched = payload.sentIds?.length ? payload.sentIds : payload.generatedIds || []
          if (touched.length) onBatch?.(touched)
          people += touched.length
          failed += payload.failed?.length || 0
          lastNote = payload.note || lastNote
          const next = payload.remainingIds || []
          if (next.length >= pending.length) {
            toast.error(`${label} stopped before it finished`, { id: toastId })
            return null
          }
          pending = next
          if (payload.done || next.length === 0) break
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `${label} stopped`, { id: toastId })
        return null
      }
      if (pending.length > 0) {
        toast.error(`${label} stopped before it finished`, { id: toastId })
        return null
      }
      const noun = people === 1 ? "person" : "people"
      toast.success(
        failed
          ? `${label} finished, ${failed} failed`
          : people === 0 && lastNote
            ? lastNote
            : `${label} finished for ${people} ${noun}`,
        { id: toastId },
      )
      return { sentIds: [], note: `${label} finished` }
    },
    [],
  )

  return { data, loading, error, refresh, runAction, runQrQueue, patchPeople }
}
