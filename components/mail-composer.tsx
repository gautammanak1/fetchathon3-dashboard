"use client"

import dynamic from "next/dynamic"
import * as React from "react"
import { toast } from "sonner"

const MailEditor = dynamic(
  () => import("@/components/mail-editor").then((mod) => mod.MailEditor),
  { ssr: false },
)
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { COMPOSE_EMAIL_RE, fillTemplate, parseEmailList } from "@/lib/compose-mail"
import { composeMessageHtml } from "@/lib/email-templates"
import { mailVenue } from "@/lib/event-venues"
import type { MailTemplate } from "@/lib/mail-template-store"
import { useRoster } from "@/hooks/use-roster"

type Audience = "roster" | "venue" | "custom"
type Kind = "rsvp" | "reject" | "custom"

const DRAFT_KEY = "fetchathon-mail-draft"
const SAMPLE = {
  name: "Alex Rivera",
  team: "fetchathon3.0-12",
  venue: "Masters' Union Gurugram",
  email: "alex@example.com",
  confirm_url: "https://example.com/rsvp/confirm/sample",
}

export function MailComposer() {
  const { data, loading } = useRoster()
  const [kind, setKind] = React.useState<Kind>("rsvp")
  const [templateName, setTemplateName] = React.useState("")
  const [templateId, setTemplateId] = React.useState<string | null>(null)
  const [subject, setSubject] = React.useState("")
  const [body, setBody] = React.useState("")
  const [audience, setAudience] = React.useState<Audience>("venue")
  const [venue, setVenue] = React.useState("")
  const [emails, setEmails] = React.useState("")
  const [templates, setTemplates] = React.useState<MailTemplate[]>([])
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<string | null>(null)
  const ready = React.useRef(false)

  const loadTemplates = React.useCallback(async () => {
    const response = await fetch("/api/mail/templates", { cache: "no-store" })
    const payload = (await response.json()) as { templates?: MailTemplate[]; error?: string }
    if (!response.ok) {
      toast.error(payload.error || "Could not load templates")
      return
    }
    setTemplates(payload.templates || [])
  }, [])

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const raw = window.localStorage.getItem(DRAFT_KEY)
      if (raw) {
        try {
          const draft = JSON.parse(raw) as Partial<{
            kind: Kind
            templateName: string
            templateId: string | null
            subject: string
            body: string
            audience: Audience
            venue: string
            emails: string
          }>
          if (draft.kind === "rsvp" || draft.kind === "reject" || draft.kind === "custom") {
            setKind(draft.kind)
          }
          if (draft.templateName) setTemplateName(draft.templateName)
          if (draft.templateId) setTemplateId(draft.templateId)
          if (draft.subject) setSubject(draft.subject)
          if (draft.body) setBody(draft.body)
          if (draft.audience === "roster" || draft.audience === "venue" || draft.audience === "custom") {
            setAudience(draft.audience)
          }
          if (draft.venue) setVenue(draft.venue)
          if (draft.emails) setEmails(draft.emails)
        } catch {
          window.localStorage.removeItem(DRAFT_KEY)
        }
      }
      ready.current = true
      void loadTemplates()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadTemplates])

  React.useEffect(() => {
    if (!ready.current) return
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ kind, templateName, templateId, subject, body, audience, venue, emails }),
    )
  }, [kind, templateName, templateId, subject, body, audience, venue, emails])

  const addressBook = React.useMemo(() => {
    const venues = new Map<string, { people: number; mailed: number; confirmed: number; rejected: number }>()
    let people = 0
    for (const row of data?.registrations || []) {
      const email = row.email.trim().toLowerCase()
      if (!COMPOSE_EMAIL_RE.test(email)) continue
      people += 1
      const label = mailVenue(row.city, row.metro).label
      const group = venues.get(label) || { people: 0, mailed: 0, confirmed: 0, rejected: 0 }
      group.people += 1
      if (row.rsvp_status === "confirmed") group.confirmed += 1
      else if (row.rsvp_status === "sent") group.mailed += 1
      if (row.reject_status === "sent") group.rejected += 1
      venues.set(label, group)
    }
    return {
      people,
      venues: [...venues.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    }
  }, [data])

  const selectedVenue = addressBook.venues.find(([label]) => label === venue)
  const recipientCount =
    audience === "roster"
      ? addressBook.people
      : audience === "venue"
        ? selectedVenue?.[1].people || 0
        : parseEmailList(emails).length

  const preview = {
    subject: fillTemplate(subject, SAMPLE) || "Subject",
    body: fillTemplate(body, SAMPLE) || "<p>Your message will show here.</p>",
  }
  const officialPreview =
    kind === "reject"
      ? "/api/mail/preview?kind=reject"
      : `/api/mail/preview?kind=rsvp&city=${encodeURIComponent(venue || "Gurugram")}`

  const saveTemplate = async () => {
    setBusy(true)
    try {
      const response = await fetch("/api/mail/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: templateId, name: templateName, subject, body }),
      })
      const payload = (await response.json()) as { template?: MailTemplate; error?: string }
      if (!response.ok || !payload.template) {
        toast.error(payload.error || "Could not save template")
        return
      }
      setTemplateId(payload.template.id)
      setTemplateName(payload.template.name)
      toast.success("Template saved")
      await loadTemplates()
    } finally {
      setBusy(false)
    }
  }

  const removeTemplate = async (id: string) => {
    setBusy(true)
    try {
      const response = await fetch("/api/mail/templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        toast.error(payload.error || "Could not delete template")
        return
      }
      if (templateId === id) setTemplateId(null)
      await loadTemplates()
    } finally {
      setBusy(false)
    }
  }

  const send = async (test: boolean, force = false) => {
    setBusy(true)
    setResult(null)
    try {
      const response = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, subject, body, audience, venue, emails, test, force }),
      })
      const payload = (await response.json()) as { error?: string; note?: string }
      if (!response.ok) {
        toast.error(payload.error || payload.note || "Could not send mail")
        setResult(payload.error || payload.note || "Could not send mail")
        return
      }
      toast.success(payload.note || "Mail sent")
      setResult(payload.note || "Mail sent")
    } finally {
      setBusy(false)
    }
  }

  const canSend =
    !busy &&
    recipientCount > 0 &&
    (kind !== "custom" || Boolean(subject.trim() && body.trim())) &&
    (audience !== "venue" || Boolean(venue))
  const audienceLabel =
    audience === "roster"
      ? `everyone on the roster (${recipientCount})`
      : audience === "venue"
        ? `${venue || "the selected location"} (${recipientCount})`
        : `${recipientCount} typed ${recipientCount === 1 ? "address" : "addresses"}`

  return (
    <div className="grid gap-4 px-4 font-normal font-sans antialiased lg:grid-cols-[minmax(0,1fr)_18rem] lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Mail</CardTitle>
          <CardDescription>
            RSVP asks them to confirm and records who was mailed. Confirmed means they clicked Absolutely, I&apos;m in. Reject is a separate mail.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["rsvp", "RSVP"],
                ["reject", "Reject"],
                ["custom", "Custom note"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={kind === value ? "default" : "outline"}
                onClick={() => setKind(value)}
              >
                {label}
              </Button>
            ))}
          </div>

          {kind === "rsvp" ? (
            <p className="text-sm text-muted-foreground">
              Each person gets the RSVP template for the location they chose. Amity Noida is mailed as Masters&apos; Union Gurugram. Sending this marks RSVP as mailed. It does not mark them confirmed.
            </p>
          ) : null}
          {kind === "reject" ? (
            <p className="text-sm text-muted-foreground">
              This thanks them for registering and says we hope to see them at Fetch-A-Thon 4.0. It is stored as reject mail, separate from RSVP.
            </p>
          ) : null}

          {kind === "custom" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="mail-subject">Subject</Label>
                <Input
                  id="mail-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Fetch-A-Thon 3.0 update"
                  maxLength={180}
                />
              </div>
              <div className="grid gap-2">
                <Label>Message</Label>
                <MailEditor value={body} onChange={setBody} />
                <p className="text-sm text-muted-foreground">
                  Use {"{{name}}"}, {"{{team}}"}, {"{{venue}}"}, and {"{{confirm_url}}"}. Add an image from the toolbar.
                </p>
              </div>
            </>
          ) : null}

          <div className="grid gap-2">
            <Label>Send to</Label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["venue", "One location"],
                  ["custom", "Typed emails"],
                  ["roster", "Everyone"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant={audience === value ? "default" : "outline"}
                  onClick={() => setAudience(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {audience === "venue" ? (
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={venue}
                onChange={(event) => setVenue(event.target.value)}
                aria-label="Location"
              >
                <option value="">{loading ? "Loading locations…" : "Choose a location"}</option>
                {addressBook.venues.map(([label, counts]) => (
                  <option key={label} value={label}>
                    {label} ({counts.people}
                    {kind === "rsvp"
                      ? `, ${counts.confirmed} confirmed, ${counts.people - counts.confirmed - counts.mailed} not mailed`
                      : ""}
                    {kind === "reject" ? `, ${counts.rejected} rejected` : ""})
                  </option>
                ))}
              </select>
            ) : null}
            {audience === "custom" ? (
              <Textarea
                value={emails}
                onChange={(event) => setEmails(event.target.value)}
                placeholder="one@example.com, two@example.com"
                aria-label="Email addresses"
                className="min-h-20"
              />
            ) : null}
            {audience === "roster" ? (
              <p className="text-sm text-muted-foreground">
                {loading ? "Counting people…" : `${addressBook.people} people with an email address.`}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label>Email preview</Label>
            {kind === "custom" ? (
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={composeMessageHtml(preview.subject, preview.body)}
                className="h-[640px] w-full rounded-xl border bg-[#efeafc]"
              />
            ) : (
              <iframe
                title="Email preview"
                sandbox=""
                src={officialPreview}
                className="h-[640px] w-full rounded-xl border bg-[#efeafc]"
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy || (kind === "custom" && (!subject.trim() || !body.trim()))} onClick={() => void send(true)}>
              Send test to me
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" disabled={!canSend}>
                  {kind === "reject" ? `Send reject to ${recipientCount || 0}` : `Send to ${recipientCount || 0}`}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {kind === "reject" ? "Send the reject mail?" : kind === "rsvp" ? "Send the RSVP mail?" : "Send this note?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {kind === "rsvp"
                      ? `This sends the location RSVP to ${audienceLabel}. Anyone who already has an RSVP mail is left out.`
                      : kind === "reject"
                        ? `This sends the Fetch-A-Thon 4.0 note to ${audienceLabel} who have not received a reject mail yet.`
                        : `This sends “${subject.trim() || "this message"}” to ${audienceLabel}. It does not change RSVP or confirm status.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void send(false, false)}>
                    {kind === "rsvp" ? "Send RSVP" : "Send new only"}
                  </AlertDialogAction>
                  {kind === "reject" ? (
                    <AlertDialogAction onClick={() => void send(false, true)}>Send again</AlertDialogAction>
                  ) : null}
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {result ? <p className="text-sm text-muted-foreground">{result}</p> : null}
        </CardContent>
      </Card>

      {kind === "custom" ? (
        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
            <CardDescription>Saved custom notes. RSVP and reject use their own templates.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="template-name">Template name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Venue reminder"
                maxLength={80}
              />
              <Button
                type="button"
                variant="outline"
                disabled={busy || !templateName.trim() || !subject.trim() || !body.trim()}
                onClick={() => void saveTemplate()}
              >
                Save template
              </Button>
            </div>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved notes yet.</p>
            ) : (
              <ul className="grid gap-2">
                {templates.map((template) => (
                  <li key={template.id} className="rounded-lg border px-3 py-3">
                    <p>{template.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{template.subject}</p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setTemplateId(template.id)
                          setTemplateName(template.name)
                          setSubject(template.subject)
                          setBody(template.body)
                        }}
                      >
                        Use
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void removeTemplate(template.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{kind === "reject" ? "Reject" : "RSVP"}</CardTitle>
            <CardDescription>
              {kind === "reject"
                ? "One template for everyone. It does not ask them to confirm."
                : "Mailed and confirmed stay separate in the mail log."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {selectedVenue ? (
              <>
                <p>{selectedVenue[0]}</p>
                <p className="text-muted-foreground">{selectedVenue[1].people} people</p>
                {kind === "rsvp" ? (
                  <p className="text-muted-foreground">
                    {selectedVenue[1].confirmed} confirmed · {selectedVenue[1].mailed} mailed, waiting ·{" "}
                    {selectedVenue[1].people - selectedVenue[1].confirmed - selectedVenue[1].mailed} not mailed
                  </p>
                ) : (
                  <p className="text-muted-foreground">{selectedVenue[1].rejected} reject mailed</p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Choose a location to see who is already mailed.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
