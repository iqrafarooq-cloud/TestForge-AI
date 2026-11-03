"use client"

import { useRef, useState } from "react"
import { AlertTriangle, FileUp, Link2, Loader2, Sparkles, Type, UploadCloud, X } from "lucide-react"
import { ingestRequirements, type IngestResult } from "@/app/actions/requirements"
import { Panel } from "@/components/shared/panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useServerAction } from "@/hooks/use-server-action"
import { cn } from "@/lib/utils"

const ACCEPT = ".pdf,.docx,.txt,.md"

export function IngestPanel({ projectId }: { projectId: string }) {
  const [mode, setMode] = useState<"file" | "jira" | "text">("file")
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<IngestResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { run, pending } = useServerAction(ingestRequirements, {
    loading: "Analyzing source with AI…",
    success: (d) => `Extracted ${d.created} requirements`,
  })

  async function submit(form: HTMLFormElement) {
    const fd = new FormData(form)
    fd.set("projectId", projectId)
    fd.set("mode", mode)
    if (mode === "file") {
      if (!file) return
      fd.set("file", file)
    }
    const res = await run(fd)
    if (res) {
      setResult(res)
      setFile(null)
      form.reset()
    }
  }

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> Smart requirement ingestion
        </span>
      }
      description="AI extracts functional, non-functional, edge and negative requirements with criticality analysis."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit(e.currentTarget)
        }}
      >
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="mb-4">
            <TabsTrigger value="file">
              <FileUp /> PRD upload
            </TabsTrigger>
            <TabsTrigger value="jira">
              <Link2 /> Jira ticket
            </TabsTrigger>
            <TabsTrigger value="text">
              <Type /> Plain text
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file">
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                const f = e.dataTransfer.files?.[0]
                if (f) setFile(f)
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
                dragging ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/40",
              )}
            >
              <UploadCloud className="size-8 text-muted-foreground" />
              {file ? (
                <div className="flex items-center gap-2 text-sm font-medium">
                  {file.name}
                  <span className="text-xs font-normal text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="Remove file"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFile(null)
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium">Drop a PRD here or click to browse</p>
                  <p className="text-xs text-muted-foreground">PDF, DOCX, TXT or MD · up to 10 MB</p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </TabsContent>

          <TabsContent value="jira" className="space-y-2">
            <Label htmlFor="jiraUrl">Jira ticket URL</Label>
            <Input
              id="jiraUrl"
              name="jiraUrl"
              type="url"
              required={mode === "jira"}
              placeholder="https://acme.atlassian.net/browse/PAY-142"
            />
            <p className="text-xs text-muted-foreground">
              Private tickets need your Jira email + API token in Settings. Description, subtasks and labels are imported.
            </p>
          </TabsContent>

          <TabsContent value="text" className="space-y-2">
            <Label htmlFor="text">Requirements, user stories or notes</Label>
            <Textarea
              id="text"
              name="text"
              rows={8}
              required={mode === "text"}
              placeholder={"As a shopper I want to apply a promo code at checkout so that I get a discount.\n- Codes are case-insensitive\n- Expired codes show an error…"}
            />
          </TabsContent>
        </Tabs>

        <div className="mt-4 flex items-center justify-end gap-3">
          {pending && <span className="text-xs text-muted-foreground">Large PRDs can take 20-60 seconds.</span>}
          <Button type="submit" disabled={pending || (mode === "file" && !file)}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Extract requirements
          </Button>
        </div>
      </form>

      {result && (
        <div className="mt-5 space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm">{result.summary}</p>
            <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label="Dismiss" onClick={() => setResult(null)}>
              <X className="size-3.5" />
            </Button>
          </div>
          {result.risk_notes.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-warning">
                <AlertTriangle className="size-3.5" /> Gaps & ambiguities found
              </div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {result.risk_notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}
