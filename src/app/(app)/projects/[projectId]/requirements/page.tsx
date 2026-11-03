import type { Metadata } from "next"
import { IngestPanel } from "@/components/requirements/ingest-panel"
import { RequirementsTable } from "@/components/requirements/requirements-table"
import { Panel } from "@/components/shared/panel"
import { PageHeader } from "@/components/shared/ui-bits"
import { getProjectData } from "@/lib/server/queries"
import type { Criticality, RequirementType } from "@/lib/types"

export const metadata: Metadata = { title: "Requirements" }

const CRIT: { key: Criticality; label: string; color: string }[] = [
  { key: "critical", label: "Critical", color: "var(--destructive)" },
  { key: "high", label: "High", color: "oklch(0.68 0.18 45)" },
  { key: "medium", label: "Medium", color: "var(--warning)" },
  { key: "low", label: "Low", color: "color-mix(in oklch, var(--muted-foreground) 45%, transparent)" },
]
const TYPES: { key: RequirementType; label: string }[] = [
  { key: "functional", label: "Functional" },
  { key: "non_functional", label: "Non-functional" },
  { key: "edge", label: "Edge cases" },
  { key: "negative", label: "Negative" },
]

export default async function RequirementsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const { project, requirements, testCases } = await getProjectData(projectId)

  const testCountByReq: Record<string, number> = {}
  for (const tc of testCases) for (const rid of tc.requirement_ids) testCountByReq[rid] = (testCountByReq[rid] ?? 0) + 1
  const total = requirements.length || 1

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow={project.name}
        title="Requirements"
        description="Ingest PRDs, Jira tickets or free text. Select requirements to generate test cases."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <IngestPanel projectId={projectId} />
        <Panel title="Criticality analysis" description={`${requirements.length} requirements`}>
          <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
            {CRIT.map((c) => {
              const n = requirements.filter((r) => r.criticality === c.key).length
              return n ? <div key={c.key} style={{ width: `${(n / total) * 100}%`, background: c.color }} title={`${c.label}: ${n}`} /> : null
            })}
          </div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {CRIT.map((c) => {
              const n = requirements.filter((r) => r.criticality === c.key).length
              return (
                <li key={c.key} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-sm" style={{ background: c.color }} />
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="ml-auto font-medium tabular-nums">{n}</span>
                  <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                    {requirements.length ? Math.round((n / total) * 100) : 0}%
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="mt-5 border-t pt-4">
            <div className="mb-2.5 text-xs font-medium text-muted-foreground">By type</div>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <div key={t.key} className="rounded-lg border px-3 py-2">
                  <div className="text-lg font-semibold tabular-nums">{requirements.filter((r) => r.type === t.key).length}</div>
                  <div className="text-[11px] text-muted-foreground">{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <RequirementsTable projectId={projectId} requirements={requirements} testCountByReq={testCountByReq} />
    </div>
  )
}
