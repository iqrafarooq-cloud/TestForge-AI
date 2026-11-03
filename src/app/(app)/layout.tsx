import { AppSidebar } from "@/components/layout/app-sidebar"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { listProjects } from "@/lib/server/queries"

// Everything here reads live workspace data from the database; never prerender at build time.
export const dynamic = "force-dynamic"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const projects = await listProjects()

  return (
    <SidebarProvider>
      <AppSidebar projects={projects.map(({ id, name, key }) => ({ id, name, key }))} />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <div className="flex-1" />
          <ThemeToggle />
        </header>
        <div className="flex-1 px-4 py-6 md:px-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
