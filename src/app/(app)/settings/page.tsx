import type { Metadata } from "next"
import { AppearancePanel, JiraSettings } from "@/components/settings/settings-forms"
import { PageHeader } from "@/components/shared/ui-bits"
import { getWorkspaceSettings } from "@/lib/server/queries"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const settings = await getWorkspaceSettings()
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Workspace" title="Settings" description="Preferences for this workspace." />
      <AppearancePanel />
      <JiraSettings baseUrl={settings.jiraBaseUrl} email={settings.jiraEmail} hasToken={settings.hasJiraToken} />
    </div>
  )
}
