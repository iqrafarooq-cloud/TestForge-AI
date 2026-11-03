"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { schema } from "@/lib/db"
import { serverEnv } from "@/lib/env"
import { nextCodes, requireProject, safe, UserError } from "@/lib/server/guard"
import type { Bug, Execution } from "@/lib/types"

const statusSchema = z.enum(["not_run", "pass", "fail", "blocked", "skip"])

async function assertTestCaseInProject(db: Awaited<ReturnType<typeof requireProject>>["db"], projectId: string, testCaseId: string) {
  const [tc] = await db
    .select({ id: schema.testCases.id })
    .from(schema.testCases)
    .where(and(eq(schema.testCases.id, testCaseId), eq(schema.testCases.project_id, projectId)))
  if (!tc) throw new UserError("Test case not found")
}

export async function recordExecution(
  projectId: string,
  testCaseId: string,
  status: z.infer<typeof statusSchema>,
  environment?: string,
  notes?: string,
) {
  return safe<Execution>(async () => {
    const parsed = statusSchema.safeParse(status)
    if (!parsed.success) throw new UserError("Invalid status")
    const { db } = await requireProject(projectId)
    await assertTestCaseInProject(db, projectId, testCaseId)
    const [row] = await db
      .insert(schema.executions)
      .values({
        project_id: projectId,
        test_case_id: testCaseId,
        status: parsed.data,
        environment: environment?.slice(0, 200) || null,
        notes: notes?.slice(0, 2000) || null,
      })
      .returning()
    revalidatePath(`/projects/${projectId}`, "layout")
    return row as Execution
  })
}

const bugInput = z.object({
  test_case_id: z.uuid().nullable(),
  execution_id: z.uuid().nullable(),
  title: z.string().trim().min(3, "Title is too short").max(300),
  steps_to_reproduce: z.array(z.string().trim().min(1)).min(1, "Add at least one step"),
  expected_result: z.string().trim().min(1, "Expected result is required").max(4000),
  actual_result: z.string().trim().min(1, "Actual result is required").max(4000),
  severity: z.enum(["critical", "major", "minor", "trivial"]),
  environment: z.string().trim().max(500),
  assignee_email: z.union([z.email("Invalid assignee email"), z.literal("")]).optional(),
})

export async function createBug(projectId: string, input: z.input<typeof bugInput>) {
  return safe<{ bug: Bug; mail: MailOutcome | null }>(async () => {
    const parsed = bugInput.safeParse(input)
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message)
    const { db, project } = await requireProject(projectId)
    if (parsed.data.test_case_id) await assertTestCaseInProject(db, projectId, parsed.data.test_case_id)
    let executionId = parsed.data.execution_id
    if (executionId) {
      const [exec] = await db
        .select({ id: schema.executions.id })
        .from(schema.executions)
        .where(and(eq(schema.executions.id, executionId), eq(schema.executions.project_id, projectId)))
      if (!exec) executionId = null
    }
    const [code] = await nextCodes(schema.bugs, projectId, "BUG", 1)
    const [row] = await db
      .insert(schema.bugs)
      .values({
        ...parsed.data,
        execution_id: executionId,
        assignee_email: parsed.data.assignee_email || null,
        project_id: projectId,
        code,
      })
      .returning()
    const bug = row as Bug
    const mail = bug.assignee_email ? await notifyAssignee(project.name, bug) : null
    revalidatePath(`/projects/${projectId}`, "layout")
    return { bug, mail }
  })
}

export async function updateBug(
  projectId: string,
  bugId: string,
  patch: { status?: Bug["status"]; severity?: Bug["severity"]; assignee_email?: string | null },
) {
  return safe<{ mail: MailOutcome | null }>(async () => {
    const parsed = z
      .object({
        status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
        severity: z.enum(["critical", "major", "minor", "trivial"]).optional(),
        assignee_email: z.union([z.email("Invalid email"), z.literal(""), z.null()]).optional(),
      })
      .safeParse(patch)
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message)
    const { db, project } = await requireProject(projectId)
    const update = { ...parsed.data }
    if (update.assignee_email === "") update.assignee_email = null
    const [row] = await db
      .update(schema.bugs)
      .set(update)
      .where(and(eq(schema.bugs.id, bugId), eq(schema.bugs.project_id, projectId)))
      .returning()
    if (!row) throw new UserError("Defect not found")
    const mail = parsed.data.assignee_email ? await notifyAssignee(project.name, row as Bug) : null
    revalidatePath(`/projects/${projectId}`, "layout")
    return { mail }
  })
}

export interface MailOutcome {
  sent: boolean
  /** mailto: link the client opens when no email provider is configured. */
  mailto?: string
  error?: string
}

function bugEmailBody(projectName: string, bug: Bug) {
  return [
    `${bug.code}: ${bug.title}`,
    `Project: ${projectName}`,
    `Severity: ${bug.severity.toUpperCase()}`,
    `Environment: ${bug.environment || "n/a"}`,
    "",
    "Steps to reproduce:",
    ...bug.steps_to_reproduce.map((s, i) => `${i + 1}. ${s}`),
    "",
    `Expected: ${bug.expected_result}`,
    `Actual: ${bug.actual_result}`,
  ].join("\n")
}

async function notifyAssignee(projectName: string, bug: Bug): Promise<MailOutcome> {
  const env = serverEnv()
  const subject = `[${bug.severity.toUpperCase()}] ${bug.code} assigned to you: ${bug.title}`
  const text = bugEmailBody(projectName, bug)
  if (!env.resendApiKey) {
    return {
      sent: false,
      mailto: `mailto:${encodeURIComponent(bug.assignee_email!)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`,
    }
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.mailFrom, to: [bug.assignee_email], subject, text }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { sent: false, error: `Email provider returned ${res.status}` }
    return { sent: true }
  } catch (err) {
    return { sent: false, error: (err as Error).message }
  }
}
