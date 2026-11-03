# TestForge-AI
# TestForge AI

AI-powered QA lifecycle platform: **Projects → Requirements → Test Cases → Execution → Defects**, fully traceable.

Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · SQLite (Drizzle ORM + libSQL) · Groq (gpt-oss-120b) · Mermaid · Recharts · Zustand

No external services are required except a Groq API key for the AI features.

## Quick start

```bash
npm install
cp .env.example .env.local   # set ENCRYPTION_SECRET and GROQ_API_KEY
npm run dev                  # http://localhost:3001
```

The SQLite database (`data/qaforge.db`) and its schema are created automatically on first request. There is no login: everyone who opens the app uses one shared workspace. The AI key lives only in `.env.local` on the server.

## Modules

| # | Module | Route |
|---|--------|-------|
| 1 | Smart requirement ingestion (PDF / DOCX / TXT / MD upload, Jira Cloud URL, pasted text) with criticality analysis | `/projects/:id/requirements` |
| 2 | AI test case generation (ID, title, pre-conditions, steps, expected, P0-P2, type, automation feasibility) | `/projects/:id/test-cases` |
| 3 | Live RTM: mapping + editable matrix, coverage %, uncovered requirements in red, CSV export | `/projects/:id/rtm` |
| 4 | AI test data generator (valid / invalid / boundary, JSON + CSV export) | `/projects/:id/test-data` |
| 5 | **Export to Automation**: Playwright (TS), Cypress (TS), Selenium (Python) as a ZIP | Test cases → select → *Export to Automation* |
| 6 | API suite generator: endpoint detection → Postman v2.1 collection + REST Assured (JUnit 5) | `/projects/:id/api-tests` |
| 7 | Execution Kanban (Not run / Pass / Fail / Blocked / Skip) → auto-filled bug report, assign by email | `/projects/:id/execution`, `/projects/:id/bugs` |
| 8 | AI visual flow builder (Mermaid) with missing-flow detection, editable source, SVG export | `/projects/:id/flows` |
| 9 | QA dashboard: KPIs, coverage, execution status, bug density, editable Gantt timeline | `/projects/:id` |

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `ENCRYPTION_SECRET` | yes | 32+ random chars; encrypts the Jira API token (AES-256-GCM) |
| `DATABASE_URL` | no | Defaults to `file:./data/qaforge.db`. Use a `libsql://` URL (Turso) for serverless hosting |
| `DATABASE_AUTH_TOKEN` | no | Token for a remote libSQL database |
| `GROQ_API_KEY` | yes (for AI) | Groq API key used by all AI features; server-side only |
| `GROQ_MODEL` | no | Default `openai/gpt-oss-120b` |
| `GROQ_FALLBACK_MODEL` | no | Default `openai/gpt-oss-20b`; used automatically when the main model's daily quota is exhausted |
| `RESEND_API_KEY`, `MAIL_FROM` | no | Email bug assignments; without them a pre-filled `mailto:` draft opens |

## Architecture

```
src/
  app/
    actions/        Server actions (auth, projects, requirements, test-cases, execution, artifacts, settings)
    (app)/          App shell (sidebar) + all module pages
  lib/
    db/             Drizzle schema + libSQL client (auto-migrates on first use)
    ai/             Groq client (strict JSON-schema output + Zod validation + retries), prompts, schemas
    server/         Guards, queries, file parsing, Jira client
  components/       Feature components per module + shadcn/ui
drizzle/            Generated SQL migrations (npm run db:generate after schema changes)
```

**Access.** No accounts: one shared workspace. Anyone who can reach the URL can view and edit all projects, so for a public deployment put it behind your own access control (VPN, SSO proxy, or basic auth at the host).

**Data integrity.** Every project-scoped write verifies the project exists and filters child records by `project_id`; cross-record references (trace links, bug → test case) are checked to belong to the same project.

**AI reliability.** Every call uses Groq strict structured output (`response_format: json_schema`) with a schema generated from a Zod schema; responses are validated with Zod and re-prompted with the validation error on failure. Per-minute rate limits are retried honoring `retry-after`, request sizes are fitted to the plan's tokens-per-minute budget, and when the daily quota runs out the client switches to the fallback model.

**Jira.** Fetches are restricted to `*.atlassian.net` or the user's configured Jira host (SSRF guard).

## Deploying

The local SQLite file needs a persistent disk (any VM, Docker host, Railway, Fly.io with a volume). On Vercel, point `DATABASE_URL`/`DATABASE_AUTH_TOKEN` at a hosted libSQL database (Turso); no code changes are needed.
