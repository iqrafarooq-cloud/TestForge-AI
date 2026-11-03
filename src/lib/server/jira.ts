import "server-only"
import { eq } from "drizzle-orm"
import { decrypt } from "@/lib/crypto"
import { getDb, schema } from "@/lib/db"
import { UserError } from "@/lib/server/guard"

interface AdfNode {
  type?: string
  text?: string
  content?: AdfNode[]
}

function adfToText(node: AdfNode | null | undefined): string {
  if (!node) return ""
  if (node.type === "text") return node.text ?? ""
  const inner = (node.content ?? []).map(adfToText).join("")
  switch (node.type) {
    case "paragraph":
    case "heading":
      return `${inner}\n`
    case "listItem":
      return `- ${inner.trim()}\n`
    case "hardBreak":
      return "\n"
    case "codeBlock":
      return `\n${inner}\n`
    default:
      return inner
  }
}

export function parseJiraUrl(raw: string) {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new UserError("Enter a valid Jira ticket URL, e.g. https://acme.atlassian.net/browse/PAY-142")
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UserError("Jira URL must use http(s).")
  const key =
    url.pathname.match(/\/browse\/([A-Z][A-Z0-9_]+-\d+)/i)?.[1] ??
    url.searchParams.get("selectedIssue") ??
    url.pathname.match(/([A-Z][A-Z0-9_]+-\d+)/i)?.[1]
  if (!key) throw new UserError("Could not find an issue key (like PAY-142) in that URL.")
  return { base: `${url.protocol}//${url.host}`, key: key.toUpperCase() }
}

export async function fetchJiraIssue(rawUrl: string) {
  const { base, key } = parseJiraUrl(rawUrl)
  const db = await getDb()
  const [profile] = await db.select().from(schema.workspaceSettings).where(eq(schema.workspaceSettings.id, "default")).limit(1)

  // Only call Atlassian Cloud or the Jira host the user configured, never arbitrary hosts (SSRF).
  const host = new URL(base).host.toLowerCase()
  const configuredHost = profile?.jira_base_url ? new URL(profile.jira_base_url).host.toLowerCase() : null
  if (!host.endsWith(".atlassian.net") && host !== configuredHost) {
    throw new UserError("Only *.atlassian.net or the Jira base URL configured in Settings can be imported.")
  }
  if (new URL(base).protocol !== "https:") throw new UserError("Jira URL must use https.")

  const headers: Record<string, string> = { Accept: "application/json" }
  if (profile?.jira_email && profile?.jira_token_encrypted) {
    const token = decrypt(profile.jira_token_encrypted)
    headers.Authorization = `Basic ${Buffer.from(`${profile.jira_email}:${token}`).toString("base64")}`
  }

  let res: Response
  try {
    res = await fetch(
      `${base}/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,description,issuetype,priority,labels,subtasks,components`,
      { headers, cache: "no-store", signal: AbortSignal.timeout(15000), redirect: "error" },
    )
  } catch {
    throw new UserError(`Could not reach ${base}.`)
  }

  if (res.status === 401 || res.status === 403 || res.status === 404) {
    throw new UserError(
      headers.Authorization
        ? `Jira returned ${res.status} for ${key}. Check the issue key and your Jira credentials in Settings.`
        : `Jira returned ${res.status}. Add your Jira email and API token in Settings to read private tickets.`,
    )
  }
  if (!res.ok) throw new UserError(`Jira request failed with status ${res.status}.`)
  if (!res.headers.get("content-type")?.includes("json")) {
    throw new UserError("That URL did not return a Jira issue. Check that it points to a Jira Cloud ticket.")
  }

  const issue = (await res.json()) as {
    key: string
    fields: {
      summary: string
      description: AdfNode | string | null
      issuetype?: { name: string }
      priority?: { name: string }
      labels?: string[]
      components?: { name: string }[]
      subtasks?: { key: string; fields: { summary: string } }[]
    }
  }
  const f = issue.fields
  const description = typeof f.description === "string" ? f.description : adfToText(f.description)
  const text = [
    `Jira ${issue.key} (${f.issuetype?.name ?? "Issue"}, priority ${f.priority?.name ?? "n/a"})`,
    `Summary: ${f.summary}`,
    f.labels?.length ? `Labels: ${f.labels.join(", ")}` : "",
    f.components?.length ? `Components: ${f.components.map((c) => c.name).join(", ")}` : "",
    "",
    description,
    f.subtasks?.length ? `\nSubtasks:\n${f.subtasks.map((s) => `- ${s.key}: ${s.fields.summary}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
  return { key: issue.key, title: `${issue.key}: ${f.summary}`, text }
}
