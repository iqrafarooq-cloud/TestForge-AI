"use client"

import { useMemo, useState, useTransition } from "react"
import { Bug, GripVertical, MoreHorizontal, PlayCircle, Search, Server } from "lucide-react"
import { toast } from "sonner"
import { recordExecution } from "@/app/actions/execution"
import { BugDialog, type BugDraftContext } from "@/components/execution/bug-dialog"
import { EmptyState, PriorityBadge, STATUS_META } from "@/components/shared/ui-bits"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { EXECUTION_STATUSES } from "@/lib/metrics"
import { usePrefs } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { Execution, ExecutionStatus, TestCaseWithLinks } from "@/lib/types"

export function KanbanBoard({
  projectId,
  testCases,
  latest: initialLatest,
  bugCountByTc,
}: {
  projectId: string
  testCases: TestCaseWithLinks[]
  latest: Record<string, Execution>
  bugCountByTc: Record<string, number>
}) {
  const { environment, setEnvironment } = usePrefs()
  const [status, setStatus] = useState<Record<string, ExecutionStatus>>(() =>
    Object.fromEntries(testCases.map((t) => [t.id, initialLatest[t.id]?.status ?? "not_run"])),
  )
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<ExecutionStatus | null>(null)
  const [query, setQuery] = useState("")
  const [bugCtx, setBugCtx] = useState<BugDraftContext | null>(null)
  const [, startTransition] = useTransition()

  const visible = useMemo(() => {
    const q = query.toLowerCase()
    return testCases.filter((t) => !q || `${t.code} ${t.title}`.toLowerCase().includes(q))
  }, [testCases, query])

  function move(tc: TestCaseWithLinks, to: ExecutionStatus) {
    const from = status[tc.id] ?? "not_run"
    if (from === to) return
    setStatus((s) => ({ ...s, [tc.id]: to }))
    startTransition(async () => {
      const res = await recordExecution(projectId, tc.id, to, environment)
      if (!res.ok) {
        toast.error(res.error)
        setStatus((s) => ({ ...s, [tc.id]: from }))
        return
      }
      if (to === "fail") setBugCtx({ testCase: tc, executionId: res.data.id, environment })
    })
  }

  if (testCases.length === 0) {
    return <EmptyState icon={PlayCircle} title="Nothing to execute" description="Generate test cases first; they appear here as cards ready for a test run." />
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter cards…" className="h-9 pl-8" />
        </div>
        <div className="relative min-w-64 flex-1 sm:max-w-sm">
          <Server className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            className="h-9 pl-8"
            aria-label="Test environment"
            placeholder="Environment, e.g. Staging · Chrome 130"
          />
        </div>
        <p className="text-xs text-muted-foreground">Drag cards between columns or use the ⋯ menu. Moving to Fail opens a pre-filled bug report.</p>
      </div>

      <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 lg:grid lg:grid-cols-5 lg:overflow-visible">
        {EXECUTION_STATUSES.map((col) => {
          const meta = STATUS_META[col]
          const cards = visible.filter((t) => (status[t.id] ?? "not_run") === col)
          return (
            <div
              key={col}
              onDragOver={(e) => {
                e.preventDefault()
                setOverCol(col)
              }}
              onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
              onDrop={(e) => {
                e.preventDefault()
                setOverCol(null)
                const tc = testCases.find((t) => t.id === dragId)
                if (tc) move(tc, col)
                setDragId(null)
              }}
              className={cn(
                "flex min-h-[60vh] w-64 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors lg:w-auto lg:min-w-0",
                overCol === col && "border-primary/60 bg-primary/5",
              )}
            >
              <div className="flex items-center gap-2 border-b px-3 py-2.5">
                <span className={cn("size-2 rounded-full", meta.dot)} />
                <span className="text-sm font-semibold">{meta.label}</span>
                <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {cards.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {cards.map((tc) => (
                  <article
                    key={tc.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(tc.id)
                      e.dataTransfer.effectAllowed = "move"
                    }}
                    onDragEnd={() => setDragId(null)}
                    className={cn(
                      "group cursor-grab rounded-lg border-l-[3px] border bg-card p-2.5 shadow-xs transition-all hover:shadow-md active:cursor-grabbing",
                      meta.ring,
                      col === "pass" && "border-l-success",
                      col === "fail" && "border-l-destructive",
                      col === "blocked" && "border-l-warning",
                      col === "skip" && "border-l-info",
                      col === "not_run" && "border-l-muted-foreground/30",
                      dragId === tc.id && "opacity-40",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <GripVertical className="size-3.5 text-muted-foreground/50" />
                      <span className="font-mono text-[11px] text-muted-foreground">{tc.code}</span>
                      <PriorityBadge value={tc.priority} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="ml-auto size-6" aria-label={`Change status of ${tc.code}`}>
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel className="text-xs">Mark as</DropdownMenuLabel>
                          {EXECUTION_STATUSES.filter((s) => s !== col).map((s) => (
                            <DropdownMenuItem key={s} onSelect={() => move(tc, s)}>
                              <span className={cn("size-2 rounded-full", STATUS_META[s].dot)} /> {STATUS_META[s].label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setBugCtx({ testCase: tc, executionId: initialLatest[tc.id]?.id ?? null, environment })}>
                            <Bug /> Report bug
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug">{tc.title}</p>
                    {(bugCountByTc[tc.id] ?? 0) > 0 && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                        <Bug className="size-3" /> {bugCountByTc[tc.id]}
                      </div>
                    )}
                  </article>
                ))}
                {cards.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <BugDialog projectId={projectId} context={bugCtx} onClose={() => setBugCtx(null)} />
    </>
  )
}
