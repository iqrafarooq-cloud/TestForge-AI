"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Native-input checkbox with the shadcn look and the Radix-style API (checked / onCheckedChange).
 * Radix's checkbox renders a hidden "bubble" input whose inline styles cause hydration
 * mismatches with React 19.3; a styled native input avoids that and stays fully accessible.
 */
function Checkbox({
  className,
  checked,
  onCheckedChange,
  disabled,
  ...props
}: Omit<React.ComponentProps<"input">, "checked" | "onChange" | "type"> & {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <span className={cn("relative inline-flex size-4 shrink-0 align-middle", className)}>
      <input
        type="checkbox"
        data-slot="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className="peer size-4 cursor-pointer appearance-none rounded-[4px] border border-input bg-background shadow-xs transition-shadow outline-none checked:border-primary checked:bg-primary focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:checked:bg-primary"
        {...props}
      />
      <CheckIcon
        aria-hidden
        className="pointer-events-none absolute inset-0 m-auto size-3.5 text-primary-foreground opacity-0 peer-checked:opacity-100"
      />
    </span>
  )
}

export { Checkbox }
