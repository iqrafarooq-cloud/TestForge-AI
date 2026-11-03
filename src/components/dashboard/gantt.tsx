"use client"

import { useState } from "react"
import { addDays, differenceInCalendarDays, eachWeekOfInterval, format, max, min, parseISO } from "date-fns"
import { Loader2, Pencil } from "lucide-react"
import { updatePhase } from "@/app/actions/projects"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useServerAction } from "@/hooks/use-server-action"
import type { Phase } from "@/lib/types"

const PHASE_COLORS = ["var(--chart-1)", "var(--chart-5)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"]

export function Gantt({ projectId, phases, releaseDate }: { projectId: string; phases: Phase[]; releaseDate: string }) {
  const [editing, setEditing] = useState<Phase | null>(null)
  const { run, pending } = useServerAction((input: Parameters<typeof updatePhase>[1]) => updatePhase(projectId, input), {
    success: "Timeline updated",
  })

  if (phases.length === 0) return <p className="text-sm text-muted-foreground">No phases defined.</p>

  const start = min(phases.map((p) => parseISO(p.start_date)))
  const end = max([...phases.map((p) => parseISO(p.end_date)), parseISO(releaseDate)])
  const totalDays = Math.max(differenceInCalendarDays(end, start) + 1, 1)
  const pct = (d: Date) => (differenceInCalendarDays(d, start) / totalDays) * 100
  const today = new Date()
  const todayPct = pct(today)
  const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).filter((w) => w >= start)

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="relative ml-44 h-6 border-b text-[10px] text-muted-foreground">
          {weeks.map((w) => (
            <span key={w.toISOString()} className="absolute -translate-x-1/2" style={{ left: `${pct(w)}%` }}>
              {format(w, "MMM d")}
            </span>
          ))}
        </div>
        <div className="relative">
          {/* week grid + today line */}
          <div className="pointer-events-none absolute inset-y-0 right-0 left-44">
            {weeks.map((w) => (
              <div key={w.toISOString()} className="absolute inset-y-0 border-l border-dashed border-border/70" style={{ left: `${pct(w)}%` }} />
            ))}
            {todayPct >= 0 && todayPct <= 100 && (
              <div className="absolute inset-y-0 z-10 w-px bg-primary" style={{ left: `${todayPct}%` }}>
                <span className="absolute -top-1 left-1 rounded bg-primary px-1 text-[9px] font-medium text-primary-foreground">
                  Today
                </span>
              </div>
            )}
            <div className="absolute inset-y-0 w-px bg-destructive/60" style={{ left: `${pct(parseISO(releaseDate))}%` }} />
          </div>

          {phases.map((p, i) => {
            const s = parseISO(p.start_date)
            const e = addDays(parseISO(p.end_date), 1)
            const left = pct(s)
            const width = Math.max(pct(e) - left, 1.5)
            const color = PHASE_COLORS[i % PHASE_COLORS.length]
            return (
              <div key={p.id} className="group flex h-11 items-center border-b border-border/50 last:border-0">
                <div className="flex w-44 shrink-0 items-center gap-1 pr-3">
                  <span className="truncate text-sm">{p.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`Edit ${p.name}`}
                    onClick={() => setEditing(p)}
                  >
                    <Pencil className="size-3" />
                  </Button>
                </div>
                <div className="relative h-full flex-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setEditing(p)}
                        className="absolute top-1/2 h-5 -translate-y-1/2 overflow-hidden rounded-md text-left ring-offset-2 transition-shadow hover:ring-2 hover:ring-ring/40"
                        style={{ left: `${left}%`, width: `${width}%`, background: `color-mix(in oklch, ${color} 22%, transparent)` }}
                      >
                        <span className="block h-full rounded-md" style={{ width: `${p.progress}%`, background: color }} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {p.name}: {format(s, "MMM d")} - {format(parseISO(p.end_date), "MMM d")} · {p.progress}% done
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 ml-44 flex gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-px bg-primary" /> Today
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-px bg-destructive/60" /> Release {format(parseISO(releaseDate), "MMM d")}
          </span>
          <span>Filled portion = progress</span>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          {editing && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                const ok = await run({
                  id: editing.id,
                  name: String(fd.get("name")),
                  start_date: String(fd.get("start_date")),
                  end_date: String(fd.get("end_date")),
                  progress: Number(fd.get("progress")),
                })
                if (ok !== undefined) setEditing(null)
              }}
            >
              <DialogHeader>
                <DialogTitle>Edit phase</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="ph-name">Name</Label>
                <Input id="ph-name" name="name" defaultValue={editing.name} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ph-start">Start</Label>
                  <Input id="ph-start" name="start_date" type="date" defaultValue={editing.start_date} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ph-end">End</Label>
                  <Input id="ph-end" name="end_date" type="date" defaultValue={editing.end_date} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ph-progress">Progress (%)</Label>
                <Input id="ph-progress" name="progress" type="number" min={0} max={100} defaultValue={editing.progress} required />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />} Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
