import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertCircle,
  RefreshCw,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  ArrowRight,
  Search,
  Copy,
  ExternalLink,
  Eye,
  Lock,
} from "lucide-react";
import { projectApi } from "../../services/project/api";
import { githubReadOnlyApi, type ProjectRepoStatus } from "../../services/github/api";
import { ReadOnlyRepoViewer } from "../code/ReadOnlyRepoViewer";
import { workspaceApi } from "../../services/workspace/api";
import { paymentApi } from "../../services/payment/api";
import { profileApi } from "../../services/profile/api";
import type { ProjectScope } from "../../services/project/types";
import { claimTaskId, getClaimedTaskIds, unclaimTaskId } from "../../lib/claimedTasks";
import { formatCurrencyINR } from "../../lib/format";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/Skeleton";

interface TaskRadarViewProps {
  onOpenWorkspace: (projectId: string) => void;
  selectedTaskId?: string;
}

const PAYMENT_MODE: "simulated" | "live" = "simulated";

type EscrowStepKey = "authorized" | "held" | "release_pending" | "released";
type RadarFilter = "all" | "matched" | "in_progress";

interface EscrowStep {
  key: EscrowStepKey;
  label: string;
}

const ESCROW_STEPS: EscrowStep[] = [
  { key: "authorized", label: "Authorized" },
  { key: "held", label: "Held" },
  { key: "release_pending", label: "Release pending" },
  { key: "released", label: "Released" },
];

const FILTER_OPTIONS: { id: RadarFilter; label: string }[] = [
  { id: "all", label: "All tasks" },
  { id: "matched", label: "Matched stack" },
  { id: "in_progress", label: "In progress" },
];

export const TaskRadarView: React.FC<TaskRadarViewProps> = ({
  onOpenWorkspace,
  selectedTaskId,
}) => {
  const queryClient = useQueryClient();
  const [taskAcceptedMap, setTaskAcceptedMap] = useState<Record<string, boolean>>(() => {
    const claimed = getClaimedTaskIds();
    return claimed.reduce<Record<string, boolean>>((acc, id) => {
      acc[id] = true;
      return acc;
    }, {});
  });
  const [taskDeclinedMap, setTaskDeclinedMap] = useState<Record<string, boolean>>({});
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");
  const [selectedProjectForModal, setSelectedProjectForModal] =
    useState<ProjectScope | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<RadarFilter>("all");

  const { data: userSkills = [] } = useQuery<string[]>({
    queryKey: ["freelancer", "skills"],
    queryFn: () => profileApi.getFreelancerSkills(),
    staleTime: 60_000,
  });

  const {
    data: projects,
    isLoading: projectsLoading,
    isError: projectsError,
    error: projectErrorDetails,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: ["projects", "realtime-list"],
    queryFn: async () => {
      return await projectApi.getProjects();
    },
    staleTime: 30_000,
    retry: 1,
  });

  const computeSkillMatch = (project: ProjectScope, skills: string[]) => {
    if (!skills || skills.length === 0) {
      return { matched: true, matchedSkills: [] as string[], matchPercentage: 100 };
    }
    const pSkills = project.skills || [];
    if (pSkills.length === 0) {
      return { matched: true, matchedSkills: [] as string[], matchPercentage: 100 };
    }
    const matched = pSkills.filter((ps) =>
      skills.some((us) => us.trim().toLowerCase() === ps.trim().toLowerCase())
    );
    const percentage = Math.round((matched.length / pSkills.length) * 100);
    return {
      matched: matched.length > 0,
      matchedSkills: matched,
      matchPercentage: percentage,
    };
  };

  const sortedProjects = React.useMemo(() => {
    if (!projects || projects.length === 0) return [];
    if (userSkills.length === 0) return projects;
    return [...projects].sort((a, b) => {
      const matchA = computeSkillMatch(a, userSkills).matchedSkills.length;
      const matchB = computeSkillMatch(b, userSkills).matchedSkills.length;
      return matchB - matchA;
    });
  }, [projects, userSkills]);

  const filteredProjects = React.useMemo(() => {
    return sortedProjects.filter((project) => {
      const isAccepted =
        taskAcceptedMap[project.id] || project.projectState === "in_progress";
      if (activeFilter === "in_progress" && !isAccepted) return false;
      if (activeFilter === "matched") {
        const match = computeSkillMatch(project, userSkills);
        if (!match.matched) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = project.title.toLowerCase().includes(q);
        const inDesc = (project.description || "").toLowerCase().includes(q);
        const inId = project.id.toLowerCase().includes(q);
        const inSkills = (project.skills || []).some((s) =>
          s.toLowerCase().includes(q)
        );
        return inTitle || inDesc || inId || inSkills;
      }
      return true;
    });
  }, [sortedProjects, activeFilter, searchQuery, taskAcceptedMap, userSkills]);

  useEffect(() => {
    if (selectedTaskId && sortedProjects.length > 0) {
      const found = sortedProjects.find((p) => p.id === selectedTaskId);
      if (found) {
        setSelectedProjectForModal(found);
      }
    }
  }, [selectedTaskId, sortedProjects]);

  const { data: taskDetails } = useQuery({
    queryKey: ["task", selectedProjectForModal?.id],
    queryFn: async () => {
      if (!selectedProjectForModal?.id) return null;
      try {
        return await workspaceApi.getTask(selectedProjectForModal.id);
      } catch {
        return null;
      }
    },
    enabled: !!selectedProjectForModal?.id,
    staleTime: 30_000,
  });

  useQuery({
    queryKey: ["escrow", selectedProjectForModal?.id],
    queryFn: async () => {
      if (!selectedProjectForModal?.id) return null;
      try {
        return await paymentApi.getEscrow(selectedProjectForModal.id);
      } catch {
        return null;
      }
    },
    enabled: !!selectedProjectForModal?.id,
    staleTime: 30_000,
  });

  const [repoViewerOpen, setRepoViewerOpen] = useState(false);

  const { data: modalLiveRepoStatus } = useQuery<ProjectRepoStatus>({
    queryKey: [
      "project-github-status",
      selectedProjectForModal?.id,
      selectedProjectForModal?.github?.repoName,
      selectedProjectForModal?.github?.repoUrl,
    ],
    queryFn: () =>
      githubReadOnlyApi.getProjectRepoStatus(
        selectedProjectForModal!.id,
        selectedProjectForModal?.github
      ),
    enabled: Boolean(selectedProjectForModal?.id),
    staleTime: 30_000,
  });

  const announce = (msg: string) => {
    setLiveAnnouncement(msg);
    setTimeout(() => setLiveAnnouncement(""), 3000);
  };

  const handleAccept = async (projectId: string) => {
    claimTaskId(projectId);
    setTaskAcceptedMap((prev) => ({ ...prev, [projectId]: true }));
    setTaskDeclinedMap((prev) => ({ ...prev, [projectId]: false }));
    queryClient.setQueryData<ProjectScope[]>(["projects", "realtime-list"], (old) =>
      old?.map((p) => (p.id === projectId ? { ...p, projectState: "in_progress" } : p))
    );
    try {
      await projectApi.acceptProject(projectId);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      announce("Task accepted. Workspace is ready to launch.");
      toast.success("Task accepted. Ready to open workspace.");
    } catch (err) {
      unclaimTaskId(projectId);
      setTaskAcceptedMap((prev) => ({ ...prev, [projectId]: false }));
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      const msg = err instanceof Error ? err.message : "Failed to accept task.";
      toast.error(msg);
    }
  };

  const handleDecline = (projectId: string) => {
    unclaimTaskId(projectId);
    setTaskDeclinedMap((prev) => ({ ...prev, [projectId]: true }));
    setTaskAcceptedMap((prev) => ({ ...prev, [projectId]: false }));
    announce("Task declined.");
  };

  const handleReconsider = (projectId: string) => {
    setTaskDeclinedMap((prev) => ({ ...prev, [projectId]: false }));
    announce("Task available to accept.");
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard?.writeText(id);
    toast.success(`Copied ${id}`);
  };

  const getDisplayDeadline = (deadlineStr?: string) => {
    if (!deadlineStr) {
      return {
        formattedDate: "Open deadline",
        relativeText: "no due date",
        isOverdue: false,
      };
    }

    const d = new Date(deadlineStr);
    const isValid = !isNaN(d.getTime());
    if (!isValid) {
      return {
        formattedDate: deadlineStr,
        relativeText: "",
        isOverdue: false,
      };
    }

    const formattedDate = d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const now = Date.now();
    const diffMs = d.getTime() - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        formattedDate,
        relativeText: `overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`,
        isOverdue: true,
      };
    }

    return {
      formattedDate,
      relativeText: diffDays === 0 ? "due today" : `in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      isOverdue: false,
    };
  };

  if (projectsLoading) {
    return (
      <div
        className="flex-1 overflow-y-auto bg-background p-6 lg:p-8"
        role="status"
        aria-label="Loading task details"
      >
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="rounded-2xl border-border bg-card p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (projectsError) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background p-6 text-center">
        <Card className="max-w-md w-full rounded-2xl border-border bg-card p-6 space-y-4">
          <div className="flex justify-center">
            <AlertCircle className="h-6 w-6 text-danger" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-foreground">
            Unable to load tasks from backend
          </h2>
          <p className="text-sm text-muted">
            {projectErrorDetails instanceof Error
              ? projectErrorDetails.message
              : "The CodeBridge API Gateway (/api/v1/projects) returned an error or is unreachable."}
          </p>
          <Button
            variant="primary"
            onClick={() => refetchProjects()}
            className="w-full rounded-xl justify-center"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Retry connection</span>
          </Button>
        </Card>
      </div>
    );
  }

  if (sortedProjects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background p-6 text-center">
        <Card className="max-w-md w-full rounded-2xl border-border bg-card p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">No tasks available</h2>
          <p className="text-sm text-muted">
            There are currently no open tasks or assigned projects on the backend gateway.
          </p>
          <Button
            variant="primary"
            onClick={() => refetchProjects()}
            className="w-full rounded-xl justify-center"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Refresh</span>
          </Button>
        </Card>
      </div>
    );
  }

  const modalTaskId = selectedProjectForModal?.id || "";
  const modalTaskTitle = selectedProjectForModal?.title || "";
  const modalProblemText =
    selectedProjectForModal?.description ||
    (Array.isArray(taskDetails?.brief) ? taskDetails.brief[0] : "") ||
    "Issue details and reproduction steps provided by project owner.";
  const modalExpectedOutcome =
    selectedProjectForModal?.expectedResult ||
    (Array.isArray(taskDetails?.brief) ? taskDetails.brief[1] : "") ||
    "Expected outcome and verification requirements provided by project owner.";
  const modalSkillsList =
    taskDetails?.stack && taskDetails.stack.length > 0
      ? taskDetails.stack
      : selectedProjectForModal?.skills && selectedProjectForModal.skills.length > 0
        ? selectedProjectForModal.skills
        : ["Python", "FastAPI"];
  const modalCriteriaList: string[] =
    taskDetails?.criteria && taskDetails.criteria.length > 0
      ? taskDetails.criteria.map((c) => (typeof c === "string" ? c : c.text))
      : [
        selectedProjectForModal?.expectedResult ||
        "All test assertions pass cleanly with zero regression.",
      ];

  const modalDeadlineInfo = getDisplayDeadline(selectedProjectForModal?.deadline);
  const modalAmountFormatted = selectedProjectForModal
    ? formatCurrencyINR(selectedProjectForModal.budget)
    : "₹0";
  const rawFallbackRepoName =
    taskDetails?.repo?.name ||
    selectedProjectForModal?.github?.repoName ||
    "";
  const modalRepoStatus: ProjectRepoStatus = modalLiveRepoStatus ?? {
    connected: Boolean(
      rawFallbackRepoName &&
        rawFallbackRepoName !== "codebridge/payments-service"
    ),
    fullName: rawFallbackRepoName || "codebridge/payments-service",
    htmlUrl:
      selectedProjectForModal?.github?.repoUrl ||
      (rawFallbackRepoName &&
      rawFallbackRepoName !== "codebridge/payments-service" &&
      rawFallbackRepoName.includes("/")
        ? `https://github.com/${rawFallbackRepoName}`
        : null),
    defaultBranch: selectedProjectForModal?.github?.defaultBranch || "main",
    isPrivate: Boolean(selectedProjectForModal?.github?.isPrivate),
    description: selectedProjectForModal?.github?.description || null,
    source: selectedProjectForModal?.github?.repoUrl
      ? "project_url"
      : "placeholder",
  };
  const modalRepoName = modalRepoStatus.fullName;
  const modalCommitHash =
    taskDetails?.repo?.commit ||
    selectedProjectForModal?.github?.commitHash ||
    "c8f492b";

  const isModalTaskAccepted =
    taskAcceptedMap[modalTaskId] ||
    selectedProjectForModal?.projectState === "in_progress";
  const isModalTaskDeclined = taskDeclinedMap[modalTaskId] || false;

  const modalMatch = selectedProjectForModal
    ? computeSkillMatch(selectedProjectForModal, userSkills)
    : { matched: false, matchedSkills: [] as string[], matchPercentage: 0 };

  return (
    <div className="flex-1 overflow-y-auto bg-background text-foreground min-h-screen">
      <div aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Tasks Radar
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-medium bg-card border border-border text-muted">
                <Layers className="h-3.5 w-3.5 text-primary dark:text-accent" aria-hidden="true" />
                <span className="font-mono tabular-nums">{sortedProjects.length}</span>
                <span>Tasks available</span>
              </span>
            </div>
            <p className="text-sm text-muted">
              Inspect objective acceptance criteria, review escrow guarantees, and accept tasks matching your tech stack.
            </p>
          </div>

          {userSkills.length > 0 && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card border border-border text-xs shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              <span className="text-muted">Matched stack:</span>
              <span className="font-medium text-foreground">
                {userSkills.slice(0, 3).join(", ")}
                {userSkills.length > 3 ? ` +${userSkills.length - 3}` : ""}
              </span>
            </div>
          )}
        </div>

        {/* Filter Pills & Search Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-full border border-border bg-card p-1 self-start">
            {FILTER_OPTIONS.map((opt) => {
              const isSelected = activeFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setActiveFilter(opt.id)}
                  className={`relative px-3.5 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer ${isSelected ? "text-primary-foreground font-semibold" : "text-muted hover:text-foreground"
                    }`}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="radar-filter-pill"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      className="absolute inset-0 rounded-full bg-primary shadow-sm"
                    />
                  )}
                  <span className="relative z-10">{opt.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-72">
            <Search
              className="h-4 w-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Search tasks, skills, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl bg-card border-border text-xs h-9"
              aria-label="Filter tasks"
            />
          </div>
        </div>

        {/* Projects Grid */}
        <section aria-label="Available projects grid">
          {filteredProjects.length === 0 ? (
            <Card className="rounded-2xl border-border bg-card p-8 text-center">
              <p className="text-sm font-medium text-foreground">No matching tasks</p>
              <p className="text-xs text-muted mt-1">
                Try clearing your filter or search query to inspect all available scopes.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProjects.map((project) => {
                const match = computeSkillMatch(project, userSkills);
                const deadline = getDisplayDeadline(project.deadline);
                const isAccepted =
                  taskAcceptedMap[project.id] || project.projectState === "in_progress";

                return (
                  <Card
                    key={project.id}
                    className="rounded-2xl border-border bg-card shadow-sm hover:border-ring/60 transition-colors flex flex-col justify-between"
                  >
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                      <div>
                        <span className="text-xs text-muted block font-medium">Fixed price</span>
                        <span className="text-2xl font-bold font-mono tabular-nums text-foreground">
                          {formatCurrencyINR(project.budget)}
                        </span>
                      </div>

                      {match.matched && match.matchPercentage > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-bg text-success border border-success-border">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                          <span>{match.matchPercentage}% match</span>
                        </span>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-3 flex-1 pb-4">
                      <div className="space-y-1.5 min-w-0">
                        <h2 className="text-base font-semibold text-foreground line-clamp-2 break-words [overflow-wrap:anywhere]">
                          {project.title}
                        </h2>
                        <p className="text-xs text-muted line-clamp-2 leading-relaxed break-words [overflow-wrap:anywhere]">
                          {project.description || "Objective specification provided by client."}
                        </p>
                      </div>

                      {project.skills && project.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {project.skills.slice(0, 3).map((skill) => {
                            const isMatched = userSkills.some(
                              (us) => us.trim().toLowerCase() === skill.trim().toLowerCase()
                            );
                            return (
                              <span
                                key={skill}
                                className={`px-2 py-0.5 rounded-lg text-xs border ${isMatched
                                    ? "bg-success-bg text-success border-success-border font-medium"
                                    : "bg-raised text-muted border-border"
                                  }`}
                              >
                                {skill}
                              </span>
                            );
                          })}
                          {project.skills.length > 3 && (
                            <span className="text-xs text-muted self-center">
                              +{project.skills.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="flex flex-col gap-3 pt-3 border-t border-border/70">
                      <div className="w-full flex items-center justify-between text-xs text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{deadline.formattedDate}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-success font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                          <span>Payment held</span>
                        </span>
                      </div>

                      <Button
                        variant={isAccepted ? "secondary" : "primary"}
                        onClick={() => setSelectedProjectForModal(project)}
                        className="w-full rounded-xl justify-center"
                        aria-label={`Project Description for ${project.title}`}
                      >
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        <span>{isAccepted ? "View workspace scope" : "Project Description"}</span>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* SLIDE-OVER SHEET: Project Description details with Accept / Decline actions */}
      <Sheet
        open={Boolean(selectedProjectForModal)}
        onOpenChange={(open) => {
          if (!open) setSelectedProjectForModal(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-3xl lg:max-w-4xl overflow-y-auto overflow-x-hidden bg-card border-l border-border p-6 sm:p-8 space-y-6"
        >
          <SheetDescription className="sr-only">
            Detailed project scope, acceptance criteria, stack requirements, and escrow timeline.
          </SheetDescription>

          {/* Header Breadcrumb */}
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-border pr-8 min-w-0">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted min-w-0">
              <span className="shrink-0">Tasks</span>
              <span aria-hidden="true" className="shrink-0">/</span>
              <button
                type="button"
                onClick={() => handleCopyId(modalTaskId)}
                className="inline-flex items-center gap-1 font-mono tabular-nums text-foreground font-medium hover:text-primary dark:hover:text-accent transition-colors min-w-0 max-w-full"
                title="Click to copy Task ID"
              >
                <span className="truncate">{modalTaskId}</span>
                <Copy className="h-3 w-3 text-muted shrink-0" aria-hidden="true" />
              </button>
            </nav>
          </div>

          {modalMatch.matched && modalMatch.matchedSkills.length > 0 && (
            <div className="p-3.5 rounded-xl bg-success-bg border border-success-border text-xs text-success flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="break-words [overflow-wrap:anywhere]">
                  <strong>Recommended for your stack:</strong> matches your verified skills (
                  {modalMatch.matchedSkills.join(", ")}).
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-success text-primary-foreground font-semibold text-xs shrink-0">
                {modalMatch.matchPercentage}% match
              </span>
            </div>
          )}

          {/* 2-Column Content */}
          <div className="flex flex-col lg:flex-row items-start gap-8 min-w-0">
            <div className="w-full min-w-0 flex-1 space-y-6">
              <div className="min-w-0">
                <SheetTitle asChild>
                  <h1
                    id="modal-task-title"
                    className="text-2xl font-bold tracking-tight text-foreground break-words [overflow-wrap:anywhere]"
                  >
                    {modalTaskTitle}
                  </h1>
                </SheetTitle>
                <p className="text-xs text-muted mt-1 break-words [overflow-wrap:anywhere]">
                  Posted by {selectedProjectForModal?.ownerName || "CodeBridge Project Owner"}
                </p>
              </div>

              <div className="h-px bg-border" aria-hidden="true" />

              <section aria-labelledby="modal-heading-broken" className="space-y-2 min-w-0">
                <h2 id="modal-heading-broken" className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-warning shrink-0" aria-hidden="true" />
                  <span>What is broken</span>
                </h2>
                <div className="p-3.5 rounded-xl bg-background border border-border min-w-0">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-line break-words [overflow-wrap:anywhere]">
                    {modalProblemText}
                  </p>
                </div>
              </section>

              <section aria-labelledby="modal-heading-expects" className="space-y-2 min-w-0">
                <h2 id="modal-heading-expects" className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary dark:text-accent shrink-0" aria-hidden="true" />
                  <span>What the owner expects</span>
                </h2>
                <div className="p-3.5 rounded-xl bg-background border border-border min-w-0">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-line break-words [overflow-wrap:anywhere]">
                    {modalExpectedOutcome}
                  </p>
                </div>
              </section>

              <section aria-labelledby="modal-heading-criteria" className="space-y-2 min-w-0">
                <h2 id="modal-heading-criteria" className="text-sm font-semibold text-foreground">
                  Done when
                </h2>
                {modalCriteriaList.length > 0 ? (
                  <ol className="space-y-2 list-decimal list-inside text-sm leading-relaxed text-foreground p-3.5 rounded-xl bg-background border border-border min-w-0 break-words [overflow-wrap:anywhere]">
                    {modalCriteriaList.map((item, idx) => (
                      <li key={idx} className="pl-1 break-words [overflow-wrap:anywhere]">
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted">No specific criteria listed.</p>
                )}
              </section>

              <section aria-labelledby="modal-heading-stack" className="space-y-2">
                <h2 id="modal-heading-stack" className="text-sm font-semibold text-foreground">
                  Stack
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {modalSkillsList.map((skill) => {
                    const isMatchedSkill = userSkills.some(
                      (us) => us.trim().toLowerCase() === skill.trim().toLowerCase()
                    );
                    return (
                      <span
                        key={skill}
                        className={`px-3 py-1 rounded-xl text-xs font-medium border flex items-center gap-1.5 ${isMatchedSkill
                            ? "bg-success-bg text-success border-success-border font-semibold"
                            : "bg-background text-foreground border-border"
                          }`}
                      >
                        {isMatchedSkill && <Check className="h-3 w-3" aria-hidden="true" />}
                        <span>{skill}</span>
                        {isMatchedSkill && (
                          <span className="text-xs opacity-75">(Matched)</span>
                        )}
                      </span>
                    );
                  })}
                </div>
                <p className="sr-only">{modalSkillsList.join(", ")}</p>
              </section>
            </div>

            {/* Right Aside: Escrow & Actions */}
            <aside className="w-full lg:w-80 lg:sticky lg:top-0 rounded-2xl border border-border bg-background p-5 space-y-6 shrink-0 min-w-0">
              <div className="space-y-1">
                <span className="text-xs text-muted block font-medium">Fixed price</span>
                <div className="text-3xl font-bold font-mono tabular-nums text-foreground">
                  {modalAmountFormatted}
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Payment held</span>
                  {PAYMENT_MODE === "simulated" && (
                    <span className="text-muted">Simulated payment - demo only</span>
                  )}
                </div>

                <ul className="space-y-2.5 text-xs">
                  {ESCROW_STEPS.map((step) => {
                    const isHeld = step.key === "held";
                    return (
                      <li key={step.key} className="flex items-center gap-2.5">
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${isHeld ? "bg-success" : "border border-border bg-card"
                            }`}
                          aria-hidden="true"
                        />
                        <span className={isHeld ? "font-semibold text-foreground" : "text-muted"}>
                          {step.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <p className="text-xs text-muted leading-relaxed">
                  Released after your tests pass and the owner approves.
                </p>
              </div>

              <div className="space-y-3 pt-3 border-t border-border">
                {isModalTaskDeclined ? (
                  <div className="space-y-2 text-center">
                    <p className="text-xs text-muted">You declined this task.</p>
                    <Button
                      variant="secondary"
                      onClick={() => handleReconsider(modalTaskId)}
                      className="w-full rounded-xl justify-center text-xs"
                    >
                      Reconsider task
                    </Button>
                  </div>
                ) : isModalTaskAccepted ? (
                  <Button
                    variant="primary"
                    onClick={() => {
                      setSelectedProjectForModal(null);
                      onOpenWorkspace(modalTaskId);
                    }}
                    className="w-full rounded-xl justify-center"
                  >
                    <span>Open workspace</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                ) : (
                  <div className="space-y-2.5">
                    <Button
                      variant="primary"
                      onClick={() => handleAccept(modalTaskId)}
                      className="w-full rounded-xl justify-center"
                    >
                      Accept task
                    </Button>
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => handleDecline(modalTaskId)}
                        className="text-xs text-muted hover:text-foreground transition-colors"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        onClick={() => announce("Messaging is not yet configured for this project.")}
                        className="text-xs text-primary dark:text-accent hover:underline transition-all"
                      >
                        Ask the owner a question
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <dl className="space-y-3 text-xs pt-4 border-t border-border">
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-muted shrink-0">Deadline</dt>
                  <dd className="text-right">
                    <span className={modalDeadlineInfo.isOverdue ? "text-danger font-medium" : "text-foreground"}>
                      {modalDeadlineInfo.formattedDate}
                    </span>
                    {modalDeadlineInfo.relativeText && (
                      <span
                        className={`block text-xs ${modalDeadlineInfo.isOverdue ? "text-danger font-semibold" : "text-muted"
                          }`}
                      >
                        ({modalDeadlineInfo.relativeText})
                      </span>
                    )}
                  </dd>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <dt className="text-muted shrink-0">Task ID</dt>
                  <dd className="font-mono tabular-nums text-xs text-foreground text-right break-all">
                    {modalTaskId}
                  </dd>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted">Repository</dt>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                      <Lock className="h-3 w-3 text-primary dark:text-accent" aria-hidden="true" />
                      Read-only
                    </span>
                  </div>
                  <dd className="text-foreground min-w-0 space-y-1.5">
                    {modalRepoStatus.htmlUrl ? (
                      <a
                        href={modalRepoStatus.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-primary dark:text-accent font-medium break-all hover:underline inline-flex items-center gap-1"
                        title="Open repository on GitHub (read-only)"
                      >
                        <span>{modalRepoName}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="font-mono text-xs block break-all">{modalRepoName}</span>
                    )}
                    <span className="font-mono tabular-nums text-xs text-muted block break-all">
                      {modalRepoStatus.defaultBranch} · {modalCommitHash}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRepoViewerOpen(true)}
                      className="w-full h-8 gap-1.5 text-xs mt-1"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      Preview code (Read-only)
                    </Button>
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted">Status</dt>
                  <dd className="font-medium text-foreground">
                    {isModalTaskAccepted ? "Assigned" : "Available"}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </SheetContent>
      </Sheet>
      {selectedProjectForModal && (
        <ReadOnlyRepoViewer
          open={repoViewerOpen}
          onOpenChange={setRepoViewerOpen}
          projectId={modalTaskId}
          repoStatus={modalRepoStatus}
        />
      )}
    </div>
  );
};
