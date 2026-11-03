"use server"

import { revalidatePath } from "next/cache"
import { and, asc, eq } from "drizzle-orm"
import { generateJson } from "@/lib/ai/client"
import { apiSuitePrompt, flowPrompt, QA_SYSTEM } from "@/lib/ai/prompts"
import { apiSuiteSchema, flowSchema, type ApiSuite, type FlowDiagram } from "@/lib/ai/schemas"
import { schema } from "@/lib/db"
import { requireProject, safe, UserError } from "@/lib/server/guard"
import type { Artifact, Requirement } from "@/lib/types"

const artT = schema.artifacts

async function loadRequirements(projectId: string) {
  const { db } = await requireProject(projectId)
  const requirements = (await db
    .select()
    .from(schema.requirements)
    .where(eq(schema.requirements.project_id, projectId))
    .orderBy(asc(schema.requirements.code))) as Requirement[]
  if (requirements.length === 0) throw new UserError("Add requirements to this project first.")
  return { db, requirements }
}

export async function generateFlow(projectId: string, focus?: string) {
  return safe<Artifact<FlowDiagram>>(async () => {
    const { db, requirements } = await loadRequirements(projectId)
    const flow = await generateJson({
      schema: flowSchema,
      system: QA_SYSTEM,
      prompt: flowPrompt(requirements.slice(0, 120), focus?.slice(0, 300)),
      temperature: 0.25,
    })
    flow.mermaid = flow.mermaid.replace(/^```(?:mermaid)?\s*|\s*```$/g, "").trim()
    const [row] = await db.insert(artT).values({ project_id: projectId, kind: "flow", title: flow.title, content: flow }).returning()
    revalidatePath(`/projects/${projectId}/flows`)
    return row as Artifact<FlowDiagram>
  })
}

export async function saveFlowSource(projectId: string, artifactId: string, mermaid: string) {
  return safe(async () => {
    const { db } = await requireProject(projectId)
    const where = and(eq(artT.id, artifactId), eq(artT.project_id, projectId), eq(artT.kind, "flow"))
    const [existing] = await db.select({ content: artT.content }).from(artT).where(where)
    if (!existing) throw new UserError("Diagram not found")
    await db
      .update(artT)
      .set({ content: { ...(existing.content as FlowDiagram), mermaid: mermaid.slice(0, 50_000) } })
      .where(where)
    revalidatePath(`/projects/${projectId}/flows`)
    return null
  })
}

export async function generateApiSuite(projectId: string) {
  return safe<Artifact<ApiSuite>>(async () => {
    const { db, requirements } = await loadRequirements(projectId)
    const suite = await generateJson({
      schema: apiSuiteSchema,
      system: `${QA_SYSTEM}\nYou are also an API test architect fluent in Postman and REST Assured.`,
      prompt: apiSuitePrompt(requirements.slice(0, 150)),
      temperature: 0.2,
    })
    const [row] = await db
      .insert(artT)
      .values({
        project_id: projectId,
        kind: "api_suite",
        title: suite.has_api ? `${suite.endpoints.length} endpoints` : "No API detected",
        content: suite,
      })
      .returning()
    revalidatePath(`/projects/${projectId}/api-tests`)
    return row as Artifact<ApiSuite>
  })
}

export async function deleteArtifact(projectId: string, artifactId: string) {
  return safe(async () => {
    const { db } = await requireProject(projectId)
    await db.delete(artT).where(and(eq(artT.id, artifactId), eq(artT.project_id, projectId)))
    revalidatePath(`/projects/${projectId}`, "layout")
    return null
  })
}
