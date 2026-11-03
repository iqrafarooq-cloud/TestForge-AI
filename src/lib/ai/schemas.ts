import { z } from "zod"

const reqType = z.enum(["functional", "non_functional", "edge", "negative"])
const criticality = z.enum(["critical", "high", "medium", "low"])

export const requirementsExtractionSchema = z.object({
  document_summary: z.string().describe("2-3 sentence summary of the product scope"),
  requirements: z
    .array(
      z.object({
        title: z.string().describe("Short imperative title, max 12 words"),
        description: z.string().describe("Precise, testable requirement statement"),
        type: reqType,
        criticality,
        criticality_reason: z.string().describe("Why this criticality: business/user/security impact"),
        module: z.string().describe("Feature area, e.g. Authentication, Checkout"),
        acceptance_criteria: z.array(z.string()).describe("1-5 verifiable acceptance criteria"),
      }),
    )
    .min(1),
  risk_notes: z.array(z.string()).describe("Ambiguities, gaps, or contradictions found in the source"),
})
export type RequirementsExtraction = z.infer<typeof requirementsExtractionSchema>

export const testCaseGenerationSchema = z.object({
  test_cases: z
    .array(
      z.object({
        title: z.string(),
        preconditions: z.string(),
        steps: z.array(z.string()).min(1),
        expected_result: z.string(),
        priority: z.enum(["P0", "P1", "P2"]),
        type: z.enum(["Functional", "Regression", "Security", "Performance"]),
        automation_score: z.number().int().min(0).max(100).describe("0-100 feasibility of automating this case"),
        automation_rationale: z.string(),
        requirement_codes: z.array(z.string()).min(1).describe("Requirement codes this case verifies, e.g. REQ-001"),
      }),
    )
    .min(1),
})
export type TestCaseGeneration = z.infer<typeof testCaseGenerationSchema>

const dataValue = z.object({
  field: z.string(),
  value: z.string().describe("Value serialized as text"),
  value_type: z.enum(["string", "number", "boolean", "null"]),
})
const dataRow = z.object({
  label: z.string(),
  reason: z.string().describe("Why this row is valid/invalid/boundary"),
  values: z.array(dataValue).min(1),
})
export const testDataSchema = z.object({
  fields: z.array(z.object({ name: z.string(), description: z.string() })).min(1),
  valid: z.array(dataRow).min(1),
  invalid: z.array(dataRow).min(1),
  boundary: z.array(dataRow).min(1),
})
export type TestDataGeneration = z.infer<typeof testDataSchema>

export const automationCodeSchema = z.object({
  files: z
    .array(
      z.object({
        path: z.string().describe("Relative file path, e.g. tests/login.spec.ts"),
        language: z.string(),
        content: z.string().describe("Complete, runnable file content"),
      }),
    )
    .min(1),
  setup_instructions: z.array(z.string()).describe("Shell commands / steps to install and run"),
  notes: z.array(z.string()).describe("Assumptions such as selectors or base URLs the user must adjust"),
})
export type AutomationCode = z.infer<typeof automationCodeSchema>

export const apiSuiteSchema = z.object({
  has_api: z.boolean(),
  base_url: z.string().describe("Base URL placeholder, e.g. {{baseUrl}} value like https://api.example.com"),
  auth_scheme: z.string().describe("none, bearer, basic, api_key, or oauth2"),
  endpoints: z.array(
    z.object({
      name: z.string(),
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
      path: z.string().describe("Path starting with /, path params as :id"),
      description: z.string(),
      requirement_codes: z.array(z.string()),
      tests: z
        .array(
          z.object({
            name: z.string(),
            request_body: z.string().describe("JSON request body as a string, or empty string"),
            query: z.array(z.object({ key: z.string(), value: z.string() })),
            expected_status: z.number().int(),
            assertions: z.array(
              z.object({
                kind: z.enum(["status", "json_path_exists", "json_path_equals", "header_exists", "response_time_below"]),
                target: z.string().describe("JSON path like data.id, header name, or empty"),
                expected: z.string().describe("Expected value as text, or empty"),
              }),
            ),
          }),
        )
        .min(1),
    }),
  ),
  rest_assured_java: z.string().describe("Complete JUnit 5 + REST Assured test class covering all tests"),
})
export type ApiSuite = z.infer<typeof apiSuiteSchema>

export const flowSchema = z.object({
  title: z.string(),
  mermaid: z.string().describe("Valid Mermaid flowchart TD source, no code fences"),
  journeys: z.array(z.object({ name: z.string(), requirement_codes: z.array(z.string()) })),
  missing_flows: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      severity: z.enum(["high", "medium", "low"]),
    }),
  ),
})
export type FlowDiagram = z.infer<typeof flowSchema>
