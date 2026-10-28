"use client"

import * as React from "react"
import { ExternalLinkIcon, SearchIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import type { ProjectBoard as Board, ProjectSubmission } from "@/lib/projects"
import { projectPlace, projectWinnerRank } from "@/lib/winners"
import { cn } from "cn"

const OBJECT_NAME = /\[object object\]/i

function teamLabel(name: string) {
  const text = name.trim()
  if (!text || OBJECT_NAME.test(text)) return ""
  return text
}

function placeOf(project: ProjectSubmission) {
  return projectPlace(project.team_id, project.team_id_display)
}

function matches(project: ProjectSubmission, query: string) {
  if (!query) return true
  const haystack = [
    project.project_name,
    teamLabel(project.team_name),
    project.team_id_display,
    project.description,
    placeOf(project),
    ...project.members.map((member) => member.name),
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

export function ProjectBoard({ initial }: { initial: Board }) {
  const [query, setQuery] = React.useState("")
  const [selectedId, setSelectedId] = React.useState(initial.projects[0]?.id || "")
  const needle = query.trim().toLowerCase()
  const visible = initial.projects
    .filter((project) => matches(project, needle))
    .sort(
      (a, b) =>
        projectWinnerRank(a.team_id, a.team_id_display) -
        projectWinnerRank(b.team_id, b.team_id_display),
    )
  const selected = visible.find((project) => project.id === selectedId) || visible[0] || null
  const selectedPlace = selected ? placeOf(selected) : ""

  return (
    <div className="font-normal font-sans antialiased flex h-[calc(100svh-var(--header-height)-4.25rem)] min-h-128 flex-col gap-3 px-4 lg:px-6">
      {initial.notice ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {initial.notice}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 lg:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search project, team, or winner"
            aria-label="Search projects"
            className="pl-8"
          />
        </div>
        <p className="text-sm text-muted-foreground lg:ml-auto">
          <span className="tabular-nums text-foreground">{visible.length}</span>
          {visible.length === initial.stats.total ? "" : ` of ${initial.stats.total}`} projects
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <div className="flex max-h-80 min-h-0 flex-col overflow-hidden rounded-xl border bg-card lg:max-h-none">
          <div className="border-b px-3 py-2 text-[11px] tracking-wide text-muted-foreground uppercase">
            Project
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No projects match this view.</p>
            ) : (
              visible.map((project) => {
                const active = selected?.id === project.id
                const place = placeOf(project)
                const team = teamLabel(project.team_name)
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedId(project.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 border-b border-l-2 px-3 py-2.5 text-left last:border-b-0",
                      place ? "border-l-amber-500" : "border-l-transparent",
                      active
                        ? place
                          ? "bg-amber-500/15"
                          : "bg-muted"
                        : place
                          ? "bg-amber-500/10 hover:bg-amber-500/15"
                          : "hover:bg-muted/60",
                    )}
                  >
                    {place ? (
                      <span className="text-[11px] tracking-wide text-amber-800 uppercase dark:text-amber-200">
                        {place}
                      </span>
                    ) : null}
                    <span className="truncate text-sm">{project.project_name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {project.team_id_display}
                      {team ? ` · ${team}` : ""}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {selected ? (
          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
            <div className="border-b px-4 py-3">
              {selectedPlace ? (
                <p className="mb-1 text-[11px] tracking-wide text-amber-800 uppercase dark:text-amber-200">
                  {selectedPlace}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base">{selected.project_name}</h2>
                {selectedPlace ? <Badge variant="secondary">{selectedPlace}</Badge> : null}
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {selected.team_id_display}
                {teamLabel(selected.team_name) ? ` · ${teamLabel(selected.team_name)}` : ""}
                {selected.location ? ` · ${selected.location}` : ""}
              </p>
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
              {selected.framework ? (
                <p className="mt-3 text-xs text-muted-foreground">Framework {selected.framework}</p>
              ) : null}
              <h3 className="mt-6 mb-2 text-xs tracking-wide text-muted-foreground uppercase">
                Team · {selected.members.length}
              </h3>
              {selected.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No roster members matched this team id.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {selected.members.map((member, index) => (
                    <li key={`${member.name}-${member.role}-${index}`} className="rounded-lg border px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="truncate">{member.name || "Unnamed"}</span>
                        {member.lead ? <Badge variant="secondary">Lead</Badge> : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {[member.lead ? "" : member.role, member.organization].filter(Boolean).join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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
