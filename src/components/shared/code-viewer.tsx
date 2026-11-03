"use client"

import { useState } from "react"
import { Check, Copy, Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { downloadText } from "@/lib/download"
import { cn } from "@/lib/utils"

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("size-7", className)}
      aria-label="Copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          toast.error("Clipboard is not available in this browser")
        }
      }}
    >
      {copied ? <Check className="text-success" /> : <Copy />}
    </Button>
  )
}

export function CodeViewer({
  code,
  filename,
  className,
  maxHeight = "28rem",
}: {
  code: string
  filename?: string
  className?: string
  maxHeight?: string
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-zinc-950 text-zinc-100 dark:bg-black/40", className)}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="truncate font-mono text-xs text-zinc-400">{filename ?? "snippet"}</span>
        <div className="flex items-center text-zinc-300 [&_button:hover]:bg-white/10 [&_button:hover]:text-white">
          <CopyButton text={code} />
          {filename && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Download"
              onClick={() => downloadText(filename.split("/").pop() ?? filename, code)}
            >
              <Download />
            </Button>
          )}
        </div>
      </div>
      <pre className="overflow-auto p-4 font-mono text-[12.5px] leading-relaxed" style={{ maxHeight }}>
        <code>{code}</code>
      </pre>
    </div>
  )
}
