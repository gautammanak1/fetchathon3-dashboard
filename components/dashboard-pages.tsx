"use client"

import { DashboardShell } from "@/components/dashboard-shell"
import { OverviewCards } from "@/components/overview-cards"
import { RegistrationCharts } from "@/components/registration-charts"
import { RegistrationFilters } from "@/components/registration-filters"
import { RosterWorkspace } from "@/components/roster-workspace"
import { TeamBoard } from "@/components/team-board"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { useRoster } from "@/hooks/use-roster"
import { EMPTY_FILTERS, filterRegistrations } from "@/lib/filters"
import type { RosterPayload } from "@/lib/types"
import * as React from "react"
import { toast } from "sonner"

function TestInboxButton({
  busy,
  onSend,
}: {
  busy: boolean
  onSend: () => void
}) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return null
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 lg:px-6">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={busy}>
            Send test to gautammanak1@gmail.com
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send sample registration email?</AlertDialogTitle>
            <AlertDialogDescription>
              This sends only to gautammanak1@gmail.com, including the Discord
              invite. The roster is not emailed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onSend}>Send test</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="grid gap-4 px-4 lg:px-6">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <p className="px-4 text-sm text-muted-foreground lg:px-6">{message}</p>
  )
}

export function OverviewPage() {
  const { data, loading, error } = useRoster()
  const { isAdmin } = useAuth()

  return (
    <DashboardShell title="Overview">
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {data ? (
        <>
          <OverviewCards stats={data.stats} showActions={isAdmin} />
          <RegistrationCharts
            byLocation={data.charts.byLocation}
            byCity={data.charts.byCity}
            byBuilder={data.charts.byBuilder}
            byCollege={data.charts.byCollege}
          />
        </>
      ) : null}
    </DashboardShell>
  )
}

export function RegistrationsPage() {
  const { data, loading, error, runAction } = useRoster()
  const [busy, setBusy] = React.useState(false)

  const act = async (
    url: string,
    body: Record<string, unknown>,
    success: string,
  ) => {
    setBusy(true)
    try {
      return Boolean(await runAction(url, body, success))
    } finally {
      setBusy(false)
    }
  }

  return (
    <DashboardShell title="Registrations">
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {data ? (
        <>
          <RosterWorkspace
            rows={data.registrations}
            busy={busy}
            onRegistration={(ids, force) =>
              act(
                "/api/actions/registration",
                { ids, force },
                force ? "Registration emails resent" : "Registration emails sent",
              )
            }
            onRsvp={(ids, force) =>
              act(
                "/api/actions/rsvp",
                { ids, force },
                force ? "RSVP emails resent" : "RSVP emails sent",
              )
            }
            onReject={(ids, force) =>
              act(
                "/api/actions/reject",
                { ids, force },
                force ? "Reject emails resent" : "Reject emails sent",
              )
            }
            onGenerateQr={(ids) =>
              act("/api/actions/qr", { ids, mode: "generate" }, "Team QR codes generated")
            }
            onSendQr={(ids, force) =>
              act(
                "/api/actions/qr",
                { ids, mode: "send", force },
                force ? "Team QR emails resent" : "Team QR emails sent",
              )
            }
          />
        </>
      ) : null}
    </DashboardShell>
  )
}

export function TeamsPage({
  initial = null,
}: {
  initial?: RosterPayload | null
}) {
  const { data, loading, error, runAction, patchPeople } = useRoster(initial)
  const { isAdmin } = useAuth()
  const [filters, setFilters] = React.useState(EMPTY_FILTERS)
  const [busy, setBusy] = React.useState(false)

  const act = async (
    url: string,
    body: Record<string, unknown>,
    success: string,
    options?: { refresh?: boolean },
  ) => {
    setBusy(true)
    try {
      return await runAction(url, body, success, options)
    } finally {
      setBusy(false)
    }
  }

  const markReview = async (ids: string[], status: "pending" | "reviewed") => {
    setBusy(true)
    try {
      const response = await fetch("/api/actions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      })
      const payload = (await response.json()) as { error?: string; note?: string }
      if (!response.ok) {
        toast.error(payload.error || "Could not update review")
        return
      }
      patchPeople(ids, { review_status: status })
      toast.success(payload.note || "Review updated")
    } finally {
      setBusy(false)
    }
  }

  const teams = React.useMemo(() => {
    if (!data) return []
    const visible = new Set(
      filterRegistrations(data.registrations, filters).map((row) => row.id),
    )
    return data.teams.filter((team) =>
      team.members.some((member) => visible.has(member.id)),
    )
  }, [data, filters])

  return (
    <DashboardShell title="Teams">
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {data ? (
        <>
          <RegistrationFilters
            rows={data.registrations}
            filters={filters}
            onChange={setFilters}
            showActions
          />
          <TeamBoard
            teams={teams}
            canManage={isAdmin}
            busy={busy}
            onMarkReview={(ids, status) => markReview(ids, status)}
            onRsvp={async (ids) => {
              const payload = await act(
                "/api/actions/rsvp",
                { ids },
                "RSVP sent",
                { refresh: false },
              )
              if (payload?.sentIds?.length) {
                patchPeople(payload.sentIds, {
                  rsvp_status: "sent",
                  rsvp_sent_at: new Date().toISOString(),
                })
              }
            }}
            onReject={async (ids, force) => {
              const payload = await act(
                "/api/actions/reject",
                { ids, force },
                force ? "Reject mail resent" : "Reject mail sent",
                { refresh: false },
              )
              if (payload?.sentIds?.length) {
                patchPeople(payload.sentIds, {
                  reject_status: "sent",
                  reject_sent_at: new Date().toISOString(),
                })
              }
            }}
            onSendQr={async (ids, force) => {
              const payload = await act(
                "/api/actions/qr",
                { ids, mode: "send", force },
                force ? "Team QR resent" : "Team QR sent",
                { refresh: false },
              )
              if (payload?.sentIds?.length) {
                patchPeople(payload.sentIds, {
                  qr_status: "sent",
                  qr_sent_at: new Date().toISOString(),
                })
              }
            }}
          />
        </>
      ) : null}
    </DashboardShell>
  )
}

export function ActionsPage() {
  const { data, loading, error, runAction } = useRoster()
  const [busy, setBusy] = React.useState(false)

  const act = async (
    url: string,
    body: Record<string, unknown>,
    success: string,
  ) => {
    setBusy(true)
    try {
      return Boolean(await runAction(url, body, success))
    } finally {
      setBusy(false)
    }
  }

  return (
    <DashboardShell title="RSVP & QR">
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {data ? (
        <>
          <div className="px-4 text-sm text-muted-foreground lg:px-6">
            RSVP and QR emails go once per team, with teammates on CC.
            Use the test button to email gautammanak1@gmail.com only.
          </div>
          <TestInboxButton
            busy={busy}
            onSend={() =>
              void act(
                "/api/actions/test-mail",
                { kinds: ["registration"] },
                "Test registration email sent to gautammanak1@gmail.com",
              )
            }
          />
          <RosterWorkspace
            rows={data.registrations}
            busy={busy}
            onRegistration={(ids, force) =>
              act(
                "/api/actions/registration",
                { ids, force },
                force ? "Registration emails resent" : "Registration emails sent",
              )
            }
            onRsvp={(ids, force) =>
              act(
                "/api/actions/rsvp",
                { ids, force },
                force ? "RSVP emails resent" : "RSVP emails sent",
              )
            }
            onReject={(ids, force) =>
              act(
                "/api/actions/reject",
                { ids, force },
                force ? "Reject emails resent" : "Reject emails sent",
              )
            }
            onGenerateQr={(ids) =>
              act("/api/actions/qr", { ids, mode: "generate" }, "Team QR codes generated")
            }
            onSendQr={(ids, force) =>
              act(
                "/api/actions/qr",
                { ids, mode: "send", force },
                force ? "Team QR emails resent" : "Team QR emails sent",
              )
            }
          />
        </>
      ) : null}
    </DashboardShell>
  )
}
