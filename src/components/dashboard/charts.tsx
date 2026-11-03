"use client"

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--popover-foreground)",
    boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)",
  },
  itemStyle: { color: "var(--popover-foreground)" },
  labelStyle: { color: "var(--muted-foreground)", marginBottom: 4 },
  cursor: { fill: "var(--muted)", opacity: 0.6 },
}

const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const

export interface StatusSlice {
  key: string
  label: string
  value: number
  color: string
}

/** Donut with a centred headline; legend rendered as labelled rows so color is never the only cue. */
export function StatusDonut({ data, centerLabel, centerValue }: { data: StatusSlice[]; centerLabel: string; centerValue: string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative size-40 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={total ? data : [{ key: "empty", label: "No data", value: 1, color: "var(--muted)" }]}
              dataKey="value"
              nameKey="label"
              innerRadius={54}
              outerRadius={72}
              paddingAngle={total ? 2 : 0}
              stroke="var(--card)"
              strokeWidth={2}
              cornerRadius={3}
              isAnimationActive={false}
            >
              {(total ? data : [{ color: "var(--muted)" }]).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            {total > 0 && <Tooltip {...tooltipStyle} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{centerValue}</span>
          <span className="text-[11px] text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <ul className="grid w-full gap-2 text-sm">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ background: d.color }} />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="ml-auto font-medium tabular-nums">{d.value}</span>
            <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
              {total ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface CoverageBarDatum {
  name: string
  covered: number
  uncovered: number
}

export function CoverageBars({ data, height = 240 }: { data: CoverageBarDatum[]; height?: number }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart-1" /> Covered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-destructive" /> Uncovered
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} barCategoryGap="30%" margin={{ left: -18, right: 4, top: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" {...axis} interval={0} />
          <YAxis allowDecimals={false} {...axis} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="covered" name="Covered" stackId="a" fill="var(--chart-1)" maxBarSize={36} stroke="var(--card)" strokeWidth={2} />
          <Bar
            dataKey="uncovered"
            name="Uncovered"
            stackId="a"
            fill="var(--destructive)"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
            stroke="var(--card)"
            strokeWidth={2}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SimpleBars({
  data,
  color = "var(--chart-1)",
  height = 200,
  name = "Count",
}: {
  data: { name: string; value: number; color?: string }[]
  color?: string
  height?: number
  name?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barCategoryGap="35%" margin={{ left: -18, right: 4, top: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" {...axis} interval={0} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="value" name={name} radius={[4, 4, 0, 0]} maxBarSize={36}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
