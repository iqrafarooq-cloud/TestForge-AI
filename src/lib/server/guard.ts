import "server-only"
import { eq } from "drizzle-orm"
import { AiError } from "@/lib/ai/client"
import { getDb, schema } from "@/lib/db"
import type { ActionResult, Project } from "@/lib/types"

export class UserError extends Error {}

/** Every project-scoped read/write goes through here so a stale or invalid id fails cleanly. */
export async function requireProject(projectId: string) {
  const db = await getDb()
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, String(projectId))).limit(1)
  if (!project) throw new UserError("Project not found")
  return { db, project: project as Project }
}

type CodedTable = typeof schema.requirements | typeof schema.testCases | typeof schema.bugs

/** Returns `count` sequential codes like REQ-004, REQ-005 for the given project. */
export async function nextCodes(table: CodedTable, projectId: string, prefix: string, count: number) {
  const db = await getDb()
  const rows = await db.select({ code: table.code }).from(table).where(eq(table.project_id, projectId))
  const max = rows.reduce((m, row) => {
    const n = Number.parseInt(row.code.split("-").pop() ?? "0", 10)
    return Number.isFinite(n) && n > m ? n : m
  }, 0)
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(max + i + 1).padStart(3, "0")}`)
}

function isNextControlFlow(err: unknown) {
  return (
    !!err &&
    typeof err === "object" &&
    "digest" in err &&
    String((err as { digest: unknown }).digest).startsWith("NEXT_")
  )
}

/** Converts thrown errors into a serializable ActionResult so the UI can show them. */
export async function safe<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    if (isNextControlFlow(err)) throw err
    if (err instanceof UserError || err instanceof AiError) return { ok: false, error: err.message }
    console.error("[action]", err)
    return { ok: false, error: "Something went wrong. Please try again." }
  }
}
