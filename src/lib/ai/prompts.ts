import type { Requirement, TestCase } from "@/lib/types"

export const QA_SYSTEM = `You are TestForge AI, a principal QA architect with 15 years of experience in enterprise software testing (ISTQB Advanced, OWASP, performance engineering).
You produce precise, testable, non-redundant output. You never invent product features that are not implied by the source.
You ALWAYS respond with a single JSON object that matches the provided JSON schema exactly. No markdown, no prose outside JSON.`

export function requirementsPrompt(source: string, existingTitles: string[]) {
  return `Analyze the product source below and extract requirements.

Classify each requirement:
- "functional": a behaviour the system must perform.
- "non_functional": performance, security, accessibility, reliability, compliance, usability.
- "edge": boundary conditions, limits, unusual-but-valid states (empty lists, max lengths, concurrency, timezones).
- "negative": invalid input, error handling, unauthorized access, failure modes the system must handle gracefully.

Criticality analysis (be strict, most items are NOT critical):
- critical: failure causes data loss, security breach, legal/financial exposure, or blocks the core flow for all users.
- high: core feature broken for many users, no workaround.
- medium: degraded experience, workaround exists.
- low: cosmetic or rarely used.

Rules:
- Split compound statements into atomic, individually testable requirements.
- Derive edge and negative requirements that a senior QA would expect even if the source only implies them.
- Do not duplicate any of these existing requirements: ${existingTitles.length ? existingTitles.map((t) => `"${t}"`).join(", ") : "(none)"}.
- Put ambiguities, contradictions, and missing information into risk_notes.

SOURCE:
"""
${source}
"""`
}

export function testCasesPrompt(requirements: Requirement[], perRequirement: number, existingTitles: string[]) {
  const reqs = requirements
    .map(
      (r) =>
        `${r.code} [${r.type}, ${r.criticality}] ${r.title}: ${r.description}${
          r.acceptance_criteria?.length ? `\n  Acceptance: ${r.acceptance_criteria.join(" | ")}` : ""
        }`,
    )
    .join("\n")
  return `Design test cases for the requirements below. Aim for about ${perRequirement} high-value cases per requirement (more for critical, fewer for low).

For each test case:
- title: starts with a verb ("Verify...", "Reject...", "Ensure...").
- preconditions: concrete system state and test data needed.
- steps: atomic user/system actions, one action per step, no numbering prefix.
- expected_result: observable, verifiable outcome.
- priority: P0 for critical-path/critical requirements, P1 important, P2 nice-to-have.
- type: Functional, Regression, Security, or Performance (pick the dominant intent).
- automation_score: 0-100. High (80+) for deterministic UI/API flows; low (<40) for visual judgement, CAPTCHA, hardware, or exploratory checks.
- requirement_codes: the exact codes from the list this case verifies (at least one).

Cover positive, negative, and boundary paths. Avoid duplicates of: ${
    existingTitles.length ? existingTitles.slice(0, 80).map((t) => `"${t}"`).join(", ") : "(none)"
  }.

REQUIREMENTS:
${reqs}`
}

export function testDataPrompt(tc: TestCase) {
  return `Generate realistic test data for this test case.

${tc.code}: ${tc.title}
Preconditions: ${tc.preconditions}
Steps:
${tc.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}
Expected: ${tc.expected_result}

Rules:
- Identify the input fields the test needs (fields).
- valid: 3-5 realistic rows (real-looking names, emails, addresses, amounts; never lorem ipsum).
- invalid: 3-6 rows each breaking exactly one rule, with reason.
- boundary: 3-6 rows at exact limits (min, max, min-1, max+1, empty, unicode, very long) with reason.
- Every row must include a value for every field. Use value_type to indicate the JSON type.`
}

const FRAMEWORK_GUIDE: Record<string, string> = {
  playwright: `Playwright Test with TypeScript (@playwright/test). Use the Page Object Model: one page object class per screen under tests/pages/, specs under tests/. Prefer getByRole/getByLabel/getByTestId locators, web-first assertions (await expect(...).toBeVisible()), test.describe per requirement, and test.step for each manual step. Include playwright.config.ts with baseURL from process.env.BASE_URL.`,
  cypress: `Cypress 13+ with TypeScript. Specs under cypress/e2e/*.cy.ts, custom commands in cypress/support/commands.ts, fixtures in cypress/fixtures/*.json built from the test data. Use cy.get('[data-testid=...]') or cy.findByRole style selectors, cy.intercept for network waits, no arbitrary cy.wait(ms). Include cypress.config.ts with baseUrl from env.`,
  selenium: `Selenium 4 with Python and pytest. Page Object Model under pages/, tests under tests/test_*.py, conftest.py with a WebDriver fixture (Chrome, headless option via env), explicit waits via WebDriverWait + expected_conditions, BASE_URL from environment, pytest.mark.parametrize using the test data. Include requirements.txt.`,
}

export function automationPrompt(framework: string, cases: TestCase[]) {
  const body = cases
    .map((tc) => {
      const data = tc.test_data
        ? `\n  Test data (valid sample): ${JSON.stringify(tc.test_data.valid?.[0]?.data ?? {})}`
        : ""
      return `${tc.code} [${tc.priority}, ${tc.type}] ${tc.title}
  Preconditions: ${tc.preconditions}
  Steps: ${tc.steps.map((s, i) => `(${i + 1}) ${s}`).join(" ")}
  Expected: ${tc.expected_result}${data}`
    })
    .join("\n\n")
  return `Convert these manual test cases into production-quality automated tests.

Framework: ${FRAMEWORK_GUIDE[framework]}

Requirements:
- Every test case becomes one test whose name starts with its ID (e.g. "TC-001 Verify ...").
- Code must be complete and runnable: imports, config, page objects. No "TODO: implement" bodies.
- Use realistic, clearly named selectors and list them in notes so the user can adjust them.
- Keep secrets in environment variables.

TEST CASES:
${body}`
}

export function apiSuitePrompt(requirements: Requirement[]) {
  return `Inspect the requirements below and detect every HTTP API endpoint that is stated or clearly implied (REST resources, auth endpoints, webhooks).
If there are none, return has_api=false with an empty endpoints list and an empty rest_assured_java string.

For each endpoint, design 2-4 API tests (happy path, validation error, auth failure, not found) with concrete request bodies and assertions.
rest_assured_java must be a single complete JUnit 5 class (package com.qaforge.api) using REST Assured given/when/then, a @BeforeAll that reads BASE_URL and API_TOKEN from env, and one @Test per test, named after the endpoint and test.

REQUIREMENTS:
${requirements.map((r) => `${r.code} [${r.type}] ${r.title}: ${r.description}`).join("\n")}`
}

export function flowPrompt(requirements: Requirement[], focus?: string) {
  return `Build a user-journey flow diagram from these requirements${focus ? ` focusing on: ${focus}` : ""}.

Mermaid rules (strict, the output is rendered directly):
- Start with "flowchart TD". Node ids are alphanumeric only (A1, Login, CheckoutOk).
- Labels in double quotes: A1["Open login page"]. Decisions: D1{"Valid credentials?"}. Do not use parentheses, quotes, or brackets inside labels.
- Edge labels: A1 -->|"Yes"| B1.
- Group journeys with subgraph Name ... end where useful.
- Mark nodes for flows that are missing from the requirements with class missing, and add at the end: classDef missing stroke:#ef4444,stroke-width:2px,stroke-dasharray:5 5
- Max ~45 nodes.

Then list missing_flows: journeys a user would expect (error recovery, cancellation, timeouts, permissions, empty states) that the requirements do not cover.

REQUIREMENTS:
${requirements.map((r) => `${r.code} [${r.type}] ${r.title}: ${r.description}`).join("\n")}`
}
