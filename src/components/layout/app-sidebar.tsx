"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Bug,
  Check,
  ChevronsUpDown,
  Database,
  FileText,
  FlaskConical,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  Network,
  PlayCircle,
  Plus,
  Settings,
  Table2,
  Webhook,
} from "lucide-react"
import { LogoMark } from "@/components/shared/logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

interface SidebarProject {
  id: string
  name: string
  key: string
}

const PROJECT_NAV = [
  { segment: "", label: "Overview", icon: LayoutDashboard },
  { segment: "requirements", label: "Requirements", icon: FileText },
  { segment: "test-cases", label: "Test Cases", icon: FlaskConical },
  { segment: "test-data", label: "Test Data", icon: Database },
  { segment: "rtm", label: "Traceability", icon: Table2 },
  { segment: "api-tests", label: "API Suite", icon: Webhook },
  { segment: "flows", label: "Flow Builder", icon: GitBranch },
  { segment: "execution", label: "Execution", icon: PlayCircle },
  { segment: "bugs", label: "Defects", icon: Bug },
] as const

export function AppSidebar({ projects }: { projects: SidebarProject[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const match = pathname.match(/^\/projects\/([0-9a-f-]{36})(?:\/([^/]+))?/i)
  const activeProjectId = match?.[1]
  const activeSegment = match?.[2] ?? ""
  const activeProject = projects.find((p) => p.id === activeProjectId)

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <LogoMark />
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-semibold">{activeProject?.name ?? "TestForge AI"}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {activeProject ? `Project · ${activeProject.key}` : "Select a project"}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 opacity-60" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64" align="start" sideOffset={6}>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Projects</DropdownMenuLabel>
                {projects.length === 0 && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">No projects yet</div>
                )}
                {projects.slice(0, 12).map((p) => (
                  <DropdownMenuItem key={p.id} onSelect={() => router.push(`/projects/${p.id}`)}>
                    <span className="flex size-6 items-center justify-center rounded border bg-muted font-mono text-[10px]">
                      {p.key.slice(0, 2)}
                    </span>
                    <span className="truncate">{p.name}</span>
                    {p.id === activeProjectId && <Check className="ml-auto" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push("/projects?new=1")}>
                  <Plus /> New project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="All projects" isActive={pathname === "/projects"}>
                  <Link href="/projects">
                    <FolderKanban />
                    <span>All projects</span>
                  </Link>
                </SidebarMenuButton>
                <SidebarMenuBadge>{projects.length}</SidebarMenuBadge>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {activeProjectId && (
          <SidebarGroup>
            <SidebarGroupLabel>QA lifecycle</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {PROJECT_NAV.map((item) => {
                  const href = `/projects/${activeProjectId}${item.segment ? `/${item.segment}` : ""}`
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton asChild tooltip={item.label} isActive={activeSegment === item.segment}>
                        <Link href={href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!activeProjectId && projects.length > 0 && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Recent</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {projects.slice(0, 6).map((p) => (
                  <SidebarMenuItem key={p.id}>
                    <SidebarMenuButton asChild>
                      <Link href={`/projects/${p.id}`}>
                        <Network />
                        <span>{p.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings" isActive={pathname.startsWith("/settings")}>
              <Link href="/settings">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
