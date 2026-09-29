"use client"

import * as React from "react"
import { toast } from "sonner"

import type { RosterPayload } from "@/lib/types"

export function useRoster() {
  const [data, setData] = React.useState<RosterPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
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

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const runAction = React.useCallback(
    async (
      url: string,
      body: Record<string, unknown>,
      success: string,
    ) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as { error?: string; note?: string }
      if (!response.ok) {
        toast.error(payload.error || "Action failed")
        return false
      }
      toast.success(payload.note || success)
      await refresh()
      return true
    },
    [refresh],
  )

  return { data, loading, error, refresh, runAction }
}
