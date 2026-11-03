"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Database, Download, FlaskConical, Search, Trash2 } from "lucide-react"
import { deleteTestCases } from "@/app/actions/test-cases"
import { ConfirmButton } from "@/components/shared/confirm-button"
import { AutomationMeter, EmptyState, ExecutionBadge, PriorityBadge, TestTypeBadge } from "@/components/shared/ui-bits"
import { ExportAutomationDialog } from "@/components/test-cases/export-automation-dialog"
import { TestCaseSheet } from "@/components/test-cases/test-case-sheet"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useServerAction } from "@/hooks/use-server-action"
import { downloadText, toCsv } from "@/lib/download"
import { useSelection } from "@/lib/store"
import type { Execution, Priority, Requirement, TestCaseWithLinks, TestType } from "@/lib/types"

const EMPTY: string[] = []

export function TestCasesTable({
  projectId,
  projectKey,
  testCases,
  requirements,
  latest,
}: {
  projectId: string
  projectKey: string
  testCases: TestCaseWithLinks[]
  requirements: Requirement[]
  latest: Record<string, Execution>
}) {
  const [query, setQuery] = useState("")
  const [priority, setPriority] = useState<"all" | Priority>("all")
  const [type, setType] = useState<"all" | TestType>("all")
  const [openId, setOpenId] = useState<string | null>(null)
  const selectedRaw = useSelection((s) => s.selected[projectId] ?? EMPTY)
  const { toggle, setMany, clear } = useSelection()
  const del = useServerAction((ids: string[]) => deleteTestCases(projectId, ids), { success: "Test cases deleted" })

  const reqCode = useMemo(() => new Map(requirements.map((r) => [r.id, r.code])), [requirements])
  const selected = selectedRaw.filter((id) => testCases.some((t) => t.id === id))
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return testCases.filter(
      (t) =>
        (priority === "all" || t.priority === priority) &&
        (type === "all" || t.type === type) &&
        (!q || `${t.code} ${t.title} ${t.expected_result}`.toLowerCase().includes(q)),
    )
  }, [testCases, query, priority, type])
  const allSelected = filtered.length > 0 && filtered.every((t) => selected.includes(t.id))

  function exportCsv() {
    const rows = (selected.length ? testCases.filter((t) => selected.includes(t.id)) : testCases).map((t) => ({
      "TestCase ID": t.code,
      Title: t.title,
      "Pre-conditions": t.preconditions,
      Steps: t.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
      "Expected Result": t.expected_result,
      Priority: t.priority,
      Type: t.type,
      "Automation Feasibility": t.automation_score,
      Requirements: t.requirement_ids.map((id) => reqCode.get(id)).join(", "),
    }))
    downloadText(`${projectKey.toLowerCase()}-test-cases.csv`, toCsv(rows), "text/csv")
  }

  if (testCases.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No test cases yet"
        description="Select requirements on the Requirements page and click Generate test cases."
        action={
          <Button asChild>
            <Link href={`/projects/${projectId}/requirements`}>Go to requirements</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="rounded-xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="relative w-full min-w-48 flex-1 sm:w-auto">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search test cases…" className="h-9 pl-8" />
        </div>
        <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="P0">P0</SelectItem>
            <SelectItem value="P1">P1</SelectItem>
            <SelectItem value="P2">P2</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(["Functional", "Regression", "Security", "Performance"] as const).map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" className="h-9" onClick={exportCsv}>
          <Download /> CSV
        </Button>
        <ExportAutomationDialog projectId={projectId} projectKey={projectKey} testCaseIds={selected} />
      </div>

      {selected.length > 0 && (
        <div className="flex items-center gap-2 border-b bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{selected.length} selected</span>
          <Button variant="link" size="sm" className="h-auto px-1" onClick={() => clear(projectId)}>
            Clear
          </Button>
          <ConfirmButton
            className="ml-auto"
            variant="ghost"
            size="sm"
            title={`Delete ${selected.length} test cases?`}
            description="Execution history and traceability links for these cases are removed."
            pending={del.pending}
            onConfirm={async () => {
              if ((await del.run(selected)) !== undefined) clear(projectId)
            }}
          >
            <Trash2 /> Delete
          </ConfirmButton>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 pl-4">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => (v ? setMany(projectId, filtered.map((t) => t.id)) : clear(projectId))}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead className="w-20">ID</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-16">Priority</TableHead>
            <TableHead className="hidden w-28 lg:table-cell">Type</TableHead>
            <TableHead className="hidden w-28 md:table-cell">Automation</TableHead>
            <TableHead className="hidden w-32 lg:table-cell">Requirements</TableHead>
            <TableHead className="w-24">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((t) => (
            <TableRow
              key={t.id}
              className="cursor-pointer"
              data-state={selected.includes(t.id) ? "selected" : undefined}
              onClick={() => setOpenId(t.id)}
            >
              <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={selected.includes(t.id)} onCheckedChange={() => toggle(projectId, t.id)} aria-label={`Select ${t.code}`} />
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{t.code}</TableCell>
              <TableCell className="max-w-md whitespace-normal">
                <div className="flex items-center gap-1.5 font-medium">
                  {t.title}
                  {t.test_data && <Database className="size-3 shrink-0 text-primary" aria-label="Has test data" />}
                </div>
                <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{t.steps.length} steps · {t.expected_result}</div>
              </TableCell>
              <TableCell>
                <PriorityBadge value={t.priority} />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <TestTypeBadge value={t.type} />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <AutomationMeter score={t.automation_score} />
              </TableCell>
              <TableCell className="hidden font-mono text-[11px] whitespace-normal text-muted-foreground lg:table-cell">
                {t.requirement_ids.length ? (
                  t.requirement_ids.map((id) => reqCode.get(id)).join(", ")
                ) : (
                  <span className="text-destructive">unlinked</span>
                )}
              </TableCell>
              <TableCell>
                <ExecutionBadge value={latest[t.id]?.status ?? "not_run"} />
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                No test cases match these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <TestCaseSheet
        projectId={projectId}
        testCase={testCases.find((t) => t.id === openId) ?? null}
        requirements={requirements}
        onClose={() => setOpenId(null)}
      />
    </div>
  )
}
