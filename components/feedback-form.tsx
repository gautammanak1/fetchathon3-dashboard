"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FEEDBACK_AREAS, FEEDBACK_CITIES, FEEDBACK_ROLES } from "@/lib/feedback-options"
import { cn } from "cn"

const RATINGS = [
  [1, "Poor"],
  [2, "Weak"],
  [3, "Okay"],
  [4, "Good"],
  [5, "Great"],
] as const

export function FeedbackForm() {
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [teamId, setTeamId] = React.useState("")
  const [city, setCity] = React.useState("")
  const [role, setRole] = React.useState("")
  const [rating, setRating] = React.useState<number | null>(null)
  const [wentWell, setWentWell] = React.useState("")
  const [problems, setProblems] = React.useState("")
  const [areas, setAreas] = React.useState<string[]>([])
  const [useAgain, setUseAgain] = React.useState("")
  const [fixNext, setFixNext] = React.useState("")
  const [techFeedback, setTechFeedback] = React.useState("")
  const [asi1Feedback, setAsi1Feedback] = React.useState("")
  const [anythingElse, setAnythingElse] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const toggleArea = (area: string) => {
    setAreas((current) =>
      current.includes(area) ? current.filter((item) => item !== area) : [...current, area],
    )
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          teamId,
          city,
          role,
          rating,
          wentWell,
          problems,
          problemAreas: areas,
          useAgain,
          fixNext,
          techFeedback,
          asi1Feedback,
          anythingElse,
        }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(payload.error || "Could not save feedback")
      setDone(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save feedback")
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="grid gap-2">
        <h2 className="text-xl">Thank you. We have your feedback.</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          The problems you wrote will go to the Fetch-A-Thon team, including the parts that did not work.
        </p>
      </div>
    )
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="feedback-name">Name</Label>
          <Input id="feedback-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="feedback-email">Email</Label>
          <Input id="feedback-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="feedback-team">Team ID</Label>
          <Input id="feedback-team" value={teamId} onChange={(event) => setTeamId(event.target.value)} placeholder="fetchathon3.0-1899" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="feedback-city">City</Label>
          <select
            id="feedback-city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">Choose a city</option>
            {FEEDBACK_CITIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm">You joined as</legend>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_ROLES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRole(item)}
              className={cn(
                "h-8 rounded-lg border px-3 text-sm",
                role === item ? "border-foreground bg-foreground text-background" : "border-border bg-background",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="text-sm">How was Fetch-A-Thon 3.0 for you?</legend>
        <div className="flex flex-wrap gap-2">
          {RATINGS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className={cn(
                "h-8 rounded-lg border px-3 text-sm",
                rating === value ? "border-foreground bg-foreground text-background" : "border-border bg-background",
              )}
            >
              {value} {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="feedback-well">What worked?</Label>
        <Textarea id="feedback-well" value={wentWell} onChange={(event) => setWentWell(event.target.value)} placeholder="A session, a venue, an agent, a person who helped" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="feedback-problems">What problem did you hit?</Label>
        <Textarea
          id="feedback-problems"
          value={problems}
          onChange={(event) => setProblems(event.target.value)}
          required
          placeholder="Tell us what broke, confused you, or wasted your time. This is the part we need."
          className="min-h-28"
        />
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm">Where did that problem show up?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {FEEDBACK_AREAS.map((area) => (
            <label key={area} className="flex items-center gap-2 text-sm">
              <Checkbox checked={areas.includes(area)} onCheckedChange={() => toggleArea(area)} />
              {area}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="text-sm">Would you keep building with Fetch.ai after this?</legend>
        <div className="flex flex-wrap gap-2">
          {[
            ["yes", "Yes"],
            ["maybe", "Maybe"],
            ["no", "No"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setUseAgain(value)}
              className={cn(
                "h-8 rounded-lg border px-3 text-sm",
                useAgain === value ? "border-foreground bg-foreground text-background" : "border-border bg-background",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="feedback-next">What should we fix before the next one?</Label>
        <Textarea id="feedback-next" value={fixNext} onChange={(event) => setFixNext(event.target.value)} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="feedback-tech">Tech feedback</Label>
        <p className="text-sm text-muted-foreground">Where can we improve the tech?</p>
        <Textarea
          id="feedback-tech"
          value={techFeedback}
          onChange={(event) => setTechFeedback(event.target.value)}
          placeholder="Agents, dashboard, registration, check-in, mail, or anything that felt rough"
          className="min-h-28"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="feedback-asi1">ASI:One feedback</Label>
        <p className="text-sm text-muted-foreground">Where can we improve ASI:One?</p>
        <Textarea
          id="feedback-asi1"
          value={asi1Feedback}
          onChange={(event) => setAsi1Feedback(event.target.value)}
          placeholder="What broke, what was confusing, and what would make ASI:One easier to use"
          className="min-h-28"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="feedback-else">Anything else</Label>
        <Textarea id="feedback-else" value={anythingElse} onChange={(event) => setAnythingElse(event.target.value)} />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={busy || !problems.trim()}>
        {busy ? "Sending" : "Send feedback"}
      </Button>
    </form>
  )
}
