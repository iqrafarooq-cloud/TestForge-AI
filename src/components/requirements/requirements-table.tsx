"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, Loader2, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react"
import { deleteRequirements, upsertRequirement } from "@/app/actions/requirements"
import { generateTestCases } from "@/app/actions/test-cases"
import { ConfirmButton } from "@/components/shared/confirm-button"
import { CriticalityBadge, EmptyState, RequirementTypeBadge } from "@/components/shared/ui-bits"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useServerAction } from "@/hooks/use-server-action"
import type { Criticality, Requirement, RequirementType } from "@/lib/types"

const CRIT_ORDER: Record<Criticality, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export function RequirementsTable({
  projectId,
  requirements,
  testCountByReq,
}: {
  projectId: string
  requirements: Requirement[]
  testCountByReq: Record<string, number>
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [type, setType] = useState<"all" | RequirementType>("all")
  const [crit, setCrit] = useState<"all" | Criticality>("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Requirement | "new" | null>(null)
  const [perReq, setPerReq] = useState("3")

  const del = useServerAction((ids: string[]) => deleteRequirements(projectId, ids), { success: "Requirements deleted" })
  const gen = useServerAction((ids: string[], n: number) => generateTestCases(projectId, ids, n), {
    loading: "Designing test cases with AI…",
    success: (d) => `Generated ${d.created} test cases`,
  })
  const save = useServerAction(
    (id: string | null, input: Parameters<typeof upsertRequirement>[2]) => upsertRequirement(projectId, id, input),
    { success: "Requirement saved" },
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return requirements
      .filter((r) => (type === "all" || r.type === type) && (crit === "all" || r.criticality === crit))
      .filter((r) => !q || `${r.code} ${r.title} ${r.description} ${r.module ?? ""}`.toLowerCase().includes(q))
  }, [requirements, query, type, crit])

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id))
  const selectedIds = [...selected].filter((id) => requirements.some((r) => r.id === id))

  if (requirements.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No requirements yet"
        description="Upload a PRD, import a Jira ticket or paste text above. You can also add requirements manually."
        action={
          <>
            <Button variant="outline" onClick={() => setEditing("new")}>
              <Plus /> Add manually
            </Button>
            <RequirementDialog editing={editing} onClose={() => setEditing(null)} save={save} />
          </>
        }
      />
    )
  }

  return (
    <div className="rounded-xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="relative w-full min-w-48 flex-1 sm:w-auto">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search requirements…" className="h-9 pl-8" />
        </div>
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="functional">Functional</SelectItem>
            <SelectItem value="non_functional">Non-functional</SelectItem>
            <SelectItem value="edge">Edge</SelectItem>
            <SelectItem value="negative">Negative</SelectItem>
          </SelectContent>
        </Select>
        <Select value={crit} onValueChange={(v) => setCrit(v as typeof crit)}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All criticality</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9" onClick={() => setEditing("new")}>
          <Plus /> Add
        </Button>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{selectedIds.length} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <Label htmlFor="perReq" className="text-xs text-muted-foreground">
              Cases / requirement
            </Label>
            <Select value={perReq} onValueChange={setPerReq}>
              <SelectTrigger id="perReq" size="sm" className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["2", "3", "4", "5", "6"].map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={gen.pending}
              onClick={async () => {
                const res = await gen.run(selectedIds, Number(perReq))
                if (res) {
                  setSelected(new Set())
                  router.push(`/projects/${projectId}/test-cases`)
                }
              }}
            >
              {gen.pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Generate test cases
            </Button>
            <ConfirmButton
              variant="ghost"
              size="sm"
              title={`Delete ${selectedIds.length} requirements?`}
              description="Linked traceability entries are removed too. Test cases are kept."
              pending={del.pending}
              onConfirm={async () => {
                if ((await del.run(selectedIds)) !== undefined) setSelected(new Set())
              }}
            >
              <Trash2 /> Delete
            </ConfirmButton>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 pl-4">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => setSelected(v ? new Set(filtered.map((r) => r.id)) : new Set())}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead className="hidden w-24 sm:table-cell">ID</TableHead>
            <TableHead>Requirement</TableHead>
            <TableHead className="hidden w-32 md:table-cell">Type</TableHead>
            <TableHead className="w-28">Criticality</TableHead>
            <TableHead className="hidden w-20 text-right sm:table-cell">Tests</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...filtered]
            .sort((a, b) => CRIT_ORDER[a.criticality] - CRIT_ORDER[b.criticality] || a.code.localeCompare(b.code))
            .map((r) => {
              const tests = testCountByReq[r.id] ?? 0
              return (
                <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                  <TableCell className="pl-4">
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(selected)
                        if (v) next.add(r.id)
                        else next.delete(r.id)
                        setSelected(next)
                      }}
                      aria-label={`Select ${r.code}`}
                    />
                  </TableCell>
                  <TableCell className="hidden align-top font-mono text-xs text-muted-foreground sm:table-cell">{r.code}</TableCell>
                  <TableCell className="max-w-xl whitespace-normal">
                    <div className="font-medium">
                      <span className="mr-1.5 font-mono text-xs font-normal text-muted-foreground sm:hidden">{r.code}</span>
                      {r.title}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.description}</div>
                    {r.criticality_reason && (
                      <div className="mt-1 text-[11px] text-muted-foreground/80 italic">Why {r.criticality}: {r.criticality_reason}</div>
                    )}
                    {r.module && <div className="mt-1 text-[11px] font-medium text-primary/80">{r.module}</div>}
                  </TableCell>
                  <TableCell className="hidden align-top md:table-cell">
                    <RequirementTypeBadge value={r.type} />
                  </TableCell>
                  <TableCell className="align-top">
                    <CriticalityBadge value={r.criticality} />
                  </TableCell>
                  <TableCell className={`hidden text-right align-top font-mono text-xs sm:table-cell ${tests ? "" : "font-semibold text-destructive"}`}>
                    {tests}
                  </TableCell>
                  <TableCell className="align-top">
                    <Button variant="ghost" size="icon" className="size-7" aria-label="Edit" onClick={() => setEditing(r)}>
                      <Pencil className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                No requirements match these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <RequirementDialog editing={editing} onClose={() => setEditing(null)} save={save} />
    </div>
  )
}

type SaveHandle = {
  run: (id: string | null, input: Parameters<typeof upsertRequirement>[2]) => Promise<unknown>
  pending: boolean
}

function RequirementDialog({
  editing,
  onClose,
  save,
}: {
  editing: Requirement | "new" | null
  onClose: () => void
  save: SaveHandle
}) {
  const current = editing && editing !== "new" ? editing : null
  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {editing && <RequirementForm key={current?.id ?? "new"} current={current} onDone={onClose} save={save} />}
      </DialogContent>
    </Dialog>
  )
}

function RequirementForm({ current, onDone, save }: { current: Requirement | null; onDone: () => void; save: SaveHandle }) {
  const [type, setType] = useState<RequirementType>(current?.type ?? "functional")
  const [crit, setCrit] = useState<Criticality>(current?.criticality ?? "medium")
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const res = await save.run(current?.id ?? null, {
          title: String(fd.get("title")),
          description: String(fd.get("description")),
          module: String(fd.get("module") ?? ""),
          type,
          criticality: crit,
        })
        if (res !== undefined) onDone()
      }}
    >
      <DialogHeader>
        <DialogTitle>{current ? `Edit ${current.code}` : "Add requirement"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="rq-title">Title</Label>
        <Input id="rq-title" name="title" defaultValue={current?.title} required minLength={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rq-desc">Description</Label>
        <Textarea id="rq-desc" name="description" rows={4} defaultValue={current?.description} required />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as RequirementType)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="functional">Functional</SelectItem>
              <SelectItem value="non_functional">Non-functional</SelectItem>
              <SelectItem value="edge">Edge</SelectItem>
              <SelectItem value="negative">Negative</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Criticality</Label>
          <Select value={crit} onValueChange={(v) => setCrit(v as Criticality)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rq-module">Module</Label>
          <Input id="rq-module" name="module" defaultValue={current?.module ?? ""} />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={save.pending}>
          {save.pending && <Loader2 className="animate-spin" />} Save
        </Button>
      </DialogFooter>
    </form>
  )
}
