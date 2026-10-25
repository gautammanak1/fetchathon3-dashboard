"use client"

import * as React from "react"
import { CheckIcon, DownloadIcon, ExternalLinkIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { projectsToCsv } from "@/lib/project-csv"
import type { ProjectBoard as Board, ProjectSubmission } from "@/lib/projects"
import { cn } from "cn"

function projectReviewed(project: Pick<ProjectSubmission, "rating" | "score" | "comment">) {
  return project.rating != null || project.score != null || project.comment.trim().length > 0
}

type Filter = "all" | "unscored"

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unscored", label: "Not reviewed" },
]

function matches(project: ProjectSubmission, filter: Filter, query: string) {
  if (filter === "unscored" && projectReviewed(project)) return false
  if (!query) return true
  const haystack = [
    project.project_name,
    project.team_name,
    project.team_id_display,
    project.description,
    ...project.members.map((member) => `${member.name} ${member.email}`),
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(query)
}

function LinkChip({ label, href }: { label: string; href: string }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={href}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs hover:bg-muted"
    >
      {label}
      <ExternalLinkIcon className="size-3 text-muted-foreground" />
    </a>
  )
}

function Marks({ score, size = "sm" }: { score: number | null; size?: "sm" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md tabular-nums",
        size === "lg" ? "h-10 min-w-12 px-2 text-lg" : "h-7 min-w-9 px-1.5 text-sm",
        score == null
          ? "text-muted-foreground/40"
          : "bg-emerald-500/15 font-medium text-emerald-800 dark:text-emerald-200",
      )}
    >
      {score == null ? "–" : score}
    </span>
  )
}

export function ProjectBoard({ initial }: { initial: Board }) {
  const [board, setBoard] = React.useState(initial)
  const [filter, setFilter] = React.useState<Filter>("all")
  const [query, setQuery] = React.useState("")
  const [selectedId, setSelectedId] = React.useState(initial.projects[0]?.id || "")
  const [saving, setSaving] = React.useState(false)
  const [drafts, setDrafts] = React.useState<
    Record<string, { rating: number | null; score: string; comment: string; reviewer: string }>
  >({})

  const needle = query.trim().toLowerCase()
  const visible = board.projects.filter((project) => matches(project, filter, needle))
  const selected = visible.find((project) => project.id === selectedId) || visible[0] || null
  const draft = selected
    ? drafts[selected.team_id] || {
        rating: selected.rating,
        score: selected.score == null ? "" : String(selected.score),
        comment: selected.comment,
        reviewer: selected.reviewer,
      }
    : null
  const dirty = Boolean(
    selected &&
      draft &&
      (draft.rating !== selected.rating ||
        draft.score !== (selected.score == null ? "" : String(selected.score)) ||
        draft.comment !== selected.comment ||
        draft.reviewer !== selected.reviewer),
  )
  const counts: Record<Filter, number> = {
    all: board.projects.length,
    unscored: board.projects.filter((project) => !projectReviewed(project)).length,
  }

  function updateDraft(
    teamId: string,
    patch: Partial<{ rating: number | null; score: string; comment: string; reviewer: string }>,
  ) {
    const current = board.projects.find((project) => project.team_id === teamId)
    setDrafts((prev) => {
      const base = prev[teamId] || {
        rating: current?.rating ?? null,
        score: current?.score == null ? "" : String(current.score),
        comment: current?.comment || "",
        reviewer: current?.reviewer || "",
      }
      return { ...prev, [teamId]: { ...base, ...patch } }
    })
  }

  async function save() {
    if (!selected || !draft) return
    setSaving(true)
    try {
      const response = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: selected.team_id,
          rating: draft.rating,
          score: draft.score.trim() === "" ? null : Number(draft.score),
          comment: draft.comment,
          reviewer: draft.reviewer,
        }),
      })
      const body = (await response.json()) as {
        error?: string
        rating?: number | null
        score?: number | null
        comment?: string
        reviewer?: string
        reviewed_at?: string | null
      }
      if (!response.ok) throw new Error(body.error || "Could not save the review")
      setBoard((current) => {
        const projects = current.projects.map((project) =>
          project.team_id === selected.team_id
            ? {
                ...project,
                rating: body.rating ?? null,
                score: body.score ?? null,
                comment: body.comment || "",
                reviewer: body.reviewer || "",
                reviewed_at: body.reviewed_at || null,
              }
            : project,
        )
        const scored = projects.filter((project) => project.score != null)
        return {
          ...current,
          projects,
          stats: {
            ...current.stats,
            scored: scored.length,
            reviewed: projects.filter((project) => projectReviewed(project)).length,
            average_score:
              scored.length === 0
                ? null
                : Math.round(
                    (scored.reduce((sum, project) => sum + Number(project.score), 0) / scored.length) * 10,
                  ) / 10,
          },
        }
      })
      toast.success("Saved this team's score")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the review")
    } finally {
      setSaving(false)
    }
  }

  function downloadCsv() {
    const csv = projectsToCsv(board.projects)
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "fetchathon-projects.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="font-normal font-sans antialiased flex h-[calc(100svh-var(--header-height)-4.25rem)] min-h-128 flex-col gap-3 px-4 lg:px-6">
      {board.notice ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {board.notice}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 lg:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search project, team, or member"
            className="pl-8"
          />
        </div>
        <div className="flex w-fit max-w-full flex-wrap rounded-lg border bg-muted/40 p-0.5">
          {FILTERS.map((item) => {
            const active = filter === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs",
                  active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                <span className={cn("tabular-nums", active ? "text-foreground/70" : "text-muted-foreground/80")}>
                  {counts[item.id]}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-sm text-muted-foreground lg:ml-auto">
          <span className="tabular-nums text-foreground">{visible.length}</span>
          {visible.length === board.stats.total ? "" : ` of ${board.stats.total}`} projects
          {board.stats.reviewed ? (
            <>
              {" · "}
              <span className="tabular-nums text-foreground">{board.stats.reviewed}</span> reviewed
            </>
          ) : null}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={downloadCsv}>
          <DownloadIcon />
          Download CSV
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <div className="flex max-h-80 min-h-0 flex-col overflow-hidden rounded-xl border bg-card lg:max-h-none">
          <div className="flex items-center justify-between border-b px-3 py-2 text-[11px] tracking-wide text-muted-foreground uppercase">
            <span>Project</span>
            <span className="w-11 text-center">Marks</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No projects match this view.</p>
            ) : (
              visible.map((project) => {
                const active = selected?.id === project.id
                const reviewed = projectReviewed(project)
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedId(project.id)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-l-2 px-3 py-2.5 text-left last:border-b-0",
                      reviewed ? "border-l-emerald-500" : "border-l-transparent",
                      active
                        ? reviewed
                          ? "bg-emerald-500/15"
                          : "bg-muted"
                        : reviewed
                          ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                          : "hover:bg-muted/60",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm">{project.project_name}</span>
                        {reviewed ? <CheckIcon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" /> : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {project.team_id_display}
                        {project.team_name ? ` · ${project.team_name}` : ""}
                        {` · ${project.members.length}`}
                      </span>
                      {reviewed && project.reviewer ? (
                        <span className="mt-0.5 block truncate text-xs text-emerald-800 dark:text-emerald-200">
                          Reviewed by {project.reviewer}
                        </span>
                      ) : null}
                    </span>
                    <Marks score={project.score} />
                  </button>
                )
              })
            )}
          </div>
        </div>

        {selected && draft ? (
          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
            <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base">{selected.project_name}</h2>
                  {projectReviewed(selected) ? <Badge variant="secondary">Reviewed</Badge> : null}
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {selected.team_id_display}
                  {selected.team_name ? ` · ${selected.team_name}` : ""}
                  {selected.location ? ` · ${selected.location}` : ""}
                </p>
                {projectReviewed(selected) && selected.reviewer ? (
                  <p className="mt-1 truncate text-sm">
                    Reviewed by {selected.reviewer}
                    {selected.reviewed_at ? (
                      <span className="text-muted-foreground">
                        {" · "}
                        {new Date(selected.reviewed_at).toLocaleString()}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <Marks score={selected.score} size="lg" />
                <p className="mt-1 text-[11px] tracking-wide text-muted-foreground uppercase">Marks</p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {selected.description ? (
                <p className="max-w-3xl text-sm leading-6 whitespace-pre-wrap">{selected.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No description yet.</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <LinkChip label="GitHub" href={selected.github_url} />
                <LinkChip label="Demo" href={selected.video_url} />
                <LinkChip label="Slides" href={selected.ppt_url} />
                <LinkChip label="Deploy" href={selected.deploy_url} />
                <LinkChip label="Agent" href={selected.agent_url} />
              </div>
              {selected.framework || selected.self_rating ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {selected.framework ? `Framework ${selected.framework}` : ""}
                  {selected.framework && selected.self_rating ? " · " : ""}
                  {selected.self_rating ? `Their experience rating ${selected.self_rating}/5` : ""}
                </p>
              ) : null}
              <h3 className="mt-6 mb-2 text-xs tracking-wide text-muted-foreground uppercase">
                Team · {selected.members.length}
              </h3>
              {selected.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No roster members matched this team id.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {selected.members.map((member) => (
                    <li key={`${member.email}-${member.name}`} className="rounded-lg border px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="truncate">{member.name || "Unnamed"}</span>
                        {member.lead ? <Badge variant="secondary">Lead</Badge> : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {[member.lead ? "" : member.role, member.organization, member.email].filter(Boolean).join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="shrink-0 border-t bg-muted/30 px-4 py-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="mb-1.5 text-xs tracking-wide text-muted-foreground uppercase">Rating</h3>
                  <div className="flex gap-1">
                    {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          updateDraft(selected.team_id, {
                            rating: draft.rating === value ? null : value,
                          })
                        }
                        className={cn(
                          "size-8 rounded-md border text-sm tabular-nums",
                          draft.rating === value
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background hover:bg-muted",
                        )}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-44">
                  <h3 className="mb-1.5 text-xs tracking-wide text-muted-foreground uppercase">Reviewer</h3>
                  <Input
                    value={draft.reviewer}
                    placeholder="Name"
                    onChange={(event) => updateDraft(selected.team_id, { reviewer: event.target.value })}
                  />
                </div>
                <div className="w-28">
                  <h3 className="mb-1.5 text-xs tracking-wide text-muted-foreground uppercase">Marks</h3>
                  <div className="relative">
                    <Input
                      inputMode="decimal"
                      value={draft.score}
                      placeholder="—"
                      onChange={(event) => updateDraft(selected.team_id, { score: event.target.value })}
                      className="pr-10"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                      /100
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="mb-1.5 text-xs tracking-wide text-muted-foreground uppercase">Comment</h3>
                  <Textarea
                    value={draft.comment}
                    placeholder="Notes for this team"
                    onChange={(event) => updateDraft(selected.team_id, { comment: event.target.value })}
                    className="h-8 min-h-8 resize-none py-1.5"
                  />
                </div>
                <Button type="button" className="shrink-0" onClick={save} disabled={saving || !dirty}>
                  {saving ? "Saving" : dirty ? "Save review" : "Saved"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            No projects in this view.
          </div>
        )}
      </div>
    </div>
  )
}
