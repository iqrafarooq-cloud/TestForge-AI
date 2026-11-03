import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { BugSeverity, BugStatus, Criticality, ExecutionStatus, Priority, RequirementType, TestType } from "@/lib/types"

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  eyebrow?: string
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        {eyebrow && <div className="text-xs font-medium tracking-wider text-primary uppercase">{eyebrow}</div>}
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-8 ring-primary/5">
        <Icon className="size-5" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon: LucideIcon
  tone?: "default" | "success" | "warning" | "danger"
}) {
  const toneClass = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/12 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-destructive/12 text-destructive",
  }[tone]
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex size-7 items-center justify-center rounded-md", toneClass)}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

const pill = "border font-medium capitalize"

export function CriticalityBadge({ value }: { value: Criticality }) {
  const cls = {
    critical: "border-destructive/30 bg-destructive/10 text-destructive",
    high: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    medium: "border-warning/40 bg-warning/10 text-amber-700 dark:text-warning",
    low: "border-border bg-muted text-muted-foreground",
  }[value]
  return <Badge className={cn(pill, cls)}>{value}</Badge>
}

export function RequirementTypeBadge({ value }: { value: RequirementType }) {
  const label = { functional: "Functional", non_functional: "Non-functional", edge: "Edge", negative: "Negative" }[value]
  const cls = {
    functional: "border-primary/25 bg-primary/8 text-primary",
    non_functional: "border-info/30 bg-info/10 text-info",
    edge: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
    negative: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  }[value]
  return <Badge className={cn(pill, cls)}>{label}</Badge>
}

export function PriorityBadge({ value }: { value: Priority }) {
  const cls = {
    P0: "border-destructive/30 bg-destructive/10 text-destructive",
    P1: "border-warning/40 bg-warning/10 text-amber-700 dark:text-warning",
    P2: "border-border bg-muted text-muted-foreground",
  }[value]
  return <Badge className={cn("border font-mono font-semibold", cls)}>{value}</Badge>
}

export function TestTypeBadge({ value }: { value: TestType }) {
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      {value}
    </Badge>
  )
}

export const STATUS_META: Record<ExecutionStatus, { label: string; dot: string; text: string; ring: string }> = {
  not_run: { label: "Not run", dot: "bg-muted-foreground/50", text: "text-muted-foreground", ring: "border-border" },
  pass: { label: "Pass", dot: "bg-success", text: "text-success", ring: "border-success/40" },
  fail: { label: "Fail", dot: "bg-destructive", text: "text-destructive", ring: "border-destructive/40" },
  blocked: { label: "Blocked", dot: "bg-warning", text: "text-amber-700 dark:text-warning", ring: "border-warning/50" },
  skip: { label: "Skipped", dot: "bg-info", text: "text-info", ring: "border-info/40" },
}

export function ExecutionBadge({ value }: { value: ExecutionStatus }) {
  const m = STATUS_META[value]
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", m.text)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  )
}

export function SeverityBadge({ value }: { value: BugSeverity }) {
  const cls = {
    critical: "border-destructive/30 bg-destructive/10 text-destructive",
    major: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    minor: "border-warning/40 bg-warning/10 text-amber-700 dark:text-warning",
    trivial: "border-border bg-muted text-muted-foreground",
  }[value]
  return <Badge className={cn(pill, cls)}>{value}</Badge>
}

export function BugStatusBadge({ value }: { value: BugStatus }) {
  const label = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" }[value]
  const cls = {
    open: "border-destructive/30 text-destructive",
    in_progress: "border-info/40 text-info",
    resolved: "border-success/40 text-success",
    closed: "border-border text-muted-foreground",
  }[value]
  return (
    <Badge variant="outline" className={cn("font-medium", cls)}>
      {label}
    </Badge>
  )
}

export function AutomationMeter({ score }: { score: number }) {
  const color = score >= 75 ? "bg-success" : score >= 45 ? "bg-warning" : "bg-destructive"
  return (
    <div className="flex items-center gap-2" title={`Automation feasibility ${score}%`}>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="w-8 text-xs text-muted-foreground tabular-nums">{score}%</span>
    </div>
  )
}
