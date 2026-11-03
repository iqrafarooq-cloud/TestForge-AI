import type { Metadata } from "next"
import { ApiSuiteView } from "@/components/api-tests/api-suite-view"
import { PageHeader } from "@/components/shared/ui-bits"
import type { ApiSuite } from "@/lib/ai/schemas"
import { getArtifacts, getProjectData } from "@/lib/server/queries"

export const metadata: Metadata = { title: "API Suite" }

export default async function ApiTestsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const [{ project, requirements }, suites] = await Promise.all([
    getProjectData(projectId),
    getArtifacts<ApiSuite>(projectId, "api_suite"),
  ])
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow={project.name}
        title="API test suite generator"
        description="Auto-detects endpoints in your requirements and generates a Postman collection and REST Assured tests."
      />
      <ApiSuiteView projectId={projectId} projectName={project.name} latest={suites[0] ?? null} hasRequirements={requirements.length > 0} />
    </div>
  )
}
