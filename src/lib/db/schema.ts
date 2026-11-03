import { relations, sql } from "drizzle-orm"
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import type { TestDataSet } from "@/lib/types"

// Hierarchy: projects > requirements > test_cases > executions > bugs (one shared workspace, no accounts).
// Column keys are snake_case so rows map 1:1 onto the domain types in lib/types.ts.

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())
const createdAt = () =>
  text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString())
const updatedAt = () =>
  text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString())
    .$onUpdateFn(() => new Date().toISOString())
const projectRef = () =>
  text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" })

/** Single-row table (id = "default") holding workspace-wide integration settings. */
export const workspaceSettings = sqliteTable("workspace_settings", {
  id: text("id").primaryKey(),
  jira_base_url: text("jira_base_url"),
  jira_email: text("jira_email"),
  jira_token_encrypted: text("jira_token_encrypted"),
  updated_at: updatedAt(),
})

export const projects = sqliteTable(
  "projects",
  {
    id: id(),
    name: text("name").notNull(),
    description: text("description"),
    key: text("key").notNull(),
    start_date: text("start_date").notNull(),
    end_date: text("end_date").notNull(),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [index("projects_created_idx").on(t.created_at), check("projects_dates", sql`${t.end_date} >= ${t.start_date}`)],
)

export const requirementSources = sqliteTable(
  "requirement_sources",
  {
    id: id(),
    project_id: projectRef(),
    kind: text("kind", { enum: ["file", "jira", "text"] }).notNull(),
    name: text("name").notNull(),
    content: text("content").notNull(),
    created_at: createdAt(),
  },
  (t) => [index("requirement_sources_project_idx").on(t.project_id)],
)

export const requirements = sqliteTable(
  "requirements",
  {
    id: id(),
    project_id: projectRef(),
    source_id: text("source_id").references(() => requirementSources.id, { onDelete: "set null" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    type: text("type", { enum: ["functional", "non_functional", "edge", "negative"] }).notNull(),
    criticality: text("criticality", { enum: ["critical", "high", "medium", "low"] }).notNull(),
    criticality_reason: text("criticality_reason"),
    module: text("module"),
    acceptance_criteria: text("acceptance_criteria", { mode: "json" }).$type<string[]>().notNull().default([]),
    created_at: createdAt(),
  },
  (t) => [uniqueIndex("requirements_code_uq").on(t.project_id, t.code)],
)

export const testCases = sqliteTable(
  "test_cases",
  {
    id: id(),
    project_id: projectRef(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    preconditions: text("preconditions").notNull().default(""),
    steps: text("steps", { mode: "json" }).$type<string[]>().notNull().default([]),
    expected_result: text("expected_result").notNull(),
    priority: text("priority", { enum: ["P0", "P1", "P2"] }).notNull(),
    type: text("type", { enum: ["Functional", "Regression", "Security", "Performance"] }).notNull(),
    automation_score: integer("automation_score").notNull(),
    automation_rationale: text("automation_rationale"),
    test_data: text("test_data", { mode: "json" }).$type<TestDataSet | null>(),
    created_at: createdAt(),
  },
  (t) => [
    uniqueIndex("test_cases_code_uq").on(t.project_id, t.code),
    check("test_cases_score", sql`${t.automation_score} between 0 and 100`),
  ],
)

export const testCaseRequirements = sqliteTable(
  "test_case_requirements",
  {
    test_case_id: text("test_case_id")
      .notNull()
      .references(() => testCases.id, { onDelete: "cascade" }),
    requirement_id: text("requirement_id")
      .notNull()
      .references(() => requirements.id, { onDelete: "cascade" }),
    project_id: projectRef(),
  },
  (t) => [
    primaryKey({ columns: [t.test_case_id, t.requirement_id] }),
    index("tcr_requirement_idx").on(t.requirement_id),
    index("tcr_project_idx").on(t.project_id),
  ],
)

export const executions = sqliteTable(
  "executions",
  {
    id: id(),
    project_id: projectRef(),
    test_case_id: text("test_case_id")
      .notNull()
      .references(() => testCases.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["not_run", "pass", "fail", "blocked", "skip"] }).notNull(),
    environment: text("environment"),
    notes: text("notes"),
    executed_at: text("executed_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [index("executions_tc_idx").on(t.test_case_id, t.executed_at), index("executions_project_idx").on(t.project_id)],
)

export const bugs = sqliteTable(
  "bugs",
  {
    id: id(),
    project_id: projectRef(),
    test_case_id: text("test_case_id").references(() => testCases.id, { onDelete: "set null" }),
    execution_id: text("execution_id").references(() => executions.id, { onDelete: "set null" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    steps_to_reproduce: text("steps_to_reproduce", { mode: "json" }).$type<string[]>().notNull().default([]),
    expected_result: text("expected_result").notNull().default(""),
    actual_result: text("actual_result").notNull().default(""),
    severity: text("severity", { enum: ["critical", "major", "minor", "trivial"] }).notNull().default("major"),
    environment: text("environment").notNull().default(""),
    status: text("status", { enum: ["open", "in_progress", "resolved", "closed"] }).notNull().default("open"),
    assignee_email: text("assignee_email"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [uniqueIndex("bugs_code_uq").on(t.project_id, t.code), index("bugs_project_idx").on(t.project_id, t.created_at)],
)

export const artifacts = sqliteTable(
  "artifacts",
  {
    id: id(),
    project_id: projectRef(),
    kind: text("kind", { enum: ["flow", "api_suite"] }).notNull(),
    title: text("title").notNull(),
    content: text("content", { mode: "json" }).$type<unknown>().notNull(),
    created_at: createdAt(),
  },
  (t) => [index("artifacts_project_idx").on(t.project_id, t.kind, t.created_at)],
)

export const phases = sqliteTable(
  "phases",
  {
    id: id(),
    project_id: projectRef(),
    name: text("name").notNull(),
    start_date: text("start_date").notNull(),
    end_date: text("end_date").notNull(),
    progress: integer("progress").notNull().default(0),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("phases_project_idx").on(t.project_id, t.position)],
)

export const projectRelations = relations(projects, ({ many }) => ({
  requirements: many(requirements),
  testCases: many(testCases),
  bugs: many(bugs),
}))
