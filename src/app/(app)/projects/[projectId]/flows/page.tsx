import type { Metadata } from "next"
import { FlowBuilder } from "@/components/flows/flow-builder"
import { PageHeader } from "@/components/shared/ui-bits"
import type { FlowDiagram } from "@/lib/ai/schemas"
import { getArtifacts, getProjectData } from "@/lib/server/queries"

export const metadata: Metadata = { title: "Flow Builder" }

export default async function FlowsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const [{ project, requirements }, flows] = await Promise.all([
    getProjectData(projectId),
    getArtifacts<FlowDiagram>(projectId, "flow"),
  ])
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow={project.name}
        title="AI visual flow builder"
        description="Visualize user journeys from requirements and spot the flows nobody specified."
      />
      <FlowBuilder projectId={projectId} flows={flows} hasRequirements={requirements.length > 0} />
    </div>
  )
}
