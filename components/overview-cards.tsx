import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { RosterPayload } from "@/lib/types"

export function OverviewCards({ stats }: { stats: RosterPayload["stats"] }) {
  const items = [
    {
      label: "Registrations",
      value: stats.total,
      hint: `${stats.submitted} submitted · ${stats.drafts} draft`,
    },
    {
      label: "Teams",
      value: stats.teams,
      hint: `${stats.completeTeams} complete`,
    },
    {
      label: "RSVP sent",
      value: stats.rsvpSent,
      hint: "Seat confirmation before team QR",
    },
    {
      label: "QR ready",
      value: stats.qrGenerated,
      hint: `${stats.qrSent} team QRs emailed`,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="@container/card">
          <CardHeader>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="font-mono text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {item.value}
            </CardTitle>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">
            {item.hint}
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
