"use client"

import * as React from "react"

import { DownloadIcon } from "lucide-react"

import { ActionBar } from "@/components/action-bar"
import { QrPreviewDialog } from "@/components/qr-preview-dialog"
import { RegistrationDetail } from "@/components/registration-detail"
import { RegistrationFilters } from "@/components/registration-filters"
import { RegistrationTable } from "@/components/registration-table"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { downloadCsv, venueCsvName } from "@/lib/csv"
import { mailVenue } from "@/lib/event-venues"
import { EMPTY_FILTERS, filterRegistrations } from "@/lib/filters"
import type { Filters, Registration } from "@/lib/types"

function registrationCsv(rows: Registration[]) {
  return rows.map((row) => ({
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    team: row.team_id_display,
    organization: row.organization,
    filled_location: row.city,
    venue: mailVenue(row.city, row.metro).label,
    status: row.status,
    registration: row.registration_mail_status,
    rsvp: row.rsvp_status,
    reject: row.reject_status,
    qr: row.qr_status,
  }))
}

export function RosterWorkspace({
  rows,
  onRegistration,
  onRsvp,
  onReject,
  onGenerateQr,
  onSendQr,
  busy,
}: {
  rows: Registration[]
  onRegistration: (ids: string[], force?: boolean) => Promise<boolean>
  onRsvp: (ids: string[], force?: boolean) => Promise<boolean>
  onReject: (ids: string[], force?: boolean) => Promise<boolean>
  onGenerateQr: (ids: string[]) => Promise<boolean>
  onSendQr: (ids: string[], force?: boolean) => Promise<boolean>
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
  const [exportVenue, setExportVenue] = React.useState("")

  const filtered = React.useMemo(
    () => filterRegistrations(rows, filters),
    [rows, filters],
  )
  const exportVenues = React.useMemo(() => {
    const labels = new Set<string>()
    for (const row of rows) labels.add(mailVenue(row.city, row.metro).label)
    return [...labels].sort((a, b) => a.localeCompare(b))
  }, [rows])
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
      <div className="flex flex-wrap items-center justify-end gap-2 px-4 lg:px-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={rows.length === 0}
          onClick={() => downloadCsv("fetchathon-registrations.csv", registrationCsv(rows))}
        >
          <DownloadIcon />
          Export all
        </Button>
        <select
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          value={exportVenue}
          onChange={(event) => setExportVenue(event.target.value)}
          aria-label="Venue to download"
        >
          <option value="">Choose a venue</option>
          {exportVenues.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!exportVenue}
          onClick={() => {
            const matched = rows.filter(
              (row) => mailVenue(row.city, row.metro).label === exportVenue,
            )
            downloadCsv(venueCsvName(exportVenue), registrationCsv(matched))
          }}
        >
          <DownloadIcon />
          Export venue
        </Button>
      </div>
      <ActionBar
        selected={selected}
        busy={busy}
        canManage={isAdmin}
        onRegistration={(force) =>
          void onRegistration(
            (force
              ? selected
              : selected.filter((row) => row.registration_mail_status !== "sent")
            ).map((row) => row.id),
            force,
          )
        }
        onRsvp={(force) =>
          void onRsvp(
            (force
              ? selected
              : selected.filter((row) => row.rsvp_status === "none")
            ).map((row) => row.id),
            force,
          )
        }
        onReject={(force) =>
          void onReject(
            (force
              ? selected
              : selected.filter((row) => row.reject_status !== "sent")
            ).map((row) => row.id),
            force,
          )
        }
        onGenerateQr={() => void onGenerateQr(selected.map((row) => row.id))}
        onSendQr={(force) =>
          void onSendQr(
            (force
              ? selected
              : selected.filter((row) => row.qr_status !== "sent")
            ).map((row) => row.id),
            force,
          )
        }
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
        onRegistration={(id, force) => void onRegistration([id], force)}
        onRsvp={(id, force) => void onRsvp([id], force)}
        onReject={(id, force) => void onReject([id], force)}
        onGenerateQr={(id) => void onGenerateQr([id])}
        onSendQr={(id, force) => void onSendQr([id], force)}
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
