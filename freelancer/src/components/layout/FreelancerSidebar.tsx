import React from "react";
import { motion } from "framer-motion";
import {
  Code2,
  LayoutDashboard,
  Compass,
  TerminalSquare,
  Award,
  Settings,
  ChevronsUpDown,
  LogOut,
  User as UserIcon,
  Keyboard,
  FolderGit2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { User } from "@/session/session";
import type { ProjectScope } from "@/services/project/types";

export type NavKey =
  | "overview"
  | "projects"
  | "activity"
  | "portfolio"
  | "settings";

interface FreelancerSidebarProps {
  user: User;
  activeNavKey: NavKey;
  projects: ProjectScope[];
  selectedProjectId: string | null;
  onSelectNav: (key: NavKey) => void;
  onOpenWorkspace: (projectId: string) => void;
  onOpenShortcuts: () => void;
  onLogout: () => void;
}

const NAV_ITEMS: { key: NavKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "projects", label: "Tasks radar", icon: Compass },
  { key: "activity", label: "Workspace", icon: TerminalSquare },
  { key: "portfolio", label: "Verified profile", icon: Award },
  { key: "settings", label: "Settings", icon: Settings },
];

export const FreelancerSidebar: React.FC<FreelancerSidebarProps> = ({
  user,
  activeNavKey,
  projects,
  selectedProjectId,
  onSelectNav,
  onOpenWorkspace,
  onOpenShortcuts,
  onLogout,
}) => {
  const { isMobile, setOpenMobile } = useSidebar();
  const initials = (user.displayName || "FL")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleNavClick = (key: NavKey) => {
    onSelectNav(key);
    if (isMobile) setOpenMobile(false);
  };

  const handleProjectClick = (id: string) => {
    onOpenWorkspace(id);
    if (isMobile) setOpenMobile(false);
  };

  const quickProjects = projects.slice(0, 4);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              onClick={() => handleNavClick("overview")}
              tooltip="CodeBridge Freelancer portal"
              className="rounded-xl hover:bg-sidebar-accent"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
                <Code2 className="size-4" aria-hidden="true" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold tracking-tight text-foreground">
                  CodeBridge
                </span>
                <span className="truncate text-xs text-muted">
                  Freelancer portal
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = activeNavKey === item.key;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      onClick={() => handleNavClick(item.key)}
                      className="relative rounded-xl h-9 transition-colors data-[active=true]:bg-transparent data-[active=true]:text-primary-foreground"
                    >
                      {isActive && (
                        <motion.span
                          layoutId="freelancer-sidebar-pill"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          className="absolute inset-0 rounded-xl bg-primary shadow-sm -z-0"
                        />
                      )}
                      <Icon
                        className={`relative z-10 size-4 ${
                          isActive ? "text-primary-foreground" : "text-muted"
                        }`}
                        aria-hidden="true"
                      />
                      <span
                        className={`relative z-10 font-medium ${
                          isActive ? "text-primary-foreground" : "text-foreground"
                        }`}
                      >
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {quickProjects.length > 0 && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel className="text-xs font-medium text-muted">
              Active scopes
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {quickProjects.map((proj) => {
                  const isCurrent =
                    activeNavKey === "activity" && selectedProjectId === proj.id;
                  return (
                    <SidebarMenuItem key={proj.id}>
                      <SidebarMenuButton
                        isActive={isCurrent}
                        onClick={() => handleProjectClick(proj.id)}
                        className="rounded-xl h-8 text-xs"
                      >
                        <FolderGit2 className="size-3.5 text-muted shrink-0" aria-hidden="true" />
                        <span className="truncate">{proj.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="rounded-xl data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-xl border border-border">
                    <AvatarFallback className="rounded-xl bg-raised text-xs font-semibold text-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold text-foreground">
                      {user.displayName}
                    </span>
                    <span className="truncate text-xs text-muted">{user.email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted" aria-hidden="true" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl border-border bg-card"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2.5 px-2 py-2 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-xl border border-border">
                      <AvatarFallback className="rounded-xl bg-raised text-xs font-semibold text-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold text-foreground">
                        {user.displayName}
                      </span>
                      <span className="truncate text-xs text-muted">{user.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="rounded-lg cursor-pointer"
                    onClick={() => handleNavClick("portfolio")}
                  >
                    <UserIcon className="mr-2 size-4" aria-hidden="true" />
                    <span>Verified profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="rounded-lg cursor-pointer"
                    onClick={() => handleNavClick("settings")}
                  >
                    <Settings className="mr-2 size-4" aria-hidden="true" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="rounded-lg cursor-pointer"
                    onClick={onOpenShortcuts}
                  >
                    <Keyboard className="mr-2 size-4" aria-hidden="true" />
                    <span>Keyboard shortcuts</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer text-danger focus:text-danger"
                  onClick={onLogout}
                >
                  <LogOut className="mr-2 size-4" aria-hidden="true" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
