"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { encrypt } from "@/lib/crypto"
import { getDb, schema } from "@/lib/db"
import { safe, UserError } from "@/lib/server/guard"

const jiraInput = z.object({
  base_url: z.union([z.url({ protocol: /^https$/ }), z.literal("")]),
  email: z.union([z.email(), z.literal("")]),
  token: z.string().trim().max(400).optional(),
})

export async function saveJiraSettings(input: z.input<typeof jiraInput>) {
  return safe(async () => {
    const parsed = jiraInput.safeParse(input)
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message)
    const db = await getDb()
    const update: { jira_base_url: string | null; jira_email: string | null; jira_token_encrypted?: string | null } = {
      jira_base_url: parsed.data.base_url ? new URL(parsed.data.base_url).origin : null,
      jira_email: parsed.data.email || null,
    }
    if (parsed.data.token) update.jira_token_encrypted = encrypt(parsed.data.token)
    if (!parsed.data.email) update.jira_token_encrypted = null
    await db
      .insert(schema.workspaceSettings)
      .values({ id: "default", ...update })
      .onConflictDoUpdate({ target: schema.workspaceSettings.id, set: update })
    revalidatePath("/settings")
    return null
  })
}
