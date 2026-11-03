import type { Metadata } from "next"
import { KanbanBoard } from "@/components/execution/kanban-board"
import { PageHeader } from "@/components/shared/ui-bits"
import { Progress } from "@/components/ui/progress"
import { executionSummary } from "@/lib/metrics"
import { getProjectData } from "@/lib/server/queries"

export const metadata: Metadata = { title: "Execution" }

export default async function ExecutionPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const { project, testCases, latestExecution, bugs } = await getProjectData(projectId)
  const summary = executionSummary(testCases, latestExecution)
  const bugCountByTc: Record<string, number> = {}
  for (const b of bugs) if (b.test_case_id && b.status !== "closed") bugCountByTc[b.test_case_id] = (bugCountByTc[b.test_case_id] ?? 0) + 1

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        eyebrow={project.name}
        title="Test execution"
        description="Run the suite on a Kanban board. Every move is recorded in the execution history."
        actions={
          <div className="w-56">
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
              <span>Run progress</span>
              <span className="tabular-nums">
                {summary.executed}/{testCases.length} · {summary.passRate}% pass
              </span>
            </div>
            <Progress value={summary.executedPercent} className="h-2" />
          </div>
        }
      />
      {/* Board state is optimistic and authoritative after each move; remount only when the case set changes. */}
      <KanbanBoard
        key={testCases.map((t) => t.id).join(",")}
        projectId={projectId}
        testCases={testCases}
        latest={latestExecution}
        bugCountByTc={bugCountByTc}
      />
    </div>
  )
}
