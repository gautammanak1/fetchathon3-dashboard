"use client"

import * as React from "react"

import { ActionBar } from "@/components/action-bar"
import { QrPreviewDialog } from "@/components/qr-preview-dialog"
import { RegistrationDetail } from "@/components/registration-detail"
import { RegistrationFilters } from "@/components/registration-filters"
import { RegistrationTable } from "@/components/registration-table"
import { useAuth } from "@/hooks/use-auth"
import { EMPTY_FILTERS, filterRegistrations } from "@/lib/filters"
import type { Filters, Registration } from "@/lib/types"

export function RosterWorkspace({
  rows,
  onRegistration,
  onRsvp,
  onGenerateQr,
  onSendQr,
  busy,
}: {
  rows: Registration[]
  onRegistration: (ids: string[]) => Promise<boolean>
  onRsvp: (ids: string[]) => Promise<boolean>
  onGenerateQr: (ids: string[]) => Promise<boolean>
  onSendQr: (ids: string[]) => Promise<boolean>
  busy: boolean
}) {
  const { isAdmin } = useAuth()
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [openRow, setOpenRow] = React.useState<Registration | null>(null)
  const [qr, setQr] = React.useState<{
    name: string
    dataUrl: string | null
    token: string | null
    passUrl: string | null
  } | null>(null)

  const filtered = React.useMemo(
    () => filterRegistrations(rows, filters),
    [rows, filters],
  )
  const selected = filtered.filter((row) => selectedIds.includes(row.id))

  const openId = openRow?.id
  React.useEffect(() => {
    if (!openId) return
    setOpenRow(rows.find((row) => row.id === openId) || null)
  }, [rows, openId])

  const previewQr = async (id: string) => {
    setQr({ name: "Loading", dataUrl: null, token: null, passUrl: null })
    const response = await fetch(`/api/actions/qr?id=${encodeURIComponent(id)}`)
    const payload = (await response.json()) as {
      name?: string
      dataUrl?: string
      token?: string
      passUrl?: string
      error?: string
    }
    if (!response.ok) {
      setQr(null)
      return
    }
    setQr({
      name: payload.name || "QR",
      dataUrl: payload.dataUrl || null,
      token: payload.token || null,
      passUrl: payload.passUrl || (payload.token ? `/pass/${payload.token}` : null),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <RegistrationFilters
        rows={rows}
        filters={filters}
        onChange={setFilters}
        showActions={isAdmin}
      />
      <ActionBar
        selected={selected}
        filtered={filtered}
        busy={busy}
        canManage={isAdmin}
        onRegistration={() =>
          void onRegistration(
            selected
              .filter((row) => row.registration_mail_status !== "sent")
              .map((row) => row.id),
          )
        }
        onRsvp={() =>
          void onRsvp(
            selected
              .filter((row) => row.rsvp_status === "none")
              .map((row) => row.id),
          )
        }
        onRsvpAll={() =>
          void onRsvp(
            filtered
              .filter((row) => row.rsvp_status === "none")
              .map((row) => row.id),
          )
        }
        onGenerateQr={() => void onGenerateQr(selected.map((row) => row.id))}
        onSendQr={() => void onSendQr(selected.map((row) => row.id))}
      />
      <RegistrationTable
        rows={filtered}
        selectable={isAdmin}
        showActions={isAdmin}
        selectedIds={selectedIds}
        onToggle={(id, next) =>
          setSelectedIds((current) =>
            next ? [...current, id] : current.filter((item) => item !== id),
          )
        }
        onToggleAll={(next) =>
          setSelectedIds(next ? filtered.map((row) => row.id) : [])
        }
        onOpen={setOpenRow}
      />
      <RegistrationDetail
        row={openRow}
        canManage={isAdmin}
        busy={busy}
        onClose={() => setOpenRow(null)}
        onPreviewQr={(id) => void previewQr(id)}
        onRegistration={(id) => {
          const row = rows.find((item) => item.id === id)
          if (!row || row.registration_mail_status === "sent") return
          void onRegistration([id])
        }}
        onRsvp={(id) => void onRsvp([id])}
        onGenerateQr={(id) => void onGenerateQr([id])}
        onSendQr={(id) => void onSendQr([id])}
      />
      <QrPreviewDialog
        open={Boolean(qr)}
        onOpenChange={(open) => !open && setQr(null)}
        name={qr?.name || ""}
        dataUrl={qr?.dataUrl || null}
        token={qr?.token || null}
        passUrl={qr?.passUrl || null}
      />
    </div>
  )
}
