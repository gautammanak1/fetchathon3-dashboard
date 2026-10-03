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
  onRegistration: (force?: boolean) => void
  onRsvp: (force?: boolean) => void
  onRsvpAll: () => void
  onGenerateQr: () => void
  onSendQr: (force?: boolean) => void
}) {
  const count = selected.length
  const filteredCount = filtered.length
  const teamCount = new Set(selected.map((row) => row.team_id || row.id)).size
  const pendingRegistration = selected.filter(
    (row) => row.registration_mail_status !== "sent",
  )
  const alreadyMailed = count - pendingRegistration.length
  const pendingRsvp = selected.filter((row) => row.rsvp_status === "none")
  const alreadyRsvp = count - pendingRsvp.length
  const pendingQr = selected.filter((row) => row.qr_status !== "sent")
  const alreadyQr = count - pendingQr.length
  const filteredPendingRsvp = filtered.filter((row) => row.rsvp_status === "none")

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
          <Button variant="default" disabled={count === 0 || busy}>
            <MailIcon />
            Send registration
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send registration confirmation?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRegistration.length === 1
                ? `This emails only ${pendingRegistration[0]?.email || "this person"} the registration confirmation and Discord invite.`
                : pendingRegistration.length > 0
                  ? `Send new only emails ${pendingRegistration.length} people who have not received registration mail yet.`
                  : "Everyone selected already received registration mail."}
              {alreadyMailed > 0
                ? ` ${alreadyMailed} already mailed ${alreadyMailed === 1 ? "person can" : "people can"} be sent again.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {pendingRegistration.length > 0 ? (
              <AlertDialogAction onClick={() => onRegistration(false)}>
                Send new only
              </AlertDialogAction>
            ) : null}
            {alreadyMailed > 0 ? (
              <AlertDialogAction onClick={() => onRegistration(true)}>
                Send again
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={count === 0 || busy}>
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
                : `This sends one seat-confirmation email per team for the ${count} selected people. Teammates are CC'd. Nobody gets a second copy unless you send again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {pendingRsvp.length > 0 ? (
              <AlertDialogAction onClick={() => onRsvp(false)}>
                Send new only
              </AlertDialogAction>
            ) : null}
            {alreadyRsvp > 0 ? (
              <AlertDialogAction onClick={() => onRsvp(true)}>
                Send again
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={filteredPendingRsvp.length === 0 || busy}>
            <UsersIcon />
            RSVP all filtered
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk RSVP all filtered?</AlertDialogTitle>
            <AlertDialogDescription>
              This emails teams in the current filter that have not received RSVP yet. Already-sent teams are skipped. Open a team and use Send again to resend.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRsvpAll}>
              Send {filteredPendingRsvp.length} new emails
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Button
        variant="outline"
        disabled={count === 0 || busy}
        onClick={onGenerateQr}
      >
        <QrCodeIcon />
        Generate team QR
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={count === 0 || busy}>
            <SendIcon />
            Send team QR
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send venue QR emails?</AlertDialogTitle>
            <AlertDialogDescription>
              This generates the team QR if needed and emails it once. Teammates
              are CC'd. Scanning the QR opens the team pass page.
              {alreadyQr > 0
                ? ` ${alreadyQr} already sent ${alreadyQr === 1 ? "person can" : "people can"} be sent again.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {pendingQr.length > 0 ? (
              <AlertDialogAction onClick={() => onSendQr(false)}>
                Send new only
              </AlertDialogAction>
            ) : null}
            {alreadyQr > 0 ? (
              <AlertDialogAction onClick={() => onSendQr(true)}>
                Send again
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
