import { FetchathonLogo } from "@/components/fetchathon-logo"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { VenuePass } from "@/lib/venue-pass"

export function VenuePassCard({ pass }: { pass: VenuePass }) {
  return (
    <Card className="w-full max-w-xl shadow-xs">
      <CardHeader className="gap-4">
        <FetchathonLogo />
        <div>
          <CardDescription>Fetch-A-Thon 3.0 venue pass</CardDescription>
          <CardTitle className="font-mono text-2xl">{pass.teamId}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-1 text-sm">
          <p className="text-muted-foreground">Venue</p>
          <p className="font-medium">{pass.venue}</p>
        </div>
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">
            {pass.members.length === 1 ? "Participant" : "Team"}
          </p>
          {pass.members.length === 0 ? (
            <p className="text-sm">Team pass is ready. Member names will appear after roster sync.</p>
          ) : (
            <ul className="grid gap-3">
              {pass.members.map((member) => (
                <li
                  key={`${member.name}-${member.role}-${member.organization}`}
                  className="rounded-lg border px-3 py-3"
                >
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {member.role} · {member.builder}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {member.organization} · {member.city}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Show this page at check-in. One pass is shared by the whole team.
        </p>
      </CardContent>
    </Card>
  )
}

export function VenuePassMissing() {
  return (
    <Card className="w-full max-w-xl shadow-xs">
      <CardHeader>
        <FetchathonLogo />
        <CardTitle>Pass not found</CardTitle>
        <CardDescription>
          This QR is not a valid Fetch-A-Thon venue pass.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
