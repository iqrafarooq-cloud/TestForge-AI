import type { Metadata } from "next"
import { AlertOctagon, Bug, CheckCircle2, Gauge } from "lucide-react"
import { BugsTable } from "@/components/bugs/bugs-table"
import { PageHeader, StatCard } from "@/components/shared/ui-bits"
import { bugDensity } from "@/lib/metrics"
import { getProjectData } from "@/lib/server/queries"

export const metadata: Metadata = { title: "Defects" }

export default async function BugsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const { project, bugs, testCases } = await getProjectData(projectId)
  const tcCode = Object.fromEntries(testCases.map((t) => [t.id, t.code]))
  const active = bugs.filter((b) => b.status === "open" || b.status === "in_progress")

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader eyebrow={project.name} title="Defect hub" description="Track, triage and assign defects raised during execution." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active defects" value={active.length} icon={Bug} tone={active.length ? "danger" : "success"} />
        <StatCard label="Critical open" value={active.filter((b) => b.severity === "critical").length} icon={AlertOctagon} tone="danger" />
        <StatCard label="Resolved / closed" value={bugs.length - active.length} icon={CheckCircle2} tone="success" />
        <StatCard label="Bug density" value={bugDensity(bugs, testCases.length)} hint="per 10 test cases" icon={Gauge} />
      </div>
      <BugsTable projectId={projectId} projectKey={project.key} bugs={bugs} tcCode={tcCode} />
    </div>
  )
}
