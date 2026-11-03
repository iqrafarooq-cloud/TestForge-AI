"use client"

import { useRef, useState } from "react"
import { formatDistanceToNow, parseISO } from "date-fns"
import { Download, GitBranch, Loader2, Save, Sparkles, Trash2, TriangleAlert } from "lucide-react"
import { deleteArtifact, generateFlow, saveFlowSource } from "@/app/actions/artifacts"
import { MermaidView } from "@/components/flows/mermaid-view"
import { Panel } from "@/components/shared/panel"
import { EmptyState } from "@/components/shared/ui-bits"
import type { FlowDiagram } from "@/lib/ai/schemas"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useServerAction } from "@/hooks/use-server-action"
import { downloadText } from "@/lib/download"
import { cn } from "@/lib/utils"
import type { Artifact } from "@/lib/types"

export function FlowBuilder({
  projectId,
  flows: initial,
  hasRequirements,
}: {
  projectId: string
  flows: Artifact<FlowDiagram>[]
  hasRequirements: boolean
}) {
  const [flows, setFlows] = useState(initial)
  const [activeId, setActiveId] = useState(initial[0]?.id ?? null)
  const [focus, setFocus] = useState("")
  const active = flows.find((f) => f.id === activeId) ?? null
  const [draft, setDraft] = useState<string | null>(null)
  const svgRef = useRef<string>("")

  const gen = useServerAction((f: string) => generateFlow(projectId, f), {
    loading: "Mapping user journeys…",
    success: "Flow diagram generated",
  })
  const save = useServerAction((id: string, src: string) => saveFlowSource(projectId, id, src), { success: "Diagram saved" })
  const del = useServerAction((id: string) => deleteArtifact(projectId, id), { success: "Diagram deleted" })

  const source = draft ?? active?.content.mermaid ?? ""

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-xs sm:flex-row">
        <Input
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="Optional focus, e.g. checkout and payment failures"
          className="h-9"
        />
        <Button
          disabled={gen.pending || !hasRequirements}
          onClick={async () => {
            const res = await gen.run(focus)
            if (res) {
              setFlows((f) => [res, ...f])
              setActiveId(res.id)
              setDraft(null)
            }
          }}
        >
          {gen.pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate flow
        </Button>
      </div>

      {!active ? (
        <EmptyState
          icon={GitBranch}
          title={hasRequirements ? "No flow diagrams yet" : "Add requirements first"}
          description="AI turns requirements into a Mermaid user-journey diagram and highlights flows the spec forgot (dashed red)."
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <Panel
            title={active.title}
            description={`Generated ${formatDistanceToNow(parseISO(active.created_at), { addSuffix: true })}`}
            actions={
              <>
                <Button variant="outline" size="sm" onClick={() => downloadText(`${active.title.replace(/\W+/g, "-")}.mmd`, source)}>
                  <Download /> .mmd
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => svgRef.current && downloadText(`${active.title.replace(/\W+/g, "-")}.svg`, svgRef.current, "image/svg+xml")}
                >
                  <Download /> SVG
                </Button>
              </>
            }
          >
            <Tabs defaultValue="diagram">
              <TabsList className="mb-4">
                <TabsTrigger value="diagram">Diagram</TabsTrigger>
                <TabsTrigger value="source">Mermaid source</TabsTrigger>
              </TabsList>
              <TabsContent value="diagram">
                <div className="bg-grid rounded-lg border p-4">
                  <MermaidView source={source} onSvg={(s) => (svgRef.current = s)} />
                </div>
              </TabsContent>
              <TabsContent value="source" className="space-y-3">
                <Textarea
                  value={source}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={20}
                  className="font-mono text-xs"
                  spellCheck={false}
                />
                <div className="flex justify-end gap-2">
                  {draft !== null && (
                    <Button variant="ghost" onClick={() => setDraft(null)}>
                      Discard
                    </Button>
                  )}
                  <Button
                    disabled={draft === null || save.pending}
                    onClick={async () => {
                      if (draft === null) return
                      const ok = await save.run(active.id, draft)
                      if (ok !== undefined) {
                        setFlows((f) => f.map((x) => (x.id === active.id ? { ...x, content: { ...x.content, mermaid: draft } } : x)))
                        setDraft(null)
                      }
                    }}
                  >
                    {save.pending ? <Loader2 className="animate-spin" /> : <Save />} Save source
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </Panel>

          <div className="space-y-6">
            <Panel
              title={
                <span className="flex items-center gap-1.5">
                  <TriangleAlert className="size-4 text-destructive" /> Missing flows
                </span>
              }
              description="Journeys users expect that the requirements don't cover"
              bodyClassName="p-0"
            >
              {active.content.missing_flows.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">No gaps detected.</p>
              ) : (
                <ul className="divide-y">
                  {active.content.missing_flows.map((m, i) => (
                    <li key={i} className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{m.title}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "ml-auto capitalize",
                            m.severity === "high" && "border-destructive/40 text-destructive",
                            m.severity === "medium" && "border-warning/50 text-amber-700 dark:text-warning",
                          )}
                        >
                          {m.severity}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Journeys" bodyClassName="p-0">
              <ul className="divide-y">
                {active.content.journeys.map((j, i) => (
                  <li key={i} className="px-5 py-2.5 text-sm">
                    {j.name}
                    <div className="font-mono text-[11px] text-muted-foreground">{j.requirement_codes.join(", ")}</div>
                  </li>
                ))}
              </ul>
            </Panel>
            {flows.length > 1 && (
              <Panel title="History" bodyClassName="p-1.5">
                <ul>
                  {flows.map((f) => (
                    <li key={f.id} className="group flex items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveId(f.id)
                          setDraft(null)
                        }}
                        className={cn(
                          "flex-1 truncate rounded-md px-2.5 py-1.5 text-left text-sm",
                          f.id === activeId ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                        )}
                      >
                        {f.title}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 opacity-0 group-hover:opacity-100"
                        aria-label="Delete diagram"
                        onClick={async () => {
                          if ((await del.run(f.id)) === undefined) return
                          const rest = flows.filter((x) => x.id !== f.id)
                          setFlows(rest)
                          if (activeId === f.id) setActiveId(rest[0]?.id ?? null)
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
