"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { ChartPoint } from "@/lib/types"

const chartConfig = {
  value: { label: "Registrations", color: "var(--foreground)" },
} satisfies ChartConfig

function MonoBar({
  title,
  description,
  data,
}: {
  title: string
  description: string
  data: ChartPoint[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
          <BarChart data={data} margin={{ left: 0, right: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              angle={data.length > 5 ? -20 : 0}
              height={data.length > 5 ? 60 : 32}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={28}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
            <Bar dataKey="value" fill="var(--foreground)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function RegistrationCharts({
  byLocation,
  byCity,
  byBuilder,
  byCollege,
}: {
  byLocation: ChartPoint[]
  byCity: ChartPoint[]
  byBuilder: ChartPoint[]
  byCollege: ChartPoint[]
}) {
  return (
    <div className="grid gap-4 px-4 lg:px-6 @3xl/main:grid-cols-2">
      <MonoBar
        title="By location"
        description="Where people are joining from"
        data={byLocation}
      />
      <MonoBar
        title="By city"
        description="Venue mapped to city"
        data={byCity}
      />
      <MonoBar
        title="By builder type"
        description="Student, professional, founder"
        data={byBuilder}
      />
      <MonoBar
        title="By college / org"
        description="Top organizations in the roster"
        data={byCollege}
      />
    </div>
  )
}
