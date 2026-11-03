"use server"

import { revalidatePath } from "next/cache"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { generateJson } from "@/lib/ai/client"
import { QA_SYSTEM, requirementsPrompt } from "@/lib/ai/prompts"
import { requirementsExtractionSchema } from "@/lib/ai/schemas"
import { schema } from "@/lib/db"
import { nextCodes, requireProject, safe, UserError } from "@/lib/server/guard"
import { fetchJiraIssue } from "@/lib/server/jira"
import { extractTextFromFile, normalize } from "@/lib/server/parse"

export interface IngestResult {
  created: number
  summary: string
  risk_notes: string[]
}

export async function ingestRequirements(formData: FormData) {
  return safe<IngestResult>(async () => {
    const projectId = String(formData.get("projectId") ?? "")
    const mode = String(formData.get("mode") ?? "")
    const { db } = await requireProject(projectId)

    let content = ""
    let name = ""
    if (mode === "file") {
      const file = formData.get("file")
      if (!(file instanceof File)) throw new UserError("Choose a file to upload.")
      content = await extractTextFromFile(file)
      name = file.name
    } else if (mode === "jira") {
      const issue = await fetchJiraIssue(String(formData.get("jiraUrl") ?? ""))
      content = normalize(issue.text)
      name = issue.title
    } else if (mode === "text") {
      content = normalize(String(formData.get("text") ?? ""))
      if (content.length < 30) throw new UserError("Paste at least a few sentences of requirements.")
      name = content.split("\n")[0].slice(0, 80) || "Pasted text"
    } else {
      throw new UserError("Unknown ingestion mode.")
    }

    const existing = await db
      .select({ title: schema.requirements.title })
      .from(schema.requirements)
      .where(eq(schema.requirements.project_id, projectId))
    const extraction = await generateJson({
      schema: requirementsExtractionSchema,
      system: QA_SYSTEM,
      prompt: requirementsPrompt(content, existing.map((r) => r.title)),
      temperature: 0.2,
    })

    const sourceId = crypto.randomUUID()
    const codes = await nextCodes(schema.requirements, projectId, "REQ", extraction.requirements.length)
    await db.batch([
      db.insert(schema.requirementSources).values({ id: sourceId, project_id: projectId, kind: mode as "file" | "jira" | "text", name, content }),
      db.insert(schema.requirements).values(
        extraction.requirements.map((r, i) => ({
          project_id: projectId,
          source_id: sourceId,
          code: codes[i],
          title: r.title,
          description: r.description,
          type: r.type,
          criticality: r.criticality,
          criticality_reason: r.criticality_reason,
          module: r.module,
          acceptance_criteria: r.acceptance_criteria,
        })),
      ),
    ])

    revalidatePath(`/projects/${projectId}`, "layout")
    return { created: codes.length, summary: extraction.document_summary, risk_notes: extraction.risk_notes }
  })
}

const requirementInput = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(3).max(4000),
  type: z.enum(["functional", "non_functional", "edge", "negative"]),
  criticality: z.enum(["critical", "high", "medium", "low"]),
  module: z.string().trim().max(80).optional().default(""),
})

export async function upsertRequirement(projectId: string, id: string | null, input: z.input<typeof requirementInput>) {
  return safe(async () => {
    const parsed = requirementInput.safeParse(input)
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message)
    const { db } = await requireProject(projectId)
    if (id) {
      await db
        .update(schema.requirements)
        .set(parsed.data)
        .where(and(eq(schema.requirements.id, id), eq(schema.requirements.project_id, projectId)))
    } else {
      const [code] = await nextCodes(schema.requirements, projectId, "REQ", 1)
      await db.insert(schema.requirements).values({ ...parsed.data, project_id: projectId, code })
    }
    revalidatePath(`/projects/${projectId}`, "layout")
    return null
  })
}

export async function deleteRequirements(projectId: string, ids: string[]) {
  return safe(async () => {
    const { db } = await requireProject(projectId)
    if (ids.length === 0) return null
    await db
      .delete(schema.requirements)
      .where(and(eq(schema.requirements.project_id, projectId), inArray(schema.requirements.id, ids)))
    revalidatePath(`/projects/${projectId}`, "layout")
    return null
  })
}
