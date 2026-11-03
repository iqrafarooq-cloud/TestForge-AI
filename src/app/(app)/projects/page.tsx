import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { format, parseISO } from "date-fns"
import { ArrowUpRight, Bug, CalendarRange, FileText, FlaskConical, FolderKanban } from "lucide-react"
import { CreateProjectDialog } from "@/components/projects/create-project-dialog"
import { EmptyState, PageHeader } from "@/components/shared/ui-bits"
import { listProjects } from "@/lib/server/queries"

export const metadata: Metadata = { title: "Projects" }

export default async function ProjectsPage() {
  const projects = await listProjects()
  const dialog = (
    <Suspense>
      <CreateProjectDialog />
    </Suspense>
  )

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Each project carries the full lifecycle: requirements, test design, traceability, execution and defects."
        actions={projects.length > 0 ? dialog : undefined}
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Create your first project"
          description="Upload a PRD or paste a Jira ticket and TestForge will build a traceable test suite from it."
          action={dialog}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group relative flex flex-col rounded-xl border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-fuchsia-500/15 font-mono text-xs font-semibold text-primary">
                  {p.key.slice(0, 3)}
                </div>
                <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              <h3 className="mt-4 truncate font-semibold">{p.name}</h3>
              <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">
                {p.description || "No description"}
              </p>
              <div className="mt-4 flex items-center gap-4 border-t pt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5" title="Requirements">
                  <FileText className="size-3.5" /> {p.requirement_count}
                </span>
                <span className="flex items-center gap-1.5" title="Test cases">
                  <FlaskConical className="size-3.5" /> {p.test_case_count}
                </span>
                <span className="flex items-center gap-1.5" title="Defects">
                  <Bug className="size-3.5" /> {p.bug_count}
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  <CalendarRange className="size-3.5" /> {format(parseISO(p.end_date), "MMM d")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
