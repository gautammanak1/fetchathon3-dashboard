"use client"

import * as React from "react"
import { ExternalLinkIcon, SearchIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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

function ProjectCard({ project }: { project: ProjectSubmission }) {
  const place = placeOf(project)
  const team = teamLabel(project.team_name)
  const members = project.members.filter((member) => member.name.trim())
  const links = [
    ["GitHub", project.github_url],
    ["Demo", project.video_url],
    ["Slides", project.ppt_url],
    ["Deploy", project.deploy_url],
    ["Agent", project.agent_url],
  ].filter((item): item is [string, string] => Boolean(item[1]))
  return (
    <Card
      className={cn(
        "font-normal font-sans antialiased h-full",
        place && "ring-amber-500/60",
      )}
    >
      <CardHeader>
        {place ? (
          <p className="text-[11px] tracking-wide text-amber-800 uppercase dark:text-amber-200">{place}</p>
        ) : null}
        <CardTitle className="font-normal">{project.project_name}</CardTitle>
        <p className="truncate text-sm text-muted-foreground">
          {project.team_id_display}
          {team ? ` · ${team}` : ""}
          {project.location ? ` · ${project.location}` : ""}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {project.description ? (
          <p className="line-clamp-4 text-sm leading-6 whitespace-pre-wrap">{project.description}</p>
        ) : null}
        {members.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {members.map((member, index) => (
              <li key={`${member.name}-${index}`}>
                <Badge variant="secondary">
                  {member.name}
                  {member.lead ? " · Lead" : ""}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
      {links.length > 0 ? (
        <CardFooter className="mt-auto flex flex-wrap gap-2">
          {links.map(([label, href]) => (
            <LinkChip key={label} label={label} href={href} />
          ))}
        </CardFooter>
      ) : null}
    </Card>
  )
}

export function ProjectBoard({ initial }: { initial: Board }) {
  const [query, setQuery] = React.useState("")
  const needle = query.trim().toLowerCase()
  const visible = initial.projects
    .filter((project) => matches(project, needle))
    .sort(
      (a, b) =>
        projectWinnerRank(a.team_id, a.team_id_display) -
        projectWinnerRank(b.team_id, b.team_id_display),
    )

  return (
    <div className="font-normal font-sans antialiased flex flex-col gap-4 px-4 lg:px-6">
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

      {visible.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No projects match this view.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
