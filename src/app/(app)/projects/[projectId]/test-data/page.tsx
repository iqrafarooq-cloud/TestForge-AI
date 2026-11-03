import type { Metadata } from "next"
import { Suspense } from "react"
import { PageHeader } from "@/components/shared/ui-bits"
import { TestDataWorkbench } from "@/components/test-data/test-data-workbench"
import { getProjectData } from "@/lib/server/queries"

export const metadata: Metadata = { title: "Test Data" }

export default async function TestDataPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const { project, testCases } = await getProjectData(projectId)
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow={project.name}
        title="AI test data generator"
        description="Realistic valid, invalid and boundary data sets per test case. Export as JSON or CSV for fixtures and data-driven tests."
      />
      <Suspense>
        <TestDataWorkbench projectId={projectId} projectKey={project.key} testCases={testCases} />
      </Suspense>
    </div>
  )
}
