import type { Bug, Execution, ExecutionStatus, Requirement, TestCaseWithLinks } from "@/lib/types"

export interface CoverageRow {
  requirement: Requirement
  testCaseIds: string[]
  covered: boolean
  passed: number
  failed: number
}

export function computeCoverage(requirements: Requirement[], testCases: TestCaseWithLinks[], latest: Record<string, Execution>) {
  const byReq = new Map<string, string[]>()
  for (const tc of testCases) for (const rid of tc.requirement_ids) byReq.set(rid, [...(byReq.get(rid) ?? []), tc.id])

  const rows: CoverageRow[] = requirements.map((r) => {
    const ids = byReq.get(r.id) ?? []
    return {
      requirement: r,
      testCaseIds: ids,
      covered: ids.length > 0,
      passed: ids.filter((id) => latest[id]?.status === "pass").length,
      failed: ids.filter((id) => latest[id]?.status === "fail").length,
    }
  })
  const covered = rows.filter((r) => r.covered).length
  return {
    rows,
    covered,
    uncovered: rows.length - covered,
    percent: rows.length ? Math.round((covered / rows.length) * 100) : 0,
  }
}

export const EXECUTION_STATUSES: ExecutionStatus[] = ["not_run", "pass", "fail", "blocked", "skip"]

export function executionSummary(testCases: TestCaseWithLinks[], latest: Record<string, Execution>) {
  const counts: Record<ExecutionStatus, number> = { not_run: 0, pass: 0, fail: 0, blocked: 0, skip: 0 }
  for (const tc of testCases) counts[latest[tc.id]?.status ?? "not_run"]++
  const executed = testCases.length - counts.not_run
  return {
    counts,
    executed,
    executedPercent: testCases.length ? Math.round((executed / testCases.length) * 100) : 0,
    passRate: executed ? Math.round((counts.pass / executed) * 100) : 0,
  }
}

/** Bugs per 10 test cases; a simple, comparable density figure. */
export function bugDensity(bugs: Bug[], testCaseCount: number) {
  if (!testCaseCount) return 0
  return Math.round((bugs.length / testCaseCount) * 10 * 10) / 10
}
