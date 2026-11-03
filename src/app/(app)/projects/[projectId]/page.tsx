import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ArrowRight, Bug, CheckCircle2, FileText, FlaskConical, Gauge, Target } from "lucide-react"
import { CoverageBars, SimpleBars, StatusDonut } from "@/components/dashboard/charts"
import { Gantt } from "@/components/dashboard/gantt"
import { DeleteProjectButton } from "@/components/projects/delete-project-button"
import { Panel } from "@/components/shared/panel"
import { CriticalityBadge, PageHeader, StatCard } from "@/components/shared/ui-bits"
import { Button } from "@/components/ui/button"
import { bugDensity, computeCoverage, executionSummary } from "@/lib/metrics"
import { getProjectData } from "@/lib/server/queries"

export default async function ProjectOverview({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const data = await getProjectData(projectId)
  const { project, requirements, testCases, latestExecution, bugs, phases } = data
  const coverage = computeCoverage(requirements, testCases, latestExecution)
  const exec = executionSummary(testCases, latestExecution)
  const density = bugDensity(bugs, testCases.length)
  const openBugs = bugs.filter((b) => b.status === "open" || b.status === "in_progress")

  const types = ["functional", "non_functional", "edge", "negative"] as const
  const typeLabels = { functional: "Functional", non_functional: "Non-func.", edge: "Edge", negative: "Negative" }
  const coverageByType = types.map((t) => {
    const rows = coverage.rows.filter((r) => r.requirement.type === t)
    return { name: typeLabels[t], covered: rows.filter((r) => r.covered).length, uncovered: rows.filter((r) => !r.covered).length }
  })

  const severities = [
    { key: "critical", label: "Critical", color: "var(--chart-4)" },
    { key: "major", label: "Major", color: "var(--chart-3)" },
    { key: "minor", label: "Minor", color: "var(--chart-5)" },
    { key: "trivial", label: "Trivial", color: "var(--muted-foreground)" },
  ] as const
  const bugsBySeverity = severities.map((s) => ({
    name: s.label,
    value: bugs.filter((b) => b.severity === s.key).length,
    color: s.color,
  }))

  const uncoveredCritical = coverage.rows.filter(
    (r) => !r.covered && (r.requirement.criticality === "critical" || r.requirement.criticality === "high"),
  )

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow={`${project.key} · ${format(parseISO(project.start_date), "MMM d")} - ${format(parseISO(project.end_date), "MMM d, yyyy")}`}
        title={project.name}
        description={project.description || "QA command center for this project."}
        actions={
          <>
            <DeleteProjectButton projectId={project.id} name={project.name} />
            <Button asChild>
              <Link href={`/projects/${project.id}/requirements`}>
                Ingest requirements <ArrowRight />
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Requirements" value={requirements.length} icon={FileText} hint={`${requirements.filter((r) => r.criticality === "critical").length} critical`} />
        <StatCard label="Test cases" value={testCases.length} icon={FlaskConical} hint={`${testCases.filter((t) => t.automation_score >= 75).length} automation-ready`} />
        <StatCard
          label="Coverage"
          value={`${coverage.percent}%`}
          icon={Target}
          tone={coverage.percent >= 90 ? "success" : coverage.percent >= 60 ? "warning" : "danger"}
          hint={`${coverage.uncovered} uncovered`}
        />
        <StatCard
          label="Pass rate"
          value={`${exec.passRate}%`}
          icon={CheckCircle2}
          tone={exec.passRate >= 90 ? "success" : exec.executed ? "warning" : "default"}
          hint={`${exec.executed}/${testCases.length} executed`}
        />
        <StatCard
          label="Bug density"
          value={density}
          icon={Gauge}
          tone={density > 3 ? "danger" : density > 1 ? "warning" : "success"}
          hint={`per 10 tests · ${openBugs.length} open`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Execution status" description="Latest result per test case">
          <StatusDonut
            centerValue={`${exec.executedPercent}%`}
            centerLabel="executed"
            data={[
              { key: "pass", label: "Pass", value: exec.counts.pass, color: "var(--success)" },
              { key: "fail", label: "Fail", value: exec.counts.fail, color: "var(--destructive)" },
              { key: "blocked", label: "Blocked", value: exec.counts.blocked, color: "var(--warning)" },
              { key: "skip", label: "Skipped", value: exec.counts.skip, color: "var(--info)" },
              { key: "not_run", label: "Not run", value: exec.counts.not_run, color: "color-mix(in oklch, var(--muted-foreground) 35%, transparent)" },
            ]}
          />
        </Panel>
        <Panel title="Coverage by requirement type" description="Requirements with at least one linked test">
          <CoverageBars data={coverageByType} height={190} />
        </Panel>
        <Panel title="Defects by severity" description={`${bugs.length} total · ${openBugs.length} open`}>
          <SimpleBars data={bugsBySeverity} name="Defects" height={214} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Testing timeline" description="Click a bar to adjust dates or progress" className="lg:col-span-2">
          <Gantt projectId={project.id} phases={phases} releaseDate={project.end_date} />
        </Panel>
        <Panel
          title="Risk radar"
          description="Critical & high requirements without tests"
          bodyClassName="p-0"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/projects/${project.id}/rtm`}>RTM</Link>
            </Button>
          }
        >
          {uncoveredCritical.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="size-6 text-success" />
              {requirements.length ? "Every critical and high requirement is covered." : "No requirements yet."}
            </div>
          ) : (
            <ul className="max-h-72 divide-y overflow-auto">
              {uncoveredCritical.slice(0, 12).map((r) => (
                <li key={r.requirement.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="font-mono text-xs text-destructive">{r.requirement.code}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{r.requirement.title}</span>
                  <CriticalityBadge value={r.requirement.criticality} />
                </li>
              ))}
            </ul>
          )}
          {openBugs.length > 0 && (
            <div className="flex items-center gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
              <Bug className="size-3.5 text-destructive" /> {openBugs.length} open defects
              <Link href={`/projects/${project.id}/bugs`} className="ml-auto font-medium text-foreground hover:underline">
                View
              </Link>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
