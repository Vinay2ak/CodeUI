import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { env } from "../lib/env";
import { sessionStore, User } from "../session/session";
import { projectApi } from "../services/project/api";
import type { ProjectScope } from "../services/project/types";
import { DeveloperDashboardView } from "../features/dashboard/DeveloperDashboardView";
import { TaskRadarView } from "../features/radar/TaskRadarView";
import { ControlledWorkspaceView } from "../features/workspace/ControlledWorkspaceView";
import { VerifiedPortfolioView } from "../features/portfolio/VerifiedPortfolioView";
import { SidebarInset, SidebarProvider } from "../components/ui/sidebar";
import { FreelancerSidebar, NavKey } from "../components/layout/FreelancerSidebar";
import { SiteHeader } from "../components/layout/SiteHeader";
import { Dialog } from "../components/ui/Dialog";
import { Button } from "../components/ui/Button";
import { Toaster } from "../components/ui/sonner";
import { ErrorBoundary } from "./ErrorBoundary";

const DevDrawer = React.lazy(() =>
  import("../components/dev/DevDrawer").then((m) => ({ default: m.DevDrawer }))
);

type ActiveView = "dashboard" | "radar" | "workspace" | "portfolio" | "settings";

interface ShellProps {
  user: User;
  currentTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  hasTasks: boolean;
}

const VIEW_LABELS: Record<ActiveView, string> = {
  dashboard: "Overview",
  radar: "Tasks radar",
  workspace: "Workspace",
  portfolio: "Verified profile",
  settings: "Settings",
};

export const Shell: React.FC<ShellProps> = ({
  user,
  currentTaskId,
  onSelectTask,
  hasTasks,
}) => {
  void hasTasks;
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [activeNavKey, setActiveNavKey] = useState<NavKey>("overview");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    currentTaskId || null
  );
  const [devDrawerOpen, setDevDrawerOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Dev tools shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (env.devTools && e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setDevDrawerOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Real backend query for projects list to auto-select real active project
  const { data: projects } = useQuery<ProjectScope[]>({
    queryKey: ["projects", "realtime-list"],
    queryFn: async () => {
      try {
        return await projectApi.getProjects();
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });

  // Automatically select the real project from backend when loaded
  useEffect(() => {
    if (projects && projects.length > 0 && !selectedProjectId) {
      const found = currentTaskId
        ? projects.find((p: ProjectScope) => p.id === currentTaskId)
        : undefined;
      const target = found || projects[0];
      if (target) {
        setSelectedProjectId(target.id);
      }
    }
  }, [projects, currentTaskId, selectedProjectId]);

  // Sync currentTaskId if provided
  useEffect(() => {
    if (currentTaskId) {
      setSelectedProjectId(currentTaskId);
    }
  }, [currentTaskId]);

  const handleNavSelect = (key: NavKey) => {
    setActiveNavKey(key);

    if (key === "overview") {
      setActiveView("dashboard");
    } else if (key === "projects") {
      setActiveView("radar");
    } else if (key === "activity") {
      setActiveView("workspace");
    } else if (key === "portfolio") {
      setActiveView("portfolio");
    } else if (key === "settings") {
      setActiveView("settings");
    }
  };

  const handleOpenWorkspace = (projectId: string) => {
    setSelectedProjectId(projectId);
    onSelectTask(projectId);
    setActiveView("workspace");
    setActiveNavKey("activity");
  };

  const navigateTo = (view: ActiveView, navKey: NavKey) => {
    setActiveView(view);
    setActiveNavKey(navKey);
  };

  return (
    <SidebarProvider>
      {/* Skip to Content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>

      <FreelancerSidebar
        user={user}
        activeNavKey={activeNavKey}
        projects={projects || []}
        selectedProjectId={selectedProjectId}
        onSelectNav={handleNavSelect}
        onOpenWorkspace={handleOpenWorkspace}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onLogout={() => sessionStore.logout()}
      />

      <SidebarInset className="min-h-screen bg-background text-foreground">
        <SiteHeader
          sectionLabel={VIEW_LABELS[activeView]}
          activeProjectId={activeView === "workspace" ? selectedProjectId : null}
          onNavigateHome={() => navigateTo("dashboard", "overview")}
          onOpenShortcuts={() => setShortcutsOpen(true)}
        />

        <main id="main-content" className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex-1 flex flex-col min-h-0"
            >
              {activeView === "dashboard" && (
                <ErrorBoundary fallbackTitle="Dashboard Error">
                  <DeveloperDashboardView
                    user={user}
                    onNavigateToRadar={() => navigateTo("radar", "projects")}
                    onNavigateToWorkspace={(id) => handleOpenWorkspace(id)}
                    onNavigateToProfile={() => navigateTo("portfolio", "portfolio")}
                  />
                </ErrorBoundary>
              )}

              {activeView === "radar" && (
                <ErrorBoundary fallbackTitle="Task Radar Error">
                  <TaskRadarView onOpenWorkspace={handleOpenWorkspace} />
                </ErrorBoundary>
              )}

              {activeView === "workspace" && (
                <ErrorBoundary fallbackTitle="Controlled Workspace Error">
                  <ControlledWorkspaceView
                    projectId={selectedProjectId}
                    projects={projects || []}
                    onSelectProject={(id) => {
                      setSelectedProjectId(id);
                      onSelectTask(id);
                    }}
                    onNavigateToPortfolio={() => navigateTo("portfolio", "portfolio")}
                    onNavigateToRadar={() => navigateTo("radar", "projects")}
                  />
                </ErrorBoundary>
              )}

              {activeView === "portfolio" && (
                <ErrorBoundary fallbackTitle="Verified Portfolio Error">
                  <VerifiedPortfolioView
                    user={user}
                    initialTab="profile"
                    onNavigateToRadar={() => navigateTo("radar", "projects")}
                  />
                </ErrorBoundary>
              )}

              {activeView === "settings" && (
                <ErrorBoundary fallbackTitle="Settings Error">
                  <VerifiedPortfolioView
                    user={user}
                    initialTab="settings"
                    onNavigateToRadar={() => navigateTo("radar", "projects")}
                  />
                </ErrorBoundary>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </SidebarInset>

      {/* Keyboard Shortcuts Dialog */}
      <Dialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        title="Keyboard shortcuts"
        description="Global workspace keyboard combinations for navigation and checks."
      >
        <div className="space-y-2.5 text-xs my-4">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-raised border border-border">
            <span className="text-muted">Toggle sidebar</span>
            <kbd className="px-2 py-0.5 rounded-md bg-card border border-border font-mono font-semibold text-foreground">
              Ctrl + B
            </kbd>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-raised border border-border">
            <span className="text-muted">Run project checks</span>
            <kbd className="px-2 py-0.5 rounded-md bg-card border border-border font-mono font-semibold text-foreground">
              Ctrl + Enter
            </kbd>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-raised border border-border">
            <span className="text-muted">Toggle developer diagnostics drawer</span>
            <kbd className="px-2 py-0.5 rounded-md bg-card border border-border font-mono font-semibold text-foreground">
              Ctrl + Shift + D
            </kbd>
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setShortcutsOpen(false)}>
            Close
          </Button>
        </div>
      </Dialog>

      {/* Developer Diagnostics Drawer */}
      {env.devTools && (
        <React.Suspense fallback={null}>
          <DevDrawer
            open={devDrawerOpen}
            onClose={() => setDevDrawerOpen(false)}
            taskId={selectedProjectId || ""}
          />
        </React.Suspense>
      )}

      <Toaster position="bottom-right" />
    </SidebarProvider>
  );
};
