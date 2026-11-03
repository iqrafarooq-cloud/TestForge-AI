"use client"

import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { deleteProject } from "@/app/actions/projects"
import { ConfirmButton } from "@/components/shared/confirm-button"
import { useServerAction } from "@/hooks/use-server-action"

export function DeleteProjectButton({ projectId, name }: { projectId: string; name: string }) {
  const router = useRouter()
  const { run, pending } = useServerAction(deleteProject, { success: "Project deleted" })
  return (
    <ConfirmButton
      title={`Delete "${name}"?`}
      description="This permanently removes all requirements, test cases, executions and defects in this project."
      confirmLabel="Delete project"
      pending={pending}
      onConfirm={async () => {
        const res = await run(projectId)
        if (res !== undefined) router.push("/projects")
      }}
      variant="ghost"
      size="icon"
      aria-label="Delete project"
    >
      <Trash2 />
    </ConfirmButton>
  )
}
