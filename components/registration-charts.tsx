"use client"

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"

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

const LABEL_WIDTH = 176

function wrapLabel(name: string, max = 22) {
  if (name.length <= max) return [name]
  const words = name.split(" ")
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > max && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  if (lines.length <= 2) return lines
  return [lines[0], `${lines.slice(1).join(" ").slice(0, max - 1)}…`]
}

function CategoryTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number
  y?: number
  payload?: { value: string }
}) {
  const lines = wrapLabel(String(payload?.value || ""))
  return (
    <text
      x={x - 6}
      y={y}
      textAnchor="end"
      fill="var(--muted-foreground)"
      fontSize={11}
    >
      {lines.map((line, index) => (
        <tspan
          key={`${line}-${index}`}
          x={x - 6}
          dy={index === 0 ? (lines.length > 1 ? -6 : 4) : 12}
        >
          {line}
        </tspan>
      ))}
    </text>
  )
}

function MonoBar({
  title,
  description,
  data,
}: {
  title: string
  description: string
  data: ChartPoint[]
}) {
  const height = Math.max(280, data.length * 48 + 40)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto w-full"
          style={{ height }}
        >
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 8, right: 36, top: 8, bottom: 8 }}
          >
            <CartesianGrid
              vertical
              horizontal={false}
              stroke="var(--border)"
            />
            <XAxis
              type="number"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={LABEL_WIDTH}
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={<CategoryTick />}
            />
            <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
            <Bar
              dataKey="value"
              fill="var(--foreground)"
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
            >
              <LabelList
                dataKey="value"
                position="right"
                fill="var(--muted-foreground)"
                fontSize={11}
              />
            </Bar>
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
