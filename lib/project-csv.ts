import type { ProjectSubmission } from "@/lib/projects"

function cell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export function projectsToCsv(projects: ProjectSubmission[]) {
  const headers = [
    "Project",
    "Team",
    "Team ID",
    "Status",
    "Source",
    "Location",
    "Framework",
    "Lead",
    "Members",
    "GitHub",
    "Demo",
    "Slides",
    "Deploy",
    "Agent",
    "Description",
    "Rating",
    "Score",
    "Comment",
    "Reviewed by",
    "Reviewed at",
  ]
  const lines = projects.map((project) => {
    const person = (member: ProjectSubmission["members"][number]) =>
      member.email ? `${member.name} <${member.email}>` : member.name
    const lead = project.members.find((member) => member.lead)
    const members = project.members.map(person).join("; ")
    return [
      project.project_name,
      project.team_name,
      project.team_id_display,
      project.status,
      project.source,
      project.location,
      project.framework,
      lead ? person(lead) : "",
      members,
      project.github_url,
      project.video_url,
      project.ppt_url,
      project.deploy_url,
      project.agent_url,
      project.description,
      project.rating ?? "",
      project.score ?? "",
      project.comment,
      project.reviewer,
      project.reviewed_at || "",
    ]
      .map(cell)
      .join(",")
  })
  return `\uFEFF${headers.map(cell).join(",")}\n${lines.join("\n")}\n`
}
