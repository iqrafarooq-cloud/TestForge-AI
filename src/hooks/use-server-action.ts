"use client"

import { useCallback, useState, useTransition } from "react"
import { toast } from "sonner"
import type { ActionResult } from "@/lib/types"

/**
 * Wraps a server action returning ActionResult with pending state and toasts.
 * Resolves to the data on success, or undefined on failure (after showing the error).
 */
export function useServerAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<ActionResult<T>>,
  opts: { success?: string | ((data: T) => string); loading?: string } = {},
) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    (...args: Args) =>
      new Promise<T | undefined>((resolve) => {
        setError(null)
        const toastId = opts.loading ? toast.loading(opts.loading) : undefined
        startTransition(async () => {
          try {
            const res = await action(...args)
            if (res.ok) {
              const msg = typeof opts.success === "function" ? opts.success(res.data) : opts.success
              if (msg) toast.success(msg, { id: toastId })
              else if (toastId) toast.dismiss(toastId)
              resolve(res.data)
            } else {
              setError(res.error)
              toast.error(res.error, { id: toastId })
              resolve(undefined)
            }
          } catch (err) {
            const message = (err as Error)?.message || "Request failed"
            setError(message)
            toast.error(message, { id: toastId })
            resolve(undefined)
          }
        })
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [action],
  )

  return { run, pending, error }
}
