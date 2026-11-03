"use client"

import { useState } from "react"
import { Bug as BugIcon, Loader2, Mail, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { createBug, type MailOutcome } from "@/app/actions/execution"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useServerAction } from "@/hooks/use-server-action"
import type { BugSeverity, Priority, TestCaseWithLinks } from "@/lib/types"

const SEVERITY_FROM_PRIORITY: Record<Priority, BugSeverity> = { P0: "critical", P1: "major", P2: "minor" }

export function handleMailOutcome(mail: MailOutcome | null, email?: string | null) {
  if (!mail) return
  if (mail.sent) toast.success(`Assignment emailed to ${email}`)
  else if (mail.mailto) window.location.href = mail.mailto
  else if (mail.error) toast.warning(`Bug saved, but email failed: ${mail.error}`)
}

export interface BugDraftContext {
  testCase: TestCaseWithLinks
  executionId: string | null
  environment: string
  notes?: string
}

export function BugDialog({
  projectId,
  context,
  onClose,
}: {
  projectId: string
  context: BugDraftContext | null
  onClose: () => void
}) {
  return (
    <Dialog open={!!context} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {context && <BugForm key={context.testCase.id + (context.executionId ?? "")} projectId={projectId} ctx={context} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function BugForm({ projectId, ctx, onDone }: { projectId: string; ctx: BugDraftContext; onDone: () => void }) {
  const tc = ctx.testCase
  const [steps, setSteps] = useState<string[]>([...(tc.preconditions ? [`Pre-condition: ${tc.preconditions}`] : []), ...tc.steps])
  const [severity, setSeverity] = useState<BugSeverity>(SEVERITY_FROM_PRIORITY[tc.priority])
  const { run, pending } = useServerAction(
    (input: Parameters<typeof createBug>[1]) => createBug(projectId, input),
    { success: (d) => `${d.bug.code} logged` },
  )

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const res = await run({
          test_case_id: tc.id,
          execution_id: ctx.executionId,
          title: String(fd.get("title")),
          steps_to_reproduce: steps.map((s) => s.trim()).filter(Boolean),
          expected_result: String(fd.get("expected")),
          actual_result: String(fd.get("actual")),
          severity,
          environment: String(fd.get("environment")),
          assignee_email: String(fd.get("assignee") ?? ""),
        })
        if (res) {
          handleMailOutcome(res.mail, res.bug.assignee_email)
          onDone()
        }
      }}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <BugIcon className="size-4" />
          </span>
          Report defect
        </DialogTitle>
        <DialogDescription>Auto-filled from {tc.code}. Describe what actually happened, then assign it.</DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="bug-title">Title</Label>
        <Input id="bug-title" name="title" required defaultValue={`${tc.code} failed: ${tc.title}`} />
      </div>

      <div className="space-y-2">
        <Label>Steps to reproduce</Label>
        <div className="space-y-1.5">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 text-right text-xs text-muted-foreground">{i + 1}.</span>
              <Input value={s} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Step ${i + 1}`} />
              <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Remove step" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
                <X />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setSteps([...steps, ""])}>
          <Plus /> Add step
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bug-expected">Expected</Label>
          <Textarea id="bug-expected" name="expected" rows={3} required defaultValue={tc.expected_result} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bug-actual">Actual</Label>
          <Textarea
            id="bug-actual"
            name="actual"
            rows={3}
            required
            autoFocus
            defaultValue={ctx.notes ?? ""}
            placeholder="What happened instead? Error messages, screenshots links…"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Severity</Label>
          <Select value={severity} onValueChange={(v) => setSeverity(v as BugSeverity)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="major">Major</SelectItem>
              <SelectItem value="minor">Minor</SelectItem>
              <SelectItem value="trivial">Trivial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="bug-env">Environment</Label>
          <Input id="bug-env" name="environment" defaultValue={ctx.environment} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bug-assignee" className="flex items-center gap-1.5">
          <Mail className="size-3.5" /> Assign to developer (email)
        </Label>
        <Input id="bug-assignee" name="assignee" type="email" placeholder="dev@company.com" />
        <p className="text-xs text-muted-foreground">The developer receives the full bug report by email.</p>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Skip
        </Button>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Log defect
        </Button>
      </DialogFooter>
    </form>
  )
}
