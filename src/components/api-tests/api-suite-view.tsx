"use client"

import { useState } from "react"
import { formatDistanceToNow, parseISO } from "date-fns"
import { Download, Loader2, Sparkles, Webhook } from "lucide-react"
import { generateApiSuite } from "@/app/actions/artifacts"
import { CodeViewer } from "@/components/shared/code-viewer"
import { EmptyState } from "@/components/shared/ui-bits"
import type { ApiSuite } from "@/lib/ai/schemas"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useServerAction } from "@/hooks/use-server-action"
import { downloadText } from "@/lib/download"
import { toPostmanCollection } from "@/lib/postman"
import { cn } from "@/lib/utils"
import type { Artifact } from "@/lib/types"

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-info/12 text-info",
  POST: "bg-success/12 text-success",
  PUT: "bg-warning/15 text-amber-700 dark:text-warning",
  PATCH: "bg-fuchsia-500/12 text-fuchsia-600 dark:text-fuchsia-400",
  DELETE: "bg-destructive/12 text-destructive",
}

export function ApiSuiteView({
  projectId,
  projectName,
  latest: initial,
  hasRequirements,
}: {
  projectId: string
  projectName: string
  latest: Artifact<ApiSuite> | null
  hasRequirements: boolean
}) {
  const [artifact, setArtifact] = useState(initial)
  const gen = useServerAction(() => generateApiSuite(projectId), {
    loading: "Detecting endpoints and writing API tests…",
    success: (d) => (d.content.has_api ? `Detected ${d.content.endpoints.length} endpoints` : "No API endpoints found in requirements"),
  })
  const suite = artifact?.content
  const postman = suite?.has_api ? JSON.stringify(toPostmanCollection(projectName, suite), null, 2) : ""
  const slug = projectName.toLowerCase().replace(/\W+/g, "-")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="min-w-0 flex-1 text-sm">
          {artifact ? (
            <>
              <span className="font-medium">{artifact.title}</span>
              <span className="text-muted-foreground"> · generated {formatDistanceToNow(parseISO(artifact.created_at), { addSuffix: true })}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Scan requirements for REST endpoints and generate a Postman collection plus REST Assured tests.</span>
          )}
        </div>
        {suite?.has_api && (
          <>
            <Button variant="outline" onClick={() => downloadText(`${slug}.postman_collection.json`, postman, "application/json")}>
              <Download /> Postman
            </Button>
            <Button variant="outline" onClick={() => downloadText("ApiTests.java", suite.rest_assured_java, "text/x-java")}>
              <Download /> REST Assured
            </Button>
          </>
        )}
        <Button
          disabled={gen.pending || !hasRequirements}
          onClick={async () => {
            const res = await gen.run()
            if (res) setArtifact(res)
          }}
        >
          {gen.pending ? <Loader2 className="animate-spin" /> : <Sparkles />} {artifact ? "Re-scan" : "Detect APIs"}
        </Button>
      </div>

      {!suite ? (
        <EmptyState
          icon={Webhook}
          title={hasRequirements ? "No API suite yet" : "Add requirements first"}
          description="Endpoints mentioned or implied by your requirements are detected automatically."
        />
      ) : !suite.has_api ? (
        <EmptyState icon={Webhook} title="No APIs detected" description="The requirements don't describe HTTP endpoints. Add API specs or user stories that mention endpoints and re-scan." />
      ) : (
        <Tabs defaultValue="endpoints">
          <TabsList>
            <TabsTrigger value="endpoints">Endpoints ({suite.endpoints.length})</TabsTrigger>
            <TabsTrigger value="postman">Postman collection</TabsTrigger>
            <TabsTrigger value="java">REST Assured (Java)</TabsTrigger>
          </TabsList>
          <TabsContent value="endpoints" className="mt-4 space-y-3">
            <div className="text-xs text-muted-foreground">
              Base URL <code className="rounded bg-muted px-1.5 py-0.5">{suite.base_url}</code> · Auth <code className="rounded bg-muted px-1.5 py-0.5">{suite.auth_scheme}</code>
            </div>
            {suite.endpoints.map((ep, i) => (
              <div key={i} className="rounded-xl border bg-card shadow-xs">
                <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
                  <span className={cn("rounded px-2 py-0.5 font-mono text-xs font-semibold", METHOD_COLORS[ep.method])}>{ep.method}</span>
                  <code className="font-mono text-sm">{ep.path}</code>
                  <span className="text-sm text-muted-foreground">{ep.name}</span>
                  <div className="ml-auto flex gap-1">
                    {ep.requirement_codes.map((c) => (
                      <Badge key={c} variant="secondary" className="font-mono text-[10px]">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
                <ul className="divide-y">
                  {ep.tests.map((t, j) => (
                    <li key={j} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                      <span
                        className={cn(
                          "w-10 font-mono text-xs font-semibold",
                          t.expected_status < 300 ? "text-success" : t.expected_status < 500 ? "text-amber-700 dark:text-warning" : "text-destructive",
                        )}
                      >
                        {t.expected_status}
                      </span>
                      <span className="flex-1">{t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.assertions.length} assertions</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="postman" className="mt-4">
            <CodeViewer code={postman} filename={`${slug}.postman_collection.json`} maxHeight="36rem" />
          </TabsContent>
          <TabsContent value="java" className="mt-4">
            <CodeViewer code={suite.rest_assured_java} filename="src/test/java/com/qaforge/api/ApiTests.java" maxHeight="36rem" />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
