"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Braces, Database, FileSpreadsheet, Loader2, Search, Sparkles } from "lucide-react"
import { generateTestData } from "@/app/actions/test-cases"
import { CopyButton } from "@/components/shared/code-viewer"
import { EmptyState, PriorityBadge } from "@/components/shared/ui-bits"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useServerAction } from "@/hooks/use-server-action"
import { downloadText, toCsv } from "@/lib/download"
import { cn } from "@/lib/utils"
import type { TestCaseWithLinks, TestDataRow, TestDataSet } from "@/lib/types"

const KINDS = [
  { key: "valid", label: "Valid", tone: "text-success" },
  { key: "invalid", label: "Invalid", tone: "text-destructive" },
  { key: "boundary", label: "Boundary", tone: "text-amber-700 dark:text-warning" },
] as const

function flatten(set: TestDataSet) {
  return KINDS.flatMap((k) => set[k.key].map((r) => ({ category: k.key, label: r.label, reason: r.reason ?? "", ...r.data })))
}

function renderValue(v: unknown) {
  if (v === null) return <span className="text-muted-foreground italic">null</span>
  if (v === "") return <span className="text-muted-foreground italic">(empty)</span>
  const s = typeof v === "object" ? JSON.stringify(v) : String(v)
  return <span title={s}>{s.length > 60 ? `${s.slice(0, 60)}…(${s.length})` : s}</span>
}

export function TestDataWorkbench({
  projectId,
  projectKey,
  testCases,
}: {
  projectId: string
  projectKey: string
  testCases: TestCaseWithLinks[]
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [query, setQuery] = useState("")
  const [local, setLocal] = useState<Record<string, TestDataSet>>({})
  const selectedId = params.get("tc") ?? testCases[0]?.id ?? null
  const tc = testCases.find((t) => t.id === selectedId) ?? null
  const data = tc ? (local[tc.id] ?? tc.test_data) : null
  const gen = useServerAction((id: string) => generateTestData(projectId, id), {
    loading: "Generating realistic test data…",
    success: "Test data generated",
  })

  const list = useMemo(() => {
    const q = query.toLowerCase()
    return testCases.filter((t) => !q || `${t.code} ${t.title}`.toLowerCase().includes(q))
  }, [testCases, query])

  const withData = testCases.filter((t) => t.test_data || local[t.id])

  if (testCases.length === 0) {
    return <EmptyState icon={Database} title="No test cases yet" description="Generate test cases first, then create data sets for them here." />
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="flex max-h-[calc(100svh-12rem)] flex-col rounded-xl border bg-card shadow-xs">
        <div className="border-b p-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find test case…" className="h-9 pl-8" />
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto p-1.5">
          {list.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => router.replace(`?tc=${t.id}`, { scroll: false })}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  t.id === selectedId ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <span className="mt-0.5 font-mono text-[11px] text-muted-foreground">{t.code}</span>
                <span className="line-clamp-2 flex-1">{t.title}</span>
                {(t.test_data || local[t.id]) && <Database className="mt-0.5 size-3.5 shrink-0 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t p-3 text-xs text-muted-foreground">
          {withData.length}/{testCases.length} with data
          <Button
            variant="outline"
            size="sm"
            disabled={withData.length === 0}
            onClick={() => {
              const all = Object.fromEntries(withData.map((t) => [t.code, local[t.id] ?? t.test_data]))
              downloadText(`${projectKey.toLowerCase()}-test-data.json`, JSON.stringify(all, null, 2), "application/json")
            }}
          >
            <Braces /> Export all
          </Button>
        </div>
      </div>

      <div className="min-w-0 rounded-xl border bg-card shadow-xs">
        {tc && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  {tc.code} <PriorityBadge value={tc.priority} />
                </div>
                <h2 className="mt-1 font-semibold">{tc.title}</h2>
              </div>
              <div className="flex gap-2">
                {data && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadText(`${tc.code}-data.json`, JSON.stringify(data, null, 2), "application/json")}
                    >
                      <Braces /> JSON
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadText(`${tc.code}-data.csv`, toCsv(flatten(data)), "text/csv")}>
                      <FileSpreadsheet /> CSV
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  disabled={gen.pending}
                  onClick={async () => {
                    const res = await gen.run(tc.id)
                    if (res) setLocal((l) => ({ ...l, [tc.id]: res }))
                  }}
                >
                  {gen.pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  {data ? "Regenerate" : "Generate data"}
                </Button>
              </div>
            </div>

            {!data ? (
              <div className="p-5">
                <EmptyState
                  icon={Sparkles}
                  title="No data set yet"
                  description="AI will derive the input fields from the steps and produce valid, invalid and boundary rows."
                  className="border-0 bg-transparent"
                />
              </div>
            ) : (
              <div className="p-5">
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {data.fields.map((f) => (
                    <Badge key={f.name} variant="secondary" className="font-mono font-normal" title={f.description}>
                      {f.name}
                    </Badge>
                  ))}
                </div>
                <Tabs defaultValue="valid">
                  <TabsList>
                    {KINDS.map((k) => (
                      <TabsTrigger key={k.key} value={k.key}>
                        <span className={k.tone}>{k.label}</span>
                        <span className="text-xs text-muted-foreground">{data[k.key].length}</span>
                      </TabsTrigger>
                    ))}
                    <TabsTrigger value="json">Raw JSON</TabsTrigger>
                  </TabsList>
                  {KINDS.map((k) => (
                    <TabsContent key={k.key} value={k.key} className="mt-4">
                      <DataTable rows={data[k.key]} fields={data.fields.map((f) => f.name)} />
                    </TabsContent>
                  ))}
                  <TabsContent value="json" className="mt-4">
                    <div className="relative">
                      <CopyButton text={JSON.stringify(data, null, 2)} className="absolute top-2 right-2 text-zinc-300" />
                      <pre className="max-h-[28rem] overflow-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs text-zinc-100">
                        {JSON.stringify(data, null, 2)}
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function DataTable({ rows, fields }: { rows: TestDataRow[]; fields: string[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-40">Case</TableHead>
            {fields.map((f) => (
              <TableHead key={f} className="font-mono text-xs">
                {f}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="align-top whitespace-normal">
                <div className="text-sm font-medium">{r.label}</div>
                {r.reason && <div className="mt-0.5 text-xs text-muted-foreground">{r.reason}</div>}
              </TableCell>
              {fields.map((f) => (
                <TableCell key={f} className="max-w-56 truncate align-top font-mono text-xs">
                  {renderValue(r.data[f])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
