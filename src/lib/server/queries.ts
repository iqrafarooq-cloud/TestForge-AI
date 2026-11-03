import "server-only"
import { cache } from "react"
import { notFound } from "next/navigation"
import { and, asc, count, desc, eq } from "drizzle-orm"
import { getDb, schema } from "@/lib/db"
import type { Artifact, Bug, Execution, Phase, Project, Requirement, TestCase, TestCaseWithLinks } from "@/lib/types"

export const getWorkspaceSettings = cache(async () => {
  const db = await getDb()
  const [row] = await db.select().from(schema.workspaceSettings).where(eq(schema.workspaceSettings.id, "default")).limit(1)
  return {
    jiraBaseUrl: row?.jira_base_url ?? "",
    jiraEmail: row?.jira_email ?? "",
    hasJiraToken: Boolean(row?.jira_token_encrypted),
  }
})

export const listProjects = cache(async () => {
  const db = await getDb()
  const projects = (await db.select().from(schema.projects).orderBy(desc(schema.projects.created_at))) as Project[]
  if (projects.length === 0) return []
  const countBy = async (table: typeof schema.requirements | typeof schema.testCases | typeof schema.bugs) => {
    const rows = await db.select({ project_id: table.project_id, n: count() }).from(table).groupBy(table.project_id)
    return new Map(rows.map((r) => [r.project_id, r.n]))
  }
  const [reqs, tcs, bugs] = await Promise.all([countBy(schema.requirements), countBy(schema.testCases), countBy(schema.bugs)])
  return projects.map((p) => ({
    ...p,
    requirement_count: reqs.get(p.id) ?? 0,
    test_case_count: tcs.get(p.id) ?? 0,
    bug_count: bugs.get(p.id) ?? 0,
  }))
})

export const getProject = cache(async (projectId: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) notFound()
  const db = await getDb()
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1)
  if (!project) notFound()
  return project as Project
})

/** Loads the whole project graph once per request (deduped across layout + page). */
export const getProjectData = cache(async (projectId: string) => {
  const project = await getProject(projectId)
  const db = await getDb()
  const s = schema
  const [requirements, tcs, links, executions, bugs, phases] = await Promise.all([
    db.select().from(s.requirements).where(eq(s.requirements.project_id, projectId)).orderBy(asc(s.requirements.code)),
    db.select().from(s.testCases).where(eq(s.testCases.project_id, projectId)).orderBy(asc(s.testCases.code)),
    db
      .select({ test_case_id: s.testCaseRequirements.test_case_id, requirement_id: s.testCaseRequirements.requirement_id })
      .from(s.testCaseRequirements)
      .where(eq(s.testCaseRequirements.project_id, projectId)),
    db
      .select()
      .from(s.executions)
      .where(eq(s.executions.project_id, projectId))
      .orderBy(desc(s.executions.executed_at))
      .limit(5000),
    db.select().from(s.bugs).where(eq(s.bugs.project_id, projectId)).orderBy(desc(s.bugs.created_at)),
    db.select().from(s.phases).where(eq(s.phases.project_id, projectId)).orderBy(asc(s.phases.position)),
  ])

  const linkMap = new Map<string, string[]>()
  for (const l of links) linkMap.set(l.test_case_id, [...(linkMap.get(l.test_case_id) ?? []), l.requirement_id])
  const testCases: TestCaseWithLinks[] = (tcs as TestCase[]).map((tc) => ({ ...tc, requirement_ids: linkMap.get(tc.id) ?? [] }))

  const latest: Record<string, Execution> = {}
  for (const e of executions as Execution[]) if (!latest[e.test_case_id]) latest[e.test_case_id] = e

  return {
    project,
    requirements: requirements as Requirement[],
    testCases,
    executions: executions as Execution[],
    latestExecution: latest,
    bugs: bugs as Bug[],
    phases: phases as Phase[],
  }
})

export type ProjectData = Awaited<ReturnType<typeof getProjectData>>

export async function getArtifacts<T>(projectId: string, kind: "flow" | "api_suite") {
  await getProject(projectId)
  const db = await getDb()
  const rows = await db
    .select()
    .from(schema.artifacts)
    .where(and(eq(schema.artifacts.project_id, projectId), eq(schema.artifacts.kind, kind)))
    .orderBy(desc(schema.artifacts.created_at))
    .limit(20)
  return rows as Artifact<T>[]
}
