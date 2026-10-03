"use client"

import { DEFAULT_FIELDS } from "@/lib/fields"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { Registration } from "@/lib/types"

const DETAIL_FIELDS: Array<[keyof typeof DEFAULT_FIELDS | "metro", string]> = [
  ["name", "Name"],
  ["address", "Address"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["role", "Role"],
  ["team_id", "Team ID"],
  ["participation", "Participation"],
  ["are_you", "Are you"],
  ["organization", "Organization"],
  ["city", "Location"],
  ["metro", "City"],
  ["experience", "Experience"],
  ["github", "GitHub"],
  ["linkedin", "LinkedIn"],
  ["team_size", "Team size"],
  ["registered_count", "Registered count"],
  ["seats_remaining", "Seats remaining"],
  ["team_status", "Team status"],
  ["status", "Status"],
]

export function RegistrationDetail({
  row,
  onClose,
  onPreviewQr,
  onRegistration,
  onRsvp,
  onGenerateQr,
  onSendQr,
  canManage,
  busy,
}: {
  row: Registration | null
  onClose: () => void
  onPreviewQr: (id: string) => void
  onRegistration: (id: string, force?: boolean) => void
  onRsvp: (id: string, force?: boolean) => void
  onGenerateQr: (id: string) => void
  onSendQr: (id: string, force?: boolean) => void
  canManage: boolean
  busy: boolean
}) {
  const canPreviewQr = Boolean(row && canManage && row.qr_status !== "none")
  return (
    <Sheet open={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {row ? (
          <>
            <SheetHeader>
              <SheetTitle>{row.name || "Untitled"}</SheetTitle>
              <SheetDescription>
                Notion row {row.team_id_display || "without team"}
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 px-4 pb-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{row.status || "Unknown"}</Badge>
                {canManage ? (
                  <>
                    <Badge variant="outline">
                      Reg mail {row.registration_mail_status}
                      {row.registration_mail_count > 1 ? ` ×${row.registration_mail_count}` : ""}
                    </Badge>
                    <Badge variant="outline">
                      RSVP {row.rsvp_status}
                      {row.rsvp_count > 1 ? ` ×${row.rsvp_count}` : ""}
                    </Badge>
                    <Badge variant="outline">
                      QR {row.qr_status}
                      {row.qr_count > 1 ? ` ×${row.qr_count}` : ""}
                    </Badge>
                  </>
                ) : null}
              </div>
              <dl className="grid gap-3 text-sm">
                {DETAIL_FIELDS.map(([key, label]) => {
                  const value = String(row[key] || "")
                  if (!value) return null
                  return (
                    <div key={key} className="grid gap-1">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="break-all font-medium">{value}</dd>
                    </div>
                  )
                })}
                {row.skills.length > 0 ? (
                  <div className="grid gap-1">
                    <dt className="text-muted-foreground">Skills</dt>
                    <dd className="font-medium">{row.skills.join(", ")}</dd>
                  </div>
                ) : null}
              </dl>
              {canManage ? (
                <div className="grid gap-2">
                  {row.registration_mail_sent_at || row.rsvp_sent_at || row.qr_sent_at ? (
                    <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
                      {row.registration_mail_sent_at
                        ? `Registration last sent ${new Date(row.registration_mail_sent_at).toLocaleString()}`
                        : "Registration not sent yet"}
                      <br />
                      {row.rsvp_sent_at
                        ? `RSVP last sent ${new Date(row.rsvp_sent_at).toLocaleString()}`
                        : "RSVP not sent yet"}
                      <br />
                      {row.qr_sent_at
                        ? `QR last sent ${new Date(row.qr_sent_at).toLocaleString()}`
                        : "QR not sent yet"}
                    </div>
                  ) : null}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={busy}>
                        {row.registration_mail_status === "sent"
                          ? "Send registration again"
                          : "Send registration to this person"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {row.registration_mail_status === "sent"
                            ? "Resend registration email?"
                            : "Send one registration email?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This emails only {row.email || "this person"} the
                          registration confirmation and Discord invite.
                          {row.registration_mail_status === "sent"
                            ? " They already received this mail; this sends another copy."
                            : ""}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            onRegistration(
                              row.id,
                              row.registration_mail_status === "sent",
                            )
                          }
                        >
                          {row.registration_mail_status === "sent"
                            ? "Send again"
                            : "Send one email"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" disabled={busy}>
                        {row.rsvp_status !== "none"
                          ? "Send RSVP again"
                          : "Send RSVP to this team"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {row.rsvp_status !== "none"
                            ? "Resend team seat confirmation?"
                            : "Send team seat confirmation?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This sends one email to {row.team_id_display || "this team"}.
                          Teammates are CC'd.
                          {row.rsvp_status !== "none"
                            ? " This team already received RSVP; this sends another copy."
                            : ""}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onRsvp(row.id, row.rsvp_status !== "none")}
                        >
                          {row.rsvp_status !== "none" ? "Send again" : "Send team email"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => onGenerateQr(row.id)}
                  >
                    Generate this team QR
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" disabled={busy}>
                        {row.qr_status === "sent" ? "Send team QR again" : "Send team QR"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {row.qr_status === "sent"
                            ? "Resend team venue QR?"
                            : "Send team venue QR?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {row.qr_status === "sent"
                            ? "This team already received the QR email. This sends another copy."
                            : `This generates the QR if needed and emails ${row.team_id_display || "this team"}. Teammates are CC'd.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onSendQr(row.id, row.qr_status === "sent")}
                        >
                          {row.qr_status === "sent" ? "Send again" : "Send team email"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : null}
              {canPreviewQr ? (
                <Button
                  variant="outline"
                  onClick={() => onPreviewQr(row.id)}
                >
                  Preview team QR
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
