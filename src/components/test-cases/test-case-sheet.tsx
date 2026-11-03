"use client"

import { useState } from "react"
import Link from "next/link"
import { Database, Loader2, Pencil, Plus, X } from "lucide-react"
import { updateTestCase } from "@/app/actions/test-cases"
import { AutomationMeter, PriorityBadge, TestTypeBadge } from "@/components/shared/ui-bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useServerAction } from "@/hooks/use-server-action"
import type { Priority, Requirement, TestCaseWithLinks, TestType } from "@/lib/types"

export function TestCaseSheet({
  projectId,
  testCase,
  requirements,
  onClose,
}: {
  projectId: string
  testCase: TestCaseWithLinks | null
  requirements: Requirement[]
  onClose: () => void
}) {
  const [editing, setEditing] = useState(false)
  return (
    <Sheet
      open={!!testCase}
      onOpenChange={(o) => {
        if (!o) {
          setEditing(false)
          onClose()
        }
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {testCase && (
          <>
            <SheetHeader className="border-b">
              <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                {testCase.code}
                <PriorityBadge value={testCase.priority} />
                <TestTypeBadge value={testCase.type} />
              </div>
              <SheetTitle className="pr-8 text-lg leading-snug">{testCase.title}</SheetTitle>
              <SheetDescription className="sr-only">Test case details</SheetDescription>
            </SheetHeader>
            {editing ? (
              <EditForm key={testCase.id} projectId={projectId} tc={testCase} onDone={() => setEditing(false)} />
            ) : (
              <div className="space-y-6 p-4">
                <section>
                  <h4 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Pre-conditions</h4>
                  <p className="text-sm whitespace-pre-wrap">{testCase.preconditions || "None"}</p>
                </section>
                <section>
                  <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Steps</h4>
                  <ol className="space-y-2">
                    {testCase.steps.map((s, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                          {i + 1}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </section>
                <section className="rounded-lg border border-success/30 bg-success/5 p-3">
                  <h4 className="mb-1 text-xs font-semibold tracking-wide text-success uppercase">Expected result</h4>
                  <p className="text-sm">{testCase.expected_result}</p>
                </section>
                <section>
                  <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Automation feasibility</h4>
                  <AutomationMeter score={testCase.automation_score} />
                  {testCase.automation_rationale && <p className="mt-1.5 text-xs text-muted-foreground">{testCase.automation_rationale}</p>}
                </section>
                <section>
                  <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Traces to</h4>
                  <ul className="space-y-1.5">
                    {testCase.requirement_ids.length === 0 && <li className="text-sm text-destructive">Not linked to any requirement</li>}
                    {testCase.requirement_ids.map((rid) => {
                      const r = requirements.find((x) => x.id === rid)
                      return r ? (
                        <li key={rid} className="flex gap-2 text-sm">
                          <span className="font-mono text-xs text-primary">{r.code}</span>
                          <span className="text-muted-foreground">{r.title}</span>
                        </li>
                      ) : null
                    })}
                  </ul>
                </section>
                <div className="flex gap-2 border-t pt-4">
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Pencil /> Edit
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/projects/${projectId}/test-data?tc=${testCase.id}`}>
                      <Database /> {testCase.test_data ? "View test data" : "Generate test data"}
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function EditForm({ projectId, tc, onDone }: { projectId: string; tc: TestCaseWithLinks; onDone: () => void }) {
  const [steps, setSteps] = useState<string[]>(tc.steps)
  const [priority, setPriority] = useState<Priority>(tc.priority)
  const [type, setType] = useState<TestType>(tc.type)
  const { run, pending } = useServerAction(
    (input: Parameters<typeof updateTestCase>[2]) => updateTestCase(projectId, tc.id, input),
    { success: "Test case updated" },
  )
  return (
    <form
      className="space-y-4 p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const res = await run({
          title: String(fd.get("title")),
          preconditions: String(fd.get("preconditions")),
          expected_result: String(fd.get("expected")),
          automation_score: Number(fd.get("score")),
          steps: steps.map((s) => s.trim()).filter(Boolean),
          priority,
          type,
        })
        if (res !== undefined) onDone()
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="tc-title">Title</Label>
        <Input id="tc-title" name="title" defaultValue={tc.title} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tc-pre">Pre-conditions</Label>
        <Textarea id="tc-pre" name="preconditions" defaultValue={tc.preconditions} rows={2} />
      </div>
      <div className="space-y-2">
        <Label>Steps</Label>
        {steps.map((s, i) => (
          <div key={i} className="flex gap-2">
            <span className="mt-2 w-5 text-right text-xs text-muted-foreground">{i + 1}.</span>
            <Input
              value={s}
              onChange={(e) => setSteps(steps.map((x, j) => (j === i ? e.target.value : x)))}
              aria-label={`Step ${i + 1}`}
            />
            <Button type="button" variant="ghost" size="icon" aria-label="Remove step" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
              <X />
            </Button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => setSteps([...steps, ""])}>
          <Plus /> Add step
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tc-exp">Expected result</Label>
        <Textarea id="tc-exp" name="expected" defaultValue={tc.expected_result} rows={2} required />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["P0", "P1", "P2"] as const).map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as TestType)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["Functional", "Regression", "Security", "Performance"] as const).map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tc-score">Automation %</Label>
          <Input id="tc-score" name="score" type="number" min={0} max={100} defaultValue={tc.automation_score} />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Save
        </Button>
      </div>
    </form>
  )
}
