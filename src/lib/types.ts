export type RequirementType = "functional" | "non_functional" | "edge" | "negative"
export type Criticality = "critical" | "high" | "medium" | "low"
export type Priority = "P0" | "P1" | "P2"
export type TestType = "Functional" | "Regression" | "Security" | "Performance"
export type ExecutionStatus = "not_run" | "pass" | "fail" | "blocked" | "skip"
export type BugSeverity = "critical" | "major" | "minor" | "trivial"
export type BugStatus = "open" | "in_progress" | "resolved" | "closed"

export interface Project {
  id: string
  owner_id: string
  name: string
  description: string | null
  key: string
  start_date: string
  end_date: string
  created_at: string
  updated_at: string
}

export interface Requirement {
  id: string
  project_id: string
  source_id: string | null
  code: string
  title: string
  description: string
  type: RequirementType
  criticality: Criticality
  criticality_reason: string | null
  module: string | null
  acceptance_criteria: string[]
  created_at: string
}

export interface TestDataRow {
  label: string
  reason?: string
  data: Record<string, unknown>
}

export interface TestDataSet {
  fields: { name: string; description: string }[]
  valid: TestDataRow[]
  invalid: TestDataRow[]
  boundary: TestDataRow[]
  generated_at: string
}

export interface TestCase {
  id: string
  project_id: string
  code: string
  title: string
  preconditions: string
  steps: string[]
  expected_result: string
  priority: Priority
  type: TestType
  automation_score: number
  automation_rationale: string | null
  test_data: TestDataSet | null
  created_at: string
}

export interface TestCaseWithLinks extends TestCase {
  requirement_ids: string[]
}

export interface Execution {
  id: string
  project_id: string
  test_case_id: string
  status: ExecutionStatus
  environment: string | null
  notes: string | null
  executed_at: string
}

export interface Bug {
  id: string
  project_id: string
  test_case_id: string | null
  execution_id: string | null
  code: string
  title: string
  steps_to_reproduce: string[]
  expected_result: string
  actual_result: string
  severity: BugSeverity
  environment: string
  status: BugStatus
  assignee_email: string | null
  created_at: string
  updated_at: string
}

export interface Phase {
  id: string
  project_id: string
  name: string
  start_date: string
  end_date: string
  progress: number
  position: number
}

export interface Artifact<T = unknown> {
  id: string
  project_id: string
  kind: "flow" | "api_suite"
  title: string
  content: T
  created_at: string
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string }
