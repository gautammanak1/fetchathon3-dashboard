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
import { Checkbox } from "@/components/ui/checkbox"
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
import type { RosterPayload } from "@/lib/types"

type Audience = "roster" | "venue" | "confirmed" | "custom"
type Kind = "rsvp" | "reject" | "custom"
type NotePack = "rsvp" | "confirm"

const DRAFT_KEY = "fetchathon-mail-draft"
const SAMPLE = {
  name: "Alex Rivera",
  team: "fetchathon3.0-12",
  venue: "Presidency University, Bengaluru",
  email: "alex@example.com",
  map: "https://www.google.com/maps/search/?api=1&query=Presidency+University+Itgalpur+Rajanakunte+Yelahanka+Bengaluru",
  confirm_url: "https://example.com/rsvp/confirm/sample",
}

export function MailComposer({ initial }: { initial?: RosterPayload | null }) {
  const { data, loading } = useRoster(initial)
  const [kind, setKind] = React.useState<Kind>("rsvp")
  const [templateName, setTemplateName] = React.useState("")
  const [templateId, setTemplateId] = React.useState<string | null>(null)
  const [subject, setSubject] = React.useState("")
  const [body, setBody] = React.useState("")
  const [audience, setAudience] = React.useState<Audience>("venue")
  const [venue, setVenue] = React.useState("")
  const [emails, setEmails] = React.useState("")
  const [pack, setPack] = React.useState<NotePack>("rsvp")
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [pickVenue, setPickVenue] = React.useState("")
  const [pickQuery, setPickQuery] = React.useState("")
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
          if (
            draft.audience === "roster" ||
            draft.audience === "venue" ||
            draft.audience === "confirmed" ||
            draft.audience === "custom"
          ) {
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

  const notePool = React.useMemo(() => {
    return (data?.registrations || []).filter((row) => {
      if (!COMPOSE_EMAIL_RE.test(row.email.trim().toLowerCase())) return false
      if (pack === "confirm") return row.qr_status === "sent"
      return row.rsvp_status !== "none"
    })
  }, [data, pack])

  const noteVenues = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of notePool) {
      const label = mailVenue(row.city, row.metro).label
      counts.set(label, (counts.get(label) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [notePool])

  const visiblePeople = React.useMemo(() => {
    const query = pickQuery.trim().toLowerCase()
    return notePool.filter((row) => {
      if (pickVenue && mailVenue(row.city, row.metro).label !== pickVenue) return false
      if (!query) return true
      return [row.name, row.email, row.team_id_display, row.team_id]
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [notePool, pickQuery, pickVenue])

  const addressBook = React.useMemo(() => {
    const venues = new Map<string, { people: number; mailed: number; confirmed: number; rejected: number }>()
    let people = 0
    let confirmMailed = 0
    for (const row of data?.registrations || []) {
      const email = row.email.trim().toLowerCase()
      if (!COMPOSE_EMAIL_RE.test(email)) continue
      people += 1
      if (row.qr_status === "sent") confirmMailed += 1
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
      confirmMailed,
      venues: [...venues.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    }
  }, [data])

  const selectedVenue = addressBook.venues.find(([label]) => label === venue)
  const recipientCount =
    kind === "custom"
      ? selectedIds.length
      : audience === "roster"
        ? addressBook.people
        : audience === "venue"
          ? selectedVenue?.[1].people || 0
          : audience === "confirmed"
            ? addressBook.confirmMailed
            : parseEmailList(emails).length

  const previewPerson = visiblePeople.find((row) => selectedIds.includes(row.id)) || visiblePeople[0]
  const previewPlace = mailVenue(previewPerson?.city || "Gurugram", previewPerson?.metro || "Gurugram")
  const preview = {
    subject: fillTemplate(subject, {
      ...SAMPLE,
      name: previewPerson?.name || SAMPLE.name,
      venue: previewPlace.label,
      map: previewPlace.mapUrl || "",
      team: previewPerson?.team_id_display || SAMPLE.team,
    }) || "Subject",
    body: fillTemplate(body, {
      ...SAMPLE,
      name: previewPerson?.name || SAMPLE.name,
      venue: previewPlace.label,
      map: previewPlace.mapUrl || "",
      team: previewPerson?.team_id_display || SAMPLE.team,
    }) || "<p>Your message will show here.</p>",
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

  const readPayload = async (response: Response) => {
    const text = await response.text()
    try {
      return JSON.parse(text) as { error?: string; note?: string; jobId?: string; status?: string }
    } catch {
      if (response.status === 504) {
        return { error: "The send was cut off before it finished. Start it again only for people who did not get it." }
      }
      return { error: "Could not send mail" }
    }
  }

  const watchJob = async (jobId: string) => {
    for (let attempt = 0; attempt < 400; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const response = await fetch(`/api/mail/send?job=${encodeURIComponent(jobId)}`)
      const payload = await readPayload(response)
      if (!response.ok) throw new Error(payload.error || "Could not check the send")
      setResult(payload.note || "Sending")
      if (payload.status === "done") {
        toast.success(payload.note || "Mail sent")
        return
      }
      if (payload.status === "error") {
        toast.error(payload.note || "Mail send stopped")
        return
      }
    }
  }

  const send = async (test: boolean, force = false) => {
    setBusy(true)
    setResult(null)
    try {
      const response = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          subject,
          body,
          audience: kind === "custom" ? "selected" : audience,
          venue,
          emails,
          ids: kind === "custom" ? selectedIds : undefined,
          pack: kind === "custom" ? pack : undefined,
          test,
          force,
        }),
      })
      const payload = await readPayload(response)
      if (!response.ok) {
        toast.error(payload.error || payload.note || "Could not send mail")
        setResult(payload.error || payload.note || "Could not send mail")
        return
      }
      if (payload.jobId) {
        setResult(payload.note || "Sending")
        toast.success(payload.note || "Sending")
        await watchJob(payload.jobId)
        return
      }
      toast.success(payload.note || "Mail sent")
      setResult(payload.note || "Mail sent")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send mail"
      toast.error(message)
      setResult(message)
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
    kind === "custom"
      ? `${recipientCount} selected ${pack === "confirm" ? "confirm-mailed" : "RSVP-sent"} ${recipientCount === 1 ? "person" : "people"}`
      : audience === "roster"
        ? `everyone on the roster (${recipientCount})`
        : audience === "venue"
          ? `${venue || "the selected location"} (${recipientCount})`
          : audience === "confirmed"
            ? `people who already received the confirm mail (${recipientCount})`
            : `${recipientCount} typed ${recipientCount === 1 ? "address" : "addresses"}`

  const togglePerson = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const selectVisible = () => {
    setSelectedIds((current) => [...new Set([...current, ...visiblePeople.map((row) => row.id)])])
  }

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
                  Use {"{{name}}"}, {"{{team}}"}, {"{{venue}}"}, {"{{map}}"}, and {"{{confirm_url}}"}.
                  This note is only the message. It does not add a location photo, map, or team QR.
                </p>
              </div>
            </>
          ) : null}

          {kind === "custom" ? (
            <div className="grid gap-3">
              <Label>Send to</Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["rsvp", "RSVP sent"],
                    ["confirm", "Confirm mailed"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={pack === value ? "default" : "outline"}
                    onClick={() => {
                      setPack(value)
                      setSelectedIds([])
                      setPickVenue("")
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {pack === "confirm"
                  ? "Click people who already received the confirm mail. They only receive this message."
                  : "Click people whose RSVP was sent. They only receive this message."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant={pickVenue === "" ? "default" : "outline"}
                  onClick={() => setPickVenue("")}
                >
                  All locations ({notePool.length})
                </Button>
                {noteVenues.map(([label, count]) => (
                  <Button
                    key={label}
                    type="button"
                    size="xs"
                    variant={pickVenue === label ? "default" : "outline"}
                    onClick={() => setPickVenue(label)}
                  >
                    {label} ({count})
                  </Button>
                ))}
              </div>
              <Input
                value={pickQuery}
                onChange={(event) => setPickQuery(event.target.value)}
                placeholder="Search name, email, or team"
                aria-label="Search people"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="xs" variant="outline" onClick={selectVisible}>
                  Select visible ({visiblePeople.length})
                </Button>
                <Button type="button" size="xs" variant="ghost" onClick={() => setSelectedIds([])}>
                  Clear
                </Button>
                <p className="text-sm text-muted-foreground">{selectedIds.length} selected</p>
              </div>
              <ul className="grid max-h-80 gap-1 overflow-y-auto rounded-lg border p-2">
                {visiblePeople.length === 0 ? (
                  <li className="px-2 py-3 text-sm text-muted-foreground">No one in this list.</li>
                ) : (
                  visiblePeople.map((row) => {
                    const picked = selectedIds.includes(row.id)
                    const place = mailVenue(row.city, row.metro)
                    return (
                      <li key={row.id}>
                        <label className="flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted">
                          <Checkbox
                            checked={picked}
                            onCheckedChange={() => togglePerson(row.id)}
                            aria-label={`Select ${row.name || row.email}`}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{row.name || row.email}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {row.email} · {row.team_id_display || "Solo"} · {place.label}
                            </span>
                          </span>
                        </label>
                      </li>
                    )
                  })
                )}
              </ul>
            </div>
          ) : null}

          {kind === "custom" ? null : (
          <div className="grid gap-2">
            <Label>Send to</Label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["venue", "One location"],
                  ["confirmed", "Confirm mailed"],
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
            {audience === "confirmed" ? (
              <p className="text-sm text-muted-foreground">
                {loading
                  ? "Counting people…"
                  : `${addressBook.confirmMailed} ${addressBook.confirmMailed === 1 ? "person has" : "people have"} the confirm mail. A note uses each person's own location and map.`}
              </p>
            ) : null}
            {audience === "roster" ? (
              <p className="text-sm text-muted-foreground">
                {loading ? "Counting people…" : `${addressBook.people} people with an email address.`}
              </p>
            ) : null}
          </div>
          )}

          <div className="grid gap-2">
            <Label>Email preview</Label>
            {kind === "custom" ? (
              <iframe
                key={preview.body}
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
                        : `This sends “${subject.trim() || "this message"}” to ${audienceLabel}. Only the message is sent. It does not change RSVP or confirm status.`}
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
