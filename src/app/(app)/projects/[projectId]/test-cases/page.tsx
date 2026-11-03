import type { Metadata } from "next"
import { Bot, FlaskConical, ShieldCheck, Zap } from "lucide-react"
import { PageHeader, StatCard } from "@/components/shared/ui-bits"
import { TestCasesTable } from "@/components/test-cases/test-cases-table"
import { getProjectData } from "@/lib/server/queries"

export const metadata: Metadata = { title: "Test Cases" }

export default async function TestCasesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const { project, testCases, requirements, latestExecution } = await getProjectData(projectId)
  const avgAuto = testCases.length ? Math.round(testCases.reduce((s, t) => s + t.automation_score, 0) / testCases.length) : 0

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow={project.name}
        title="Test cases"
        description="AI-designed, traceable test cases. Select rows to export Playwright, Cypress or Selenium code."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total" value={testCases.length} icon={FlaskConical} />
        <StatCard label="P0 critical path" value={testCases.filter((t) => t.priority === "P0").length} icon={Zap} tone="danger" />
        <StatCard label="Security & perf." value={testCases.filter((t) => t.type === "Security" || t.type === "Performance").length} icon={ShieldCheck} />
        <StatCard label="Avg. automation feasibility" value={`${avgAuto}%`} icon={Bot} tone={avgAuto >= 70 ? "success" : "warning"} />
      </div>
      <TestCasesTable
        projectId={projectId}
        projectKey={project.key}
        testCases={testCases}
        requirements={requirements}
        latest={latestExecution}
      />
    </div>
  )
}
