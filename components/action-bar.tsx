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
  onRegistration,
  onRsvp,
  onRsvpAll,
  onGenerateQr,
  onSendQr,
}: {
  selected: Registration[]
  filtered: Registration[]
  busy: boolean
  canManage: boolean
  onRegistration: () => void
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
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 lg:px-6">
      <p className="mr-auto text-sm text-muted-foreground">
        {count === 0
          ? "Open a person to send one email, or select a few people. Do not blast the whole list."
          : count === 1
            ? `One email: ${selected[0]?.email}`
            : `${count} selected · ${teamCount} team ${teamCount === 1 ? "email" : "emails"}`}
      </p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="default" disabled={!rsvpReady || busy}>
            <MailIcon />
            Send registration
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send registration confirmation?</AlertDialogTitle>
            <AlertDialogDescription>
              {count === 1
                ? `This emails only ${selected[0]?.email || "this person"} the registration confirmation and Discord invite.`
                : `This emails ${count} selected people the registration confirmation and Discord invite.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRegistration}>
              Send registration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={!rsvpReady || busy}>
            <MailIcon />
            Send RSVP
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send seat confirmation?</AlertDialogTitle>
            <AlertDialogDescription>
              {count === 1
                ? `This sends one seat confirmation to ${selected[0]?.team_id_display || "this team"}. Teammates are CC'd on the same email.`
                : `This sends one seat-confirmation email per team for the ${count} selected people. Teammates are CC'd. Nobody gets a second copy.`}
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
              This sends one email per team in the current filter ({filteredCount} people). Teammates are CC'd. No extra individual copies.
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
              Each team gets one QR email. Teammates are CC'd. Scanning the QR
              opens the team pass page.
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
