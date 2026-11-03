"use client"

import { useMemo, useState, useTransition } from "react"
import { Check, Download, Grid3x3, List } from "lucide-react"
import { toast } from "sonner"
import { setTraceLink } from "@/app/actions/test-cases"
import { CriticalityBadge, ExecutionBadge } from "@/components/shared/ui-bits"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { downloadText, toCsv } from "@/lib/download"
import { cn } from "@/lib/utils"
import type { Execution, Requirement, TestCaseWithLinks } from "@/lib/types"

export function RtmMatrix({
  projectId,
  projectKey,
  requirements,
  testCases,
  latest,
}: {
  projectId: string
  projectKey: string
  requirements: Requirement[]
  testCases: TestCaseWithLinks[]
  latest: Record<string, Execution>
}) {
  const [view, setView] = useState<"list" | "grid">("list")
  const [onlyGaps, setOnlyGaps] = useState(false)
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({})
  const [, startTransition] = useTransition()

  const links = useMemo(() => {
    const set = new Set<string>()
    for (const tc of testCases) for (const r of tc.requirement_ids) set.add(`${tc.id}:${r}`)
    return set
  }, [testCases])
  const isLinked = (tcId: string, rId: string) => optimistic[`${tcId}:${rId}`] ?? links.has(`${tcId}:${rId}`)
  const testsFor = (rId: string) => testCases.filter((t) => isLinked(t.id, rId))

  const rows = requirements.filter((r) => !onlyGaps || testsFor(r.id).length === 0)

  function toggle(tcId: string, rId: string) {
    const key = `${tcId}:${rId}`
    const next = !isLinked(tcId, rId)
    setOptimistic((o) => ({ ...o, [key]: next }))
    startTransition(async () => {
      const res = await setTraceLink(projectId, tcId, rId, next)
      if (!res.ok) {
        toast.error(res.error)
        setOptimistic((o) => ({ ...o, [key]: !next }))
      }
    })
  }

  function exportCsv() {
    const data = requirements.map((r) => {
      const tcs = testsFor(r.id)
      return {
        "Requirement ID": r.code,
        Requirement: r.title,
        Type: r.type,
        Criticality: r.criticality,
        "Test Case IDs": tcs.map((t) => t.code).join(", "),
        Covered: tcs.length ? "Yes" : "No",
        Passed: tcs.filter((t) => latest[t.id]?.status === "pass").length,
        Failed: tcs.filter((t) => latest[t.id]?.status === "fail").length,
      }
    })
    downloadText(`${projectKey.toLowerCase()}-rtm.csv`, toCsv(data), "text/csv")
  }

  return (
    <div className="rounded-xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-center gap-3 border-b p-3">
        <div className="flex rounded-md border p-0.5">
          <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" className="h-7" onClick={() => setView("list")}>
            <List /> Mapping
          </Button>
          <Button variant={view === "grid" ? "secondary" : "ghost"} size="sm" className="h-7" onClick={() => setView("grid")}>
            <Grid3x3 /> Matrix
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="gaps" checked={onlyGaps} onCheckedChange={setOnlyGaps} />
          <Label htmlFor="gaps" className="text-sm font-normal">
            Only uncovered
          </Label>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv}>
          <Download /> Export RTM
        </Button>
      </div>

      {view === "list" ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-24 pl-4">Req. ID</TableHead>
              <TableHead>Requirement</TableHead>
              <TableHead className="w-28">Criticality</TableHead>
              <TableHead>Test cases</TableHead>
              <TableHead className="w-28">Coverage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const tcs = testsFor(r.id)
              const covered = tcs.length > 0
              return (
                <TableRow key={r.id} className={cn(!covered && "bg-destructive/[0.06] hover:bg-destructive/10")}>
                  <TableCell className={cn("pl-4 font-mono text-xs", covered ? "text-muted-foreground" : "font-semibold text-destructive")}>
                    {r.code}
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal">{r.title}</TableCell>
                  <TableCell>
                    <CriticalityBadge value={r.criticality} />
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {covered ? (
                      <div className="flex flex-wrap gap-1.5">
                        {tcs.map((t) => (
                          <Tooltip key={t.id}>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1.5 rounded border bg-background px-1.5 py-0.5 font-mono text-[11px]">
                                {t.code}
                                <ExecutionBadge value={latest[t.id]?.status ?? "not_run"} />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">{t.title}</TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-destructive">No test coverage</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {covered ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                        <Check className="size-3.5" /> Covered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">Gap</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  {onlyGaps ? "No gaps. Every requirement has at least one test case." : "No requirements yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      ) : (
        <div className="max-h-[70vh] overflow-auto">
          <table className="border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-20 min-w-56 border-r border-b bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                  Requirement \ Test case
                </th>
                {testCases.map((t) => (
                  <th key={t.id} className="sticky top-0 z-10 h-24 border-b bg-card px-1 align-bottom font-mono font-normal text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-block origin-bottom-left translate-x-3 -rotate-60 whitespace-nowrap">{t.code}</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">{t.title}</TooltipContent>
                    </Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const covered = testsFor(r.id).length > 0
                return (
                  <tr key={r.id}>
                    <td
                      className={cn(
                        "sticky left-0 z-10 max-w-56 truncate border-r border-b bg-card px-3 py-1.5",
                        !covered && "bg-[color-mix(in_oklch,var(--destructive)_8%,var(--card))] text-destructive",
                      )}
                      title={r.title}
                    >
                      <span className="mr-2 font-mono">{r.code}</span>
                      {r.title}
                    </td>
                    {testCases.map((t) => {
                      const linked = isLinked(t.id, r.id)
                      return (
                        <td key={t.id} className="border-b p-0.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggle(t.id, r.id)}
                            aria-label={`${linked ? "Unlink" : "Link"} ${t.code} and ${r.code}`}
                            className={cn(
                              "flex size-6 items-center justify-center rounded transition-colors",
                              linked ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                            )}
                          >
                            {linked && <Check className="size-3" />}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="p-3 text-xs text-muted-foreground">Click a cell to add or remove a trace link.</p>
        </div>
      )}
    </div>
  )
}
