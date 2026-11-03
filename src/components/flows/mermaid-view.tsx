"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { AlertTriangle, Loader2 } from "lucide-react"

let initializedTheme: string | null = null

export function MermaidView({ source, onSvg }: { source: string; onSvg?: (svg: string) => void }) {
  const { resolvedTheme } = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const rawId = useId()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const id = `m${rawId.replace(/[^a-zA-Z0-9]/g, "")}${Date.now()}`
    ;(async () => {
      setLoading(true)
      const mermaid = (await import("mermaid")).default
      const theme = resolvedTheme === "dark" ? "dark" : "default"
      if (initializedTheme !== theme) {
        mermaid.initialize({
          startOnLoad: false,
          theme,
          securityLevel: "strict",
          fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui",
          flowchart: { curve: "basis", padding: 12, htmlLabels: true },
        })
        initializedTheme = theme
      }
      try {
        await mermaid.parse(source)
        const { svg } = await mermaid.render(id, source)
        if (cancelled || !ref.current) return
        ref.current.innerHTML = svg
        setError(null)
        onSvg?.(svg)
      } catch (err) {
        if (!cancelled) setError((err as Error)?.message?.split("\n").slice(0, 4).join("\n") ?? "Invalid diagram")
        document.getElementById(`d${id}`)?.remove()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, resolvedTheme])

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="mb-3 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <pre className="font-mono whitespace-pre-wrap">Diagram syntax error. Fix it in the source tab or regenerate.{"\n"}{error}</pre>
        </div>
      )}
      <div ref={ref} className="mermaid-host flex min-h-64 justify-center overflow-auto" />
    </div>
  )
}
