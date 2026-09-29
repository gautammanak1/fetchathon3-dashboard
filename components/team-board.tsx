"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Team } from "@/lib/types"

export function TeamBoard({ teams }: { teams: Team[] }) {
  if (teams.length === 0) {
    return (
      <p className="px-4 text-sm text-muted-foreground lg:px-6">
        No teams in the current filter.
      </p>
    )
  }

  return (
    <div className="grid gap-4 px-4 md:grid-cols-2 xl:grid-cols-3 lg:px-6">
      {teams.map((team) => {
        const expected = team.expected_size || team.registered_count || 1
        const width = Math.min(100, Math.round((team.registered_count / expected) * 100))
        return (
          <Card key={team.team_id || team.lead_email}>
            <CardHeader className="gap-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="font-mono text-base">
                  {team.team_id_display || "No team id"}
                </CardTitle>
                <Badge variant="outline">{team.team_status.split(" ")[0]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {team.lead_name} · {team.location || "No location"}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {team.registered_count}
                    {team.expected_size ? ` / ${team.expected_size}` : ""} registered
                  </span>
                  <span>
                    {team.seats_remaining === null
                      ? "size pending"
                      : `${team.seats_remaining} seats left`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-foreground"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                {team.members.map((member) => (
                  <li key={member.id} className="flex items-center justify-between gap-2">
                    <span>
                      {member.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {member.role}
                      </span>
                    </span>
                    <Badge variant="outline">{member.status || "—"}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
