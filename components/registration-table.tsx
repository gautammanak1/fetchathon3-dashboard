"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Registration } from "@/lib/types"

function StatusBadge({
  value,
  at,
  count,
}: {
  value: string
  at?: string | null
  count?: number
}) {
  const label = count && count > 1 ? `${value || "—"} ×${count}` : value || "—"
  return (
    <Badge variant="outline" title={at ? `Last sent ${shortDate(at)}` : undefined}>
      {label}
    </Badge>
  )
}

function shortDate(value: string) {
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return "—"
  return new Date(time).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function RegistrationTable({
  rows,
  selectedIds,
  selectable = true,
  showActions = true,
  onToggle,
  onToggleAll,
  onOpen,
}: {
  rows: Registration[]
  selectedIds: string[]
  selectable?: boolean
  showActions?: boolean
  onToggle: (id: string, next: boolean) => void
  onToggleAll: (next: boolean) => void
  onOpen: (row: Registration) => void
}) {
  const [page, setPage] = React.useState(0)
  const pageSize = 12
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const visible = rows.slice(safePage * pageSize, safePage * pageSize + pageSize)
  const allFilteredSelected =
    rows.length > 0 && rows.every((row) => selectedIds.includes(row.id))

  React.useEffect(() => {
    setPage(0)
  }, [rows])

  return (
    <div className="px-4 lg:px-6">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable ? (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={(value) => onToggleAll(Boolean(value))}
                    aria-label="Select all filtered"
                  />
                </TableHead>
              ) : null}
              <TableHead>Registered</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Builder</TableHead>
              <TableHead>College / org</TableHead>
              <TableHead>Status</TableHead>
              {showActions ? (
                <>
                  <TableHead>Reg mail</TableHead>
                  <TableHead>RSVP</TableHead>
                  <TableHead>QR</TableHead>
                </>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={(selectable ? 10 : 9) + (showActions ? 3 : 0)}
                  className="h-24 text-center"
                >
                  No registrations match these filters.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row) => (
                <TableRow key={row.id} data-state={selectedIds.includes(row.id) ? "selected" : undefined}>
                  {selectable ? (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(row.id)}
                        onCheckedChange={(value) => onToggle(row.id, Boolean(value))}
                        aria-label={`Select ${row.name}`}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {shortDate(row.created_at)}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left font-medium hover:underline"
                      onClick={() => onOpen(row)}
                    >
                      {row.name || "Untitled"}
                    </button>
                    <div className="text-xs text-muted-foreground">{row.email}</div>
                  </TableCell>
                  <TableCell>{row.role || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.team_id_display || "—"}
                  </TableCell>
                  <TableCell>{row.city || "—"}</TableCell>
                  <TableCell>{row.metro || "—"}</TableCell>
                  <TableCell>{row.are_you || "—"}</TableCell>
                  <TableCell>{row.organization || "—"}</TableCell>
                  <TableCell>
                    <StatusBadge value={row.status} />
                  </TableCell>
                  {showActions ? (
                    <>
                      <TableCell>
                        <StatusBadge
                          value={row.registration_mail_status}
                          at={row.registration_mail_sent_at}
                          count={row.registration_mail_count}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          value={row.rsvp_status}
                          at={row.rsvp_sent_at}
                          count={row.rsvp_count}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          value={row.qr_status}
                          at={row.qr_sent_at}
                          count={row.qr_count}
                        />
                      </TableCell>
                    </>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between py-3 text-sm text-muted-foreground">
        <p>
          {rows.length} people · page {safePage + 1} of {pageCount}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={safePage === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
