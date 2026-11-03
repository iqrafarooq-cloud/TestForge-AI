"use server"

import { revalidatePath } from "next/cache"
import { and, asc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { generateJson } from "@/lib/ai/client"
import { automationPrompt, QA_SYSTEM, testCasesPrompt, testDataPrompt } from "@/lib/ai/prompts"
import {
  automationCodeSchema,
  testCaseGenerationSchema,
  testDataSchema,
  type AutomationCode,
  type TestCaseGeneration,
} from "@/lib/ai/schemas"
import { schema } from "@/lib/db"
import { nextCodes, requireProject, safe, UserError } from "@/lib/server/guard"
import type { Requirement, TestCase, TestDataRow, TestDataSet } from "@/lib/types"

// Small batches keep each request inside the AI plan's tokens-per-minute budget.
const CHUNK = 4
const { testCases: tcT, requirements: reqT, testCaseRequirements: linkT } = schema

function chunk<T>(items: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export async function generateTestCases(projectId: string, requirementIds: string[], perRequirement = 3) {
  return safe(async () => {
    if (requirementIds.length === 0) throw new UserError("Select at least one requirement.")
    const { db } = await requireProject(projectId)
    const requirements = (await db
      .select()
      .from(reqT)
      .where(and(eq(reqT.project_id, projectId), inArray(reqT.id, requirementIds)))
      .orderBy(asc(reqT.code))) as Requirement[]
    if (requirements.length === 0) throw new UserError("Selected requirements no longer exist.")
    const byCode = new Map(requirements.map((r) => [r.code, r.id]))

    const existing = await db.select({ title: tcT.title }).from(tcT).where(eq(tcT.project_id, projectId))
    const existingTitles = existing.map((t) => t.title)

    // Batches run sequentially: the AI plan is rate-limited per minute, so parallel calls would just queue on 429s.
    const batches: { group: Requirement[]; cases: TestCaseGeneration["test_cases"] }[] = []
    for (const group of chunk(requirements, CHUNK)) {
      const res = await generateJson({
        schema: testCaseGenerationSchema,
        system: QA_SYSTEM,
        prompt: testCasesPrompt(group, Math.min(Math.max(perRequirement, 1), 6), existingTitles),
        temperature: 0.35,
      })
      batches.push({ group, cases: res.test_cases })
    }
    const generated = batches.flatMap((b) => b.cases.map((tc) => ({ tc, group: b.group })))
    if (generated.length === 0) throw new UserError("The AI did not return any test cases. Try again.")

    const codes = await nextCodes(tcT, projectId, "TC", generated.length)
    const rows = generated.map(({ tc }, i) => ({
      id: crypto.randomUUID(),
      project_id: projectId,
      code: codes[i],
      title: tc.title,
      preconditions: tc.preconditions,
      steps: tc.steps,
      expected_result: tc.expected_result,
      priority: tc.priority,
      type: tc.type,
      automation_score: Math.round(tc.automation_score),
      automation_rationale: tc.automation_rationale,
    }))
    const links = generated.flatMap(({ tc, group }, i) => {
      const reqIds = new Set(
        tc.requirement_codes.map((c) => byCode.get(c.trim().toUpperCase())).filter((x): x is string => Boolean(x)),
      )
      // Fall back to the batch's only requirement if the model returned an unknown code.
      if (reqIds.size === 0 && group.length === 1) reqIds.add(group[0].id)
      return [...reqIds].map((requirement_id) => ({ test_case_id: rows[i].id, requirement_id, project_id: projectId }))
    })

    await db.batch([db.insert(tcT).values(rows), ...(links.length ? [db.insert(linkT).values(links)] : [])])
    revalidatePath(`/projects/${projectId}`, "layout")
    return { created: rows.length }
  })
}

const testCaseInput = z.object({
  title: z.string().trim().min(3).max(300),
  preconditions: z.string().trim().max(2000),
  steps: z.array(z.string().trim().min(1)).min(1),
  expected_result: z.string().trim().min(1).max(2000),
  priority: z.enum(["P0", "P1", "P2"]),
  type: z.enum(["Functional", "Regression", "Security", "Performance"]),
  automation_score: z.number().int().min(0).max(100),
})

export async function updateTestCase(projectId: string, id: string, input: z.input<typeof testCaseInput>) {
  return safe(async () => {
    const parsed = testCaseInput.safeParse(input)
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message)
    const { db } = await requireProject(projectId)
    await db
      .update(tcT)
      .set(parsed.data)
      .where(and(eq(tcT.id, id), eq(tcT.project_id, projectId)))
    revalidatePath(`/projects/${projectId}`, "layout")
    return null
  })
}

export async function deleteTestCases(projectId: string, ids: string[]) {
  return safe(async () => {
    const { db } = await requireProject(projectId)
    if (ids.length === 0) return null
    await db.delete(tcT).where(and(eq(tcT.project_id, projectId), inArray(tcT.id, ids)))
    revalidatePath(`/projects/${projectId}`, "layout")
    return null
  })
}

export async function setTraceLink(projectId: string, testCaseId: string, requirementId: string, linked: boolean) {
  return safe(async () => {
    const { db } = await requireProject(projectId)
    if (linked) {
      // Both ends must belong to this project before a link is created.
      const [tc] = await db.select({ id: tcT.id }).from(tcT).where(and(eq(tcT.id, testCaseId), eq(tcT.project_id, projectId)))
      const [req] = await db.select({ id: reqT.id }).from(reqT).where(and(eq(reqT.id, requirementId), eq(reqT.project_id, projectId)))
      if (!tc || !req) throw new UserError("Test case or requirement not found")
      await db
        .insert(linkT)
        .values({ test_case_id: testCaseId, requirement_id: requirementId, project_id: projectId })
        .onConflictDoNothing()
    } else {
      await db
        .delete(linkT)
        .where(and(eq(linkT.project_id, projectId), eq(linkT.test_case_id, testCaseId), eq(linkT.requirement_id, requirementId)))
    }
    revalidatePath(`/projects/${projectId}`, "layout")
    return null
  })
}

function coerce(value: string, type: string): unknown {
  if (type === "null") return null
  if (type === "boolean") return value.trim().toLowerCase() === "true"
  if (type === "number") {
    const n = Number(value)
    return Number.isFinite(n) ? n : value
  }
  return value
}

export async function generateTestData(projectId: string, testCaseId: string) {
  return safe<TestDataSet>(async () => {
    const { db } = await requireProject(projectId)
    const [tc] = await db
      .select()
      .from(tcT)
      .where(and(eq(tcT.id, testCaseId), eq(tcT.project_id, projectId)))
    if (!tc) throw new UserError("Test case not found")

    const result = await generateJson({
      schema: testDataSchema,
      system: QA_SYSTEM,
      prompt: testDataPrompt(tc as TestCase),
      temperature: 0.6,
    })
    const toRows = (rows: typeof result.valid): TestDataRow[] =>
      rows.map((r) => ({
        label: r.label,
        reason: r.reason,
        data: Object.fromEntries(r.values.map((v) => [v.field, coerce(v.value, v.value_type)])),
      }))
    const dataset: TestDataSet = {
      fields: result.fields,
      valid: toRows(result.valid),
      invalid: toRows(result.invalid),
      boundary: toRows(result.boundary),
      generated_at: new Date().toISOString(),
    }
    await db
      .update(tcT)
      .set({ test_data: dataset })
      .where(and(eq(tcT.id, testCaseId), eq(tcT.project_id, projectId)))
    revalidatePath(`/projects/${projectId}`, "layout")
    return dataset
  })
}

export type Framework = "playwright" | "cypress" | "selenium"

export async function exportAutomation(projectId: string, testCaseIds: string[], framework: Framework) {
  return safe<AutomationCode>(async () => {
    if (!["playwright", "cypress", "selenium"].includes(framework)) throw new UserError("Unknown framework.")
    if (testCaseIds.length === 0) throw new UserError("Select at least one test case.")
    if (testCaseIds.length > 10) throw new UserError("Export up to 10 test cases at a time.")
    const { db } = await requireProject(projectId)
    const cases = await db
      .select()
      .from(tcT)
      .where(and(eq(tcT.project_id, projectId), inArray(tcT.id, testCaseIds)))
      .orderBy(asc(tcT.code))
    return generateJson({
      schema: automationCodeSchema,
      system: `${QA_SYSTEM}\nYou are also a senior SDET who writes idiomatic, lint-clean automation code.`,
      prompt: automationPrompt(framework, cases as TestCase[]),
      temperature: 0.2,
    })
  })
}
