"use client"

import * as React from "react"
import { toast } from "sonner"

import type { Registration, RosterPayload } from "@/lib/types"

export type ActionPayload = {
  error?: string
  note?: string
  sentIds?: string[]
  count?: number
  sent?: number
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
      const payload = (await response.json()) as RosterPayload & { error?: string }
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
      const payload = (await response.json()) as ActionPayload
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

  return { data, loading, error, refresh, runAction, patchPeople }
}
