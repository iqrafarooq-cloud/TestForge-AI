"use client"

import { useEffect } from "react"
import { RotateCcw, ServerCrash } from "lucide-react"
import { EmptyState } from "@/components/shared/ui-bits"
import { Button } from "@/components/ui/button"

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <div className="mx-auto max-w-xl py-16">
      <EmptyState
        icon={ServerCrash}
        title="Something went wrong"
        description={error.message || "An unexpected error occurred while loading this page."}
        action={
          <Button onClick={reset}>
            <RotateCcw /> Try again
          </Button>
        }
      />
    </div>
  )
}
