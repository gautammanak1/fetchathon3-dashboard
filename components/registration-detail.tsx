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
  onRegistration: (id: string) => void
  onRsvp: (id: string) => void
  onGenerateQr: (id: string) => void
  onSendQr: (id: string) => void
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
                    <Badge variant="outline">Reg mail {row.registration_mail_status}</Badge>
                    <Badge variant="outline">RSVP {row.rsvp_status}</Badge>
                    <Badge variant="outline">QR {row.qr_status}</Badge>
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
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={busy}>
                        Send registration to this person
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Send one registration email?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This emails only {row.email || "this person"} the
                          registration confirmation and Discord invite.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onRegistration(row.id)}>
                          Send one email
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" disabled={busy}>Send RSVP to this team</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Send team seat confirmation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This sends one email to {row.team_id_display || "this team"}.
                          Teammates are CC'd. Nobody gets a second copy.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onRsvp(row.id)}>
                          Send team email
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    variant="outline"
                    disabled={busy || row.rsvp_status === "none"}
                    onClick={() => onGenerateQr(row.id)}
                  >
                    Generate this team QR
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={busy || row.qr_status === "none"}
                      >
                        Send team QR
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Send team venue QR?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This emails one QR to {row.team_id_display || "this team"}.
                          Teammates are CC'd. Scanning it opens the team pass.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onSendQr(row.id)}>
                          Send team email
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : null}
              {canPreviewQr ? (
                <Button
                  variant="outline"
                  disabled={row.rsvp_status === "none"}
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
