"use client"

import { MailIcon, QrCodeIcon, SendIcon, UsersIcon } from "lucide-react"

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
import type { Registration } from "@/lib/types"

export function ActionBar({
  selected,
  filtered,
  busy,
  canManage,
  onRsvp,
  onRsvpAll,
  onGenerateQr,
  onSendQr,
}: {
  selected: Registration[]
  filtered: Registration[]
  busy: boolean
  canManage: boolean
  onRsvp: () => void
  onRsvpAll: () => void
  onGenerateQr: () => void
  onSendQr: () => void
}) {
  const count = selected.length
  const filteredCount = filtered.length
  const teamCount = new Set(selected.map((row) => row.team_id || row.id)).size
  const rsvpReady = count > 0
  const qrReady =
    count > 0 && selected.every((row) => row.rsvp_status !== "none")
  const sendReady =
    count > 0 && selected.every((row) => row.qr_status !== "none")

  if (!canManage) {
    return (
      <div className="px-4 text-sm text-muted-foreground lg:px-6">
        View only. Admin login is required to send RSVP or team QR emails.
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 lg:px-6">
      <p className="mr-auto text-sm text-muted-foreground">
        {count === 0
          ? "Open a person to send one email, or select a few people. Do not blast the whole list."
          : count === 1
            ? `One email: ${selected[0]?.email}`
            : `${count} selected · ${teamCount} team ${teamCount === 1 ? "QR" : "QRs"}`}
      </p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="default" disabled={!rsvpReady || busy}>
            <MailIcon />
            Send RSVP
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send seat confirmation?</AlertDialogTitle>
            <AlertDialogDescription>
              {count === 1
                ? `This emails only ${selected[0]?.email || "this person"}. Nobody else is included.`
                : `This emails ${count} selected people that their Fetch-A-Thon seat is confirmed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRsvp}>Send RSVP</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={filteredCount === 0 || busy}>
            <UsersIcon />
            RSVP all filtered
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk RSVP all filtered?</AlertDialogTitle>
            <AlertDialogDescription>
              This emails all {filteredCount} people in the current filter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRsvpAll}>
              Send {filteredCount} emails
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Button
        variant="outline"
        disabled={!qrReady || busy}
        onClick={onGenerateQr}
      >
        <QrCodeIcon />
        Generate team QR
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={!sendReady || busy}>
            <SendIcon />
            Send team QR
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send venue QR emails?</AlertDialogTitle>
            <AlertDialogDescription>
              Each team gets one QR. Selected people on the same team receive
              the same venue pass.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onSendQr}>Send QR</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
