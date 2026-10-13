"use client"

import * as React from "react"
import { toast } from "sonner"

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
import { formatVenue } from "@/lib/fields"
import type { MailTemplate } from "@/lib/mail-template-store"
import { useRoster } from "@/hooks/use-roster"

type Audience = "roster" | "venue" | "custom"

const DRAFT_KEY = "fetchathon-mail-draft"
const SAMPLE = {
  name: "Alex Rivera",
  team: "fetchathon3.0-12",
  venue: "Masters' Union Gurugram",
  email: "alex@example.com",
  confirm_url: "https://example.com/rsvp/confirm/sample",
}

function venueLabel(city: string, metro: string) {
  return formatVenue(city) || city || metro || ""
}

export function MailComposer() {
  const { data, loading } = useRoster()
  const [templateName, setTemplateName] = React.useState("")
  const [templateId, setTemplateId] = React.useState<string | null>(null)
  const [subject, setSubject] = React.useState("")
  const [body, setBody] = React.useState("")
  const [audience, setAudience] = React.useState<Audience>("custom")
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
            templateName: string
            templateId: string | null
            subject: string
            body: string
            audience: Audience
            venue: string
            emails: string
          }>
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
      JSON.stringify({ templateName, templateId, subject, body, audience, venue, emails }),
    )
  }, [templateName, templateId, subject, body, audience, venue, emails])

  const addressBook = React.useMemo(() => {
    const venues = new Map<string, Set<string>>()
    const people = new Set<string>()
    for (const row of data?.registrations || []) {
      const email = row.email.trim().toLowerCase()
      if (!COMPOSE_EMAIL_RE.test(email)) continue
      people.add(email)
      const label = venueLabel(row.city, row.metro)
      if (!label) continue
      const group = venues.get(label) || new Set<string>()
      group.add(email)
      venues.set(label, group)
    }
    return {
      people: people.size,
      venues: [...venues.entries()]
        .map(([label, group]) => [label, group.size] as const)
        .sort((a, b) => a[0].localeCompare(b[0])),
    }
  }, [data])

  const rosterCount = addressBook.people
  const venues = addressBook.venues

  const recipientCount =
    audience === "roster"
      ? rosterCount
      : audience === "venue"
        ? venues.find(([label]) => label === venue)?.[1] || 0
        : parseEmailList(emails).length

  const preview = {
    subject: fillTemplate(subject, SAMPLE) || "Subject",
    body: fillTemplate(body, SAMPLE) || "Your message will show here.",
  }

  const saveTemplate = async () => {
    setBusy(true)
    try {
      const response = await fetch("/api/mail/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: templateId,
          name: templateName,
          subject,
          body,
        }),
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

  const send = async (test: boolean) => {
    setBusy(true)
    setResult(null)
    try {
      const response = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, audience, venue, emails, test }),
      })
      const payload = (await response.json()) as {
        error?: string
        note?: string
        failures?: Array<{ email: string; error: string }>
      }
      if (!response.ok) {
        toast.error(payload.error || payload.note || "Could not send mail")
        setResult(payload.error || payload.note || "Could not send mail")
        return
      }
      const extra = payload.failures?.length
        ? ` ${payload.failures.map((item) => item.email).join(", ")}`
        : ""
      toast.success(payload.note || "Mail sent")
      setResult(`${payload.note || "Mail sent"}${extra}`)
    } finally {
      setBusy(false)
    }
  }

  const canSend = Boolean(subject.trim() && body.trim() && recipientCount > 0 && !busy)
  const audienceLabel =
    audience === "roster"
      ? `everyone on the roster (${recipientCount})`
      : audience === "venue"
        ? `${venue || "the selected venue"} (${recipientCount})`
        : `${recipientCount} typed ${recipientCount === 1 ? "address" : "addresses"}`

  return (
    <div className="grid gap-4 px-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Write mail</CardTitle>
          <CardDescription>
            Write the message here, save it if you want to reuse it, then send it.
            Use {"{{name}}"}, {"{{team}}"}, {"{{venue}}"}, and {"{{confirm_url}}"} to personalize each email.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
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
            <Label htmlFor="mail-body">Message</Label>
            <Textarea
              id="mail-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={"Hi {{name}},\n\nYour team {{team}} is confirmed for {{venue}}."}
              className="min-h-48"
              maxLength={12000}
            />
          </div>
          <div className="grid gap-2">
            <Label>Send to</Label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["custom", "Typed emails"],
                  ["venue", "One venue"],
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
                aria-label="Venue"
              >
                <option value="">{loading ? "Loading venues…" : "Choose a venue"}</option>
                {venues.map(([label, count]) => (
                  <option key={label} value={label}>
                    {label} ({count})
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
                {loading ? "Counting people…" : `${rosterCount} people with an email address.`}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label>Email preview</Label>
            <p className="text-sm text-muted-foreground">
              {"{{name}}"} becomes each person’s name. This sample uses Alex Rivera.
            </p>
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={composeMessageHtml(preview.subject, preview.body)}
              className="h-[720px] w-full rounded-xl border bg-[#efeafc]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || !subject.trim() || !body.trim()}
              onClick={() => void send(true)}
            >
              Send test to me
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" disabled={!canSend}>
                  {`Send to ${recipientCount || 0}`}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Send this mail?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This sends “{subject.trim() || "this message"}” to {audienceLabel}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void send(false)}>Send</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {result ? <p className="text-sm text-muted-foreground">{result}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>Save this message and open it again later.</CardDescription>
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
            <p className="text-sm text-muted-foreground">No saved templates yet.</p>
          ) : (
            <ul className="grid gap-2">
              {templates.map((template) => (
                <li key={template.id} className="rounded-lg border px-3 py-3">
                  <p className="font-medium">{template.name}</p>
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
    </div>
  )
}
