import type { Metadata } from "next"
import { CircleAlert, CircleCheck, Table2, Target } from "lucide-react"
import { CoverageBars } from "@/components/dashboard/charts"
import { RtmMatrix } from "@/components/rtm/rtm-matrix"
import { Panel } from "@/components/shared/panel"
import { EmptyState, PageHeader, StatCard } from "@/components/shared/ui-bits"
import { Progress } from "@/components/ui/progress"
import { computeCoverage } from "@/lib/metrics"
import { getProjectData } from "@/lib/server/queries"

export const metadata: Metadata = { title: "Traceability" }

export default async function RtmPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const { project, requirements, testCases, latestExecution } = await getProjectData(projectId)
  const cov = computeCoverage(requirements, testCases, latestExecution)

  const modules = [...new Set(requirements.map((r) => r.module || "General"))]
  const byModule = modules
    .map((m) => {
      const rows = cov.rows.filter((r) => (r.requirement.module || "General") === m)
      return { name: m.length > 14 ? `${m.slice(0, 13)}…` : m, covered: rows.filter((r) => r.covered).length, uncovered: rows.filter((r) => !r.covered).length }
    })
    .sort((a, b) => b.covered + b.uncovered - (a.covered + a.uncovered))
    .slice(0, 10)

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow={project.name}
        title="Requirements traceability matrix"
        description="Live mapping of requirement IDs to test case IDs. Uncovered requirements are highlighted in red."
      />
      {requirements.length === 0 ? (
        <EmptyState icon={Table2} title="Nothing to trace yet" description="Add requirements and generate test cases to build the matrix." />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            <div className="grid gap-4">
              <div className="rounded-xl border bg-card p-5 shadow-xs">
                <div className="text-xs font-medium text-muted-foreground">Requirement coverage</div>
                <div className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">{cov.percent}%</div>
                <Progress value={cov.percent} className="mt-3 h-2" />
                <div className="mt-2 text-xs text-muted-foreground">
                  {cov.covered} of {requirements.length} requirements have at least one test
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Covered" value={cov.covered} icon={CircleCheck} tone="success" />
                <StatCard label="Uncovered" value={cov.uncovered} icon={CircleAlert} tone={cov.uncovered ? "danger" : "success"} />
              </div>
              <StatCard label="Avg. tests / requirement" value={(testCases.reduce((s, t) => s + t.requirement_ids.length, 0) / requirements.length).toFixed(1)} icon={Target} />
            </div>
            <Panel title="Coverage by module" description="Covered vs uncovered requirements per feature area">
              <CoverageBars data={byModule} height={260} />
            </Panel>
          </div>
          <RtmMatrix
            projectId={projectId}
            projectKey={project.key}
            requirements={requirements}
            testCases={testCases}
            latest={latestExecution}
          />
        </>
      )}
    </div>
  )
}
