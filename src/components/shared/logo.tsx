import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-sm shadow-primary/30",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-4.5" aria-hidden>
        <path d="M5 4h11l-2.5 4H9v3h5l-2.5 4H9v5H5V4Z" fill="currentColor" />
        <path d="m14 15 2 2 4-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="leading-none">
        <div className="text-[15px] font-semibold tracking-tight">TestForge</div>
        <div className="mt-0.5 text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">AI Quality OS</div>
      </div>
    </div>
  )
}
