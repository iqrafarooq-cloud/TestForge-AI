import Link from "next/link"
import { SearchX } from "lucide-react"
import { EmptyState } from "@/components/shared/ui-bits"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-svh max-w-xl items-center px-4">
      <EmptyState
        className="w-full"
        icon={SearchX}
        title="Page not found"
        description="This project or page doesn't exist, or you don't have access to it."
        action={
          <Button asChild>
            <Link href="/projects">Back to projects</Link>
          </Button>
        }
      />
    </div>
  )
}
