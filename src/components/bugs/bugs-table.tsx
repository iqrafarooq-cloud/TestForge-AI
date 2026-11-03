"use client"

import { useMemo, useState } from "react"
import { formatDistanceToNow, parseISO } from "date-fns"
import { Bug as BugIcon, Download, Loader2, Mail, UserPlus } from "lucide-react"
import { updateBug } from "@/app/actions/execution"
import { handleMailOutcome } from "@/components/execution/bug-dialog"
import { BugStatusBadge, EmptyState, SeverityBadge } from "@/components/shared/ui-bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useServerAction } from "@/hooks/use-server-action"
import { downloadText, toCsv } from "@/lib/download"
import type { Bug, BugStatus } from "@/lib/types"

export function BugsTable({
  projectId,
  projectKey,
  bugs,
  tcCode,
}: {
  projectId: string
  projectKey: string
  bugs: Bug[]
  tcCode: Record<string, string>
}) {
  const [status, setStatus] = useState<"all" | "active" | BugStatus>("active")
  const [openId, setOpenId] = useState<string | null>(null)
  const update = useServerAction(
    (id: string, patch: Parameters<typeof updateBug>[2]) => updateBug(projectId, id, patch),
    { success: "Defect updated" },
  )

  const filtered = useMemo(
    () =>
      bugs.filter((b) =>
        status === "all" ? true : status === "active" ? b.status === "open" || b.status === "in_progress" : b.status === status,
      ),
    [bugs, status],
  )
  const open = bugs.find((b) => b.id === openId) ?? null

  if (bugs.length === 0) {
    return <EmptyState icon={BugIcon} title="No defects logged" description="When a test fails on the execution board, a pre-filled bug report lands here." />
  }

  return (
    <div className="rounded-xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="all">All defects</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-9"
          onClick={() =>
            downloadText(
              `${projectKey.toLowerCase()}-defects.csv`,
              toCsv(
                bugs.map((b) => ({
                  ID: b.code,
                  Title: b.title,
                  Severity: b.severity,
                  Status: b.status,
                  "Test case": b.test_case_id ? tcCode[b.test_case_id] : "",
                  Assignee: b.assignee_email ?? "",
                  Environment: b.environment,
                  Steps: b.steps_to_reproduce.map((s, i) => `${i + 1}. ${s}`).join("\n"),
                  Expected: b.expected_result,
                  Actual: b.actual_result,
                  Created: b.created_at,
                })),
              ),
              "text/csv",
            )
          }
        >
          <Download /> Export
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-24 pl-4">ID</TableHead>
            <TableHead>Defect</TableHead>
            <TableHead className="w-28">Severity</TableHead>
            <TableHead className="w-40">Status</TableHead>
            <TableHead className="w-56">Assignee</TableHead>
            <TableHead className="w-28">Reported</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((b) => (
            <TableRow key={b.id} className="cursor-pointer" onClick={() => setOpenId(b.id)}>
              <TableCell className="pl-4 font-mono text-xs text-muted-foreground">{b.code}</TableCell>
              <TableCell className="max-w-md whitespace-normal">
                <div className="font-medium">{b.title}</div>
                {b.test_case_id && tcCode[b.test_case_id] && (
                  <div className="font-mono text-[11px] text-muted-foreground">from {tcCode[b.test_case_id]}</div>
                )}
              </TableCell>
              <TableCell>
                <SeverityBadge value={b.severity} />
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Select value={b.status} onValueChange={(v) => update.run(b.id, { status: v as BugStatus })}>
                  <SelectTrigger size="sm" className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <AssignPopover
                  current={b.assignee_email}
                  pending={update.pending}
                  onAssign={async (email) => {
                    const res = await update.run(b.id, { assignee_email: email })
                    if (res) handleMailOutcome(res.mail, email)
                  }}
                />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(b.created_at), { addSuffix: true })}</TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                No defects with this status.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {open && (
            <>
              <SheetHeader className="border-b">
                <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  {open.code} <SeverityBadge value={open.severity} /> <BugStatusBadge value={open.status} />
                </div>
                <SheetTitle className="pr-8 text-lg leading-snug">{open.title}</SheetTitle>
                <SheetDescription>{open.environment || "No environment recorded"}</SheetDescription>
              </SheetHeader>
              <div className="space-y-5 p-4 text-sm">
                <section>
                  <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Steps to reproduce</h4>
                  <ol className="list-decimal space-y-1.5 pl-5">
                    {open.steps_to_reproduce.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </section>
                <div className="grid gap-3 sm:grid-cols-2">
                  <section className="rounded-lg border border-success/30 bg-success/5 p-3">
                    <h4 className="mb-1 text-xs font-semibold text-success uppercase">Expected</h4>
                    <p>{open.expected_result}</p>
                  </section>
                  <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <h4 className="mb-1 text-xs font-semibold text-destructive uppercase">Actual</h4>
                    <p>{open.actual_result}</p>
                  </section>
                </div>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="size-4" /> {open.assignee_email ?? "Unassigned"}
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function AssignPopover({
  current,
  onAssign,
  pending,
}: {
  current: string | null
  onAssign: (email: string) => Promise<void>
  pending: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="max-w-52 justify-start truncate font-normal">
          {current ? (
            <>
              <Mail className="text-muted-foreground" /> <span className="truncate">{current}</span>
            </>
          ) : (
            <>
              <UserPlus className="text-muted-foreground" /> <span className="text-muted-foreground">Assign</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            const email = String(new FormData(e.currentTarget).get("email") ?? "").trim()
            if (!email) return
            await onAssign(email)
            setOpen(false)
          }}
        >
          <div className="text-sm font-medium">Assign to developer</div>
          <Input name="email" type="email" required placeholder="dev@company.com" defaultValue={current ?? ""} autoFocus />
          <Button type="submit" size="sm" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Mail />} Assign & email
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
