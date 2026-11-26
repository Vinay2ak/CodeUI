import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  GitBranch,
  GitCommit,
  FolderGit2,
  Calendar,
  User,
  ShieldCheck,
  RefreshCw,
  Coins,
  CircleDashed,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { workspaceApi } from "../../services/workspace/api";
import { submissionApi } from "../../services/submission/api";
import { Chip } from "../../components/ui/Chip";
import { formatCurrencyINR, formatRelativeTime } from "../../lib/format";
import { ApiError } from "../../lib/errors";

interface BriefTabProps {
  taskId: string;
}

export const BriefTab: React.FC<BriefTabProps> = ({ taskId }) => {
  const { data: task, isLoading, error, refetch } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => workspaceApi.getTask(taskId),
    enabled: Boolean(taskId),
  });

  const { data: subData } = useQuery({
    queryKey: ["submission", "current", taskId],
    queryFn: () => submissionApi.getCurrentSubmission(taskId),
    enabled: Boolean(taskId),
  });

  const getCriterionStatus = (testIds: string[]) => {
    if (!subData?.lastRun || subData.lastRun.results.length === 0) {
      return {
        label: "Not run",
        tone: "neutral" as const,
        icon: <CircleDashed className="h-3 w-3 text-muted" aria-hidden="true" />,
      };
    }
    const results = subData.lastRun.results;
    const relevant = results.filter((r) => testIds.includes(r.testId));
    if (relevant.length === 0) {
      return {
        label: "Not run",
        tone: "neutral" as const,
        icon: <CircleDashed className="h-3 w-3 text-muted" aria-hidden="true" />,
      };
    }
    if (relevant.some((r) => r.status === "running")) {
      return {
        label: "Running",
        tone: "warning" as const,
        icon: <Loader2 className="h-3 w-3 text-warning animate-spin" aria-hidden="true" />,
      };
    }
    if (relevant.every((r) => r.status === "passed")) {
      return {
        label: "Passed",
        tone: "success" as const,
        icon: <CheckCircle className="h-3 w-3 text-success" aria-hidden="true" />,
      };
    }
    if (relevant.some((r) => r.status === "failed")) {
      return {
        label: "Failed",
        tone: "danger" as const,
        icon: <AlertCircle className="h-3 w-3 text-danger" aria-hidden="true" />,
      };
    }
    return {
      label: "Not run",
      tone: "neutral" as const,
      icon: <CircleDashed className="h-3 w-3 text-muted" aria-hidden="true" />,
    };
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-3/4 bg-raised rounded" />
        <div className="h-4 w-1/2 bg-raised rounded" />
        <div className="h-24 bg-raised rounded-xl" />
        <div className="h-32 bg-raised rounded-xl" />
      </div>
    );
  }

  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    const correlationId = apiError?.correlationId || "err_brief";

    return (
      <div className="rounded-lg border border-line bg-raised p-4 text-center">
        <p className="text-sm text-ink mb-1">Failed to load task details.</p>
        <p className="text-xs text-muted mb-3 font-mono">Reference: {correlationId}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (!task) {
    return <div className="text-sm text-muted text-center py-6">No task details available.</div>;
  }

  return (
    <div className="space-y-6 text-sm">
      {/* Header Info */}
      <div>
        <div className="flex items-center gap-2 text-xs text-muted mb-1">
          <span>{task.projectTitle}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" aria-hidden="true" />
            {task.ownerName}
          </span>
        </div>
        <h3 className="text-lg font-bold text-ink mb-3 break-words [overflow-wrap:anywhere]">{task.title}</h3>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5 text-money-text" aria-hidden="true" />
            <span className="font-semibold text-money-text">
              {formatCurrencyINR(task.reward)}
            </span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Due {formatRelativeTime(task.dueAt)}</span>
          </div>
        </div>
      </div>

      {/* Stack Chips */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
          Technology Stack
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {task.stack.map((tech) => (
            <Chip key={tech} tone="neutral">
              {tech}
            </Chip>
          ))}
        </div>
      </div>

      {/* Repo Snapshot Card */}
      <div className="rounded-xl border border-line bg-raised p-3.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <FolderGit2 className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
            <span className="font-mono font-medium text-ink truncate">{task.repo.name}</span>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-surface border border-line text-muted">
            <ShieldCheck className="h-3 w-3 text-primary" aria-hidden="true" />
            <span>Read-only snapshot · no push access</span>
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-muted">
          <div className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" aria-hidden="true" />
            <span>{task.repo.branch}</span>
          </div>
          <div className="flex items-center gap-1">
            <GitCommit className="h-3 w-3" aria-hidden="true" />
            <span>{task.repo.commit}</span>
          </div>
        </div>
      </div>

      {/* Brief Paragraphs */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
          Task Description
        </h4>
        <div className="space-y-2.5 text-muted leading-relaxed break-words [overflow-wrap:anywhere]">
          {task.brief.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>
      </div>

      {/* Acceptance Criteria */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
          Acceptance Criteria & Verification
        </h4>
        <ul className="space-y-3">
          {task.criteria.map((criterion) => (
            <li
              key={criterion.id}
              className="rounded-lg border border-line bg-surface p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-ink leading-snug break-words [overflow-wrap:anywhere] min-w-0">
                  {criterion.text}
                </span>
                <Chip tone={criterion.required ? "warning" : "neutral"} className="shrink-0">
                  {criterion.required ? "Required" : "Optional"}
                </Chip>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-line text-xs">
                <div className="flex flex-wrap items-center gap-1 text-muted font-mono">
                  {criterion.testIds.map((testId) => (
                    <span key={testId} className="px-1.5 py-0.5 rounded bg-raised border border-line">
                      {testId}
                    </span>
                  ))}
                </div>
                {(() => {
                  const statusInfo = getCriterionStatus(criterion.testIds);
                  return (
                    <Chip tone={statusInfo.tone} icon={statusInfo.icon}>
                      {statusInfo.label}
                    </Chip>
                  );
                })()}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
