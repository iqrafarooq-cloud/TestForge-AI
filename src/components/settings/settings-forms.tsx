"use client"

import { useSyncExternalStore } from "react"
import { Link2, Loader2, Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { saveJiraSettings } from "@/app/actions/settings"
import { Panel } from "@/components/shared/panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useServerAction } from "@/hooks/use-server-action"
import { cn } from "@/lib/utils"

const THEMES = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
] as const

const noopSubscribe = () => () => {}

export function AppearancePanel() {
  const { theme, setTheme } = useTheme()
  // The stored theme is only known on the client; avoid a mismatched highlight during SSR.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  return (
    <Panel title="Appearance" description="Choose how TestForge looks on this device.">
      <div className="grid grid-cols-3 gap-3">
        {THEMES.map((t) => {
          const active = mounted && theme === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              aria-pressed={active}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-sm font-medium transition-colors",
                active ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20" : "hover:bg-muted",
              )}
            >
              <t.icon className="size-5" />
              {t.label}
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

export function JiraSettings({ baseUrl, email, hasToken }: { baseUrl: string; email: string; hasToken: boolean }) {
  const save = useServerAction(saveJiraSettings, { success: "Jira settings saved" })
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Link2 className="size-4 text-primary" /> Jira integration
          <span className="text-xs font-normal text-muted-foreground">optional</span>
        </span>
      }
      description="Only needed to import private Jira Cloud tickets on the Requirements page."
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          await save.run({
            base_url: String(fd.get("base_url") ?? ""),
            email: String(fd.get("email") ?? ""),
            token: String(fd.get("token") ?? ""),
          })
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="jira-url">Jira base URL</Label>
            <Input id="jira-url" name="base_url" type="url" placeholder="https://acme.atlassian.net" defaultValue={baseUrl} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jira-email">Atlassian email</Label>
            <Input id="jira-email" name="email" type="email" placeholder="you@company.com" defaultValue={email} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="jira-token">API token</Label>
          <Input
            id="jira-token"
            name="token"
            type="password"
            autoComplete="off"
            placeholder={hasToken ? "•••••••••• (leave empty to keep current token)" : "Create one at id.atlassian.com → Security"}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={save.pending}>
            {save.pending && <Loader2 className="animate-spin" />} Save
          </Button>
        </div>
      </form>
    </Panel>
  )
}
