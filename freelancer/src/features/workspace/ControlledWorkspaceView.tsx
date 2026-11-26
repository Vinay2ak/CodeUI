import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Server,
  Radio,
  ChevronRight,
  ShieldCheck,
  GitBranch,
  Copy,
  ExternalLink,
  Eye,
  Lock,
} from "lucide-react";
import { projectApi } from "../../services/project/api";
import { githubReadOnlyApi, type ProjectRepoStatus } from "@/services/github/api";
import { ReadOnlyRepoViewer } from "@/features/code/ReadOnlyRepoViewer";
import type { ProjectScope } from "../../services/project/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyINR } from "../../lib/format";
import { Select } from "../../components/ui/Select";

interface ControlledWorkspaceViewProps {
  projectId: string | null;
  projects?: ProjectScope[];
  onSelectProject?: (projectId: string) => void;
  onNavigateToPortfolio: () => void;
  onNavigateToRadar?: () => void;
}

function formatStateLabel(raw: string): string {
  const spaced = raw.replace(/_/g, " ").trim().toLowerCase();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "Open";
}

export const ControlledWorkspaceView: React.FC<ControlledWorkspaceViewProps> = ({
  projectId,
  projects: propProjects,
  onSelectProject,
  onNavigateToPortfolio,
  onNavigateToRadar,
}) => {
  void onNavigateToPortfolio;

  const { data: remoteProjects, isLoading: projectsLoading } = useQuery<ProjectScope[]>({
    queryKey: ["projects", "realtime-list"],
    queryFn: () => projectApi.getProjects(),
    staleTime: 30_000,
  });

  const availableProjects =
    propProjects && propProjects.length > 0
      ? propProjects
      : remoteProjects || [];

  const activeProjectId = projectId || availableProjects[0]?.id || null;

  const { data: projectDetails, isLoading: projectLoading } = useQuery<ProjectScope | null>({
    queryKey: ["project", activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return null;
      try {
        return await projectApi.getProject(activeProjectId);
      } catch {
        return availableProjects.find((p) => p.id === activeProjectId) || null;
      }
    },
    enabled: !!activeProjectId,
    staleTime: 15_000,
  });

  const activeProject =
    projectDetails || availableProjects.find((p) => p.id === activeProjectId) || null;

  const [repoViewerOpen, setRepoViewerOpen] = useState(false);

  const { data: liveRepoStatus } = useQuery<ProjectRepoStatus>({
    queryKey: [
      "project-github-status",
      activeProject?.id,
      activeProject?.github?.repoName,
      activeProject?.github?.repoUrl,
    ],
    queryFn: () =>
      githubReadOnlyApi.getProjectRepoStatus(
        activeProject!.id,
        activeProject?.github
      ),
    enabled: Boolean(activeProject?.id),
    staleTime: 30_000,
  });

  const repoStatus: ProjectRepoStatus | null = activeProject
    ? liveRepoStatus ?? {
        connected: Boolean(
          activeProject.github?.repoName &&
            activeProject.github.repoName !== "codebridge/payments-service"
        ),
        fullName:
          activeProject.github?.repoName || "codebridge/payments-service",
        htmlUrl: activeProject.github?.repoUrl || null,
        defaultBranch: activeProject.github?.defaultBranch || "main",
        isPrivate: Boolean(activeProject.github?.isPrivate),
        description: activeProject.github?.description || null,
        source: activeProject.github?.repoUrl ? "project_url" : "placeholder",
      }
    : null;

  const handleCopyId = (id: string) => {
    navigator.clipboard?.writeText(id);
    toast.success(`Copied ${id}`);
  };

  if (projectsLoading || (activeProjectId && projectLoading && !activeProject)) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-background text-foreground">
        <Card className="max-w-md w-full p-8 rounded-2xl border-border bg-card text-center space-y-4">
          <div className="h-10 w-10 rounded-xl bg-raised border border-border flex items-center justify-center mx-auto text-primary dark:text-accent animate-pulse">
            <Server className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm text-muted">Loading workspace details...</p>
        </Card>
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-background text-foreground">
        <Card className="max-w-md w-full p-8 rounded-2xl border-border bg-card text-center space-y-4 shadow-sm">
          <div className="h-12 w-12 rounded-2xl bg-raised border border-border flex items-center justify-center mx-auto text-primary dark:text-accent">
            <Server className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">No active task in workspace</h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Accept a task from Tasks radar to load project specifications and launch your workspace.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={onNavigateToRadar}
            className="w-full rounded-xl justify-center"
          >
            <Radio className="h-4 w-4 mr-1.5" aria-hidden="true" />
            <span>Browse available tasks</span>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-background p-4 sm:p-6 lg:p-8 text-foreground min-w-0">
      <div className="max-w-5xl mx-auto space-y-6 min-w-0">
        {/* Navigation Breadcrumb & Header */}
        <div className="space-y-3 pb-4 border-b border-border min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted min-w-0">
            <button
              type="button"
              onClick={onNavigateToRadar}
              className="hover:text-primary dark:hover:text-accent transition-colors flex items-center gap-1 font-medium shrink-0"
            >
              <Radio className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tasks</span>
            </button>
            <ChevronRight className="h-3 w-3 text-muted shrink-0" aria-hidden="true" />
            <button
              type="button"
              onClick={() => handleCopyId(activeProject.id)}
              className="inline-flex items-center gap-1 font-mono tabular-nums text-foreground font-medium hover:text-primary dark:hover:text-accent transition-colors min-w-0 max-w-full"
              title="Click to copy Task ID"
            >
              <span className="truncate">{activeProject.id}</span>
              <Copy className="h-3 w-3 text-muted shrink-0" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
            <div className="space-y-1.5 min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words [overflow-wrap:anywhere]">
                {activeProject.title}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="font-medium text-foreground">
                  {activeProject.ownerName || "CodeBridge Client"}
                </span>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => handleCopyId(activeProject.id)}
                  className="font-mono tabular-nums text-xs bg-card px-2 py-0.5 rounded-lg border border-border hover:border-ring transition-colors"
                >
                  {activeProject.id}
                </button>

                {availableProjects.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 sm:mt-0 sm:ml-2">
                    <span className="text-xs text-muted">Switch task:</span>
                    <Select
                      size="sm"
                      value={activeProject.id}
                      onChange={(newId) => onSelectProject?.(newId)}
                      options={availableProjects.map((p) => ({
                        value: p.id,
                        label: `${p.title.slice(0, 40)} (${p.id})`,
                      }))}
                      aria-label="Switch task"
                      className="w-full sm:w-auto min-w-[160px] sm:min-w-[180px] max-w-full sm:max-w-[280px]"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Quiet Sentence-Case Escrow & State Pills */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {activeProject.budget > 0 && (
                <div className="px-3 py-1 rounded-full text-xs font-medium bg-success-bg text-success border border-success-border flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="font-mono tabular-nums font-semibold">
                    {formatCurrencyINR(activeProject.budget)}
                  </span>
                  <span>held in escrow</span>
                </div>
              )}
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-card text-foreground border border-border flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary dark:bg-accent" aria-hidden="true" />
                <span>{formatStateLabel(activeProject.projectState)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Project Specification Card */}
        <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">
              Project specification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 min-w-0">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere]">
              {activeProject.description || "No description provided for this task."}
            </p>

            {activeProject.expectedResult && (
              <div className="space-y-2 pt-4 border-t border-border min-w-0">
                <h3 className="text-sm font-semibold text-foreground">
                  Expected deliverable and acceptance scope
                </h3>
                <div className="p-3.5 rounded-xl bg-background border border-border text-sm text-foreground leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere] min-w-0">
                  {activeProject.expectedResult}
                </div>
              </div>
            )}

            {activeProject.skills && activeProject.skills.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-border min-w-0">
                <h3 className="text-xs font-semibold text-muted">
                  Required tech stack
                </h3>
                <div className="flex flex-wrap gap-2">
                  {activeProject.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 rounded-xl text-xs font-medium bg-background border border-border text-foreground break-words [overflow-wrap:anywhere] max-w-full"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {repoStatus && (
              <div className="space-y-2 pt-4 border-t border-border min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-xs font-semibold text-muted">
                    Repository information
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-background border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted">
                    <Lock className="h-3 w-3 text-primary dark:text-accent" aria-hidden="true" />
                    Read-only snapshot access
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <GitBranch className="h-4 w-4 text-primary dark:text-accent shrink-0" aria-hidden="true" />
                    {repoStatus.htmlUrl ? (
                      <a
                        href={repoStatus.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-primary dark:text-accent font-semibold break-all hover:underline inline-flex items-center gap-1.5"
                        title="Open repository on GitHub (read-only)"
                      >
                        <span>{repoStatus.fullName}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRepoViewerOpen(true)}
                        className="font-mono text-foreground font-semibold break-all hover:text-primary dark:hover:text-accent hover:underline text-left"
                      >
                        {repoStatus.fullName}
                      </button>
                    )}
                    <span className="font-mono text-muted">
                      ({repoStatus.defaultBranch || "main"})
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRepoViewerOpen(true)}
                    className="h-8 gap-1.5 text-xs shrink-0 self-start sm:self-auto"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    Browse repository
                  </Button>
                </div>
                {repoStatus.description && (
                  <p className="text-xs text-muted leading-relaxed">
                    {repoStatus.description}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {repoStatus && (
        <ReadOnlyRepoViewer
          open={repoViewerOpen}
          onOpenChange={setRepoViewerOpen}
          projectId={activeProject.id}
          repoStatus={repoStatus}
        />
      )}
    </div>
  );
};
